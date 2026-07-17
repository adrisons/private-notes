import { describe, it, expect } from "vitest";
import { makeFakeRoot } from "../../../test/fakeFs";
import { initializeVault } from "../../fs/vault";
import { readText, writeText } from "../../fs/handle";
import { PATHS } from "../../fs/types";
import { createNote, listNotes } from "../storage";
import { reconcileVault } from "../reconcile";

async function setup() {
  const root = makeFakeRoot();
  await initializeVault(root, new Date("2026-05-17T10:00:00Z"));
  const io = {
    root,
    now: () => new Date("2026-05-17T10:00:00Z"),
    newId: (() => {
      let n = 0;
      return () => `01HXXX${String(n++).padStart(20, "0")}`;
    })(),
  };
  return io;
}

async function readIndexNotes(root: FileSystemDirectoryHandle) {
  return JSON.parse(await readText(root, PATHS.index)).notes as {
    id: string;
    path: string;
  }[];
}

describe("reconcileVault", () => {
  it("is a no-op when the index already matches disk", async () => {
    const io = await setup();
    await createNote(io, { title: "One", body: "a" });
    await createNote(io, { title: "Two", body: "b" });

    const result = await reconcileVault(io.root);
    expect(result.changed).toBe(false);
    expect(result.added).toBe(0);
    expect(result.removed).toBe(0);
    expect(result.index.notes).toHaveLength(2);
  });

  it("re-adds an orphan note file missing from the index", async () => {
    const io = await setup();
    const kept = await createNote(io, { title: "Kept", body: "a" });
    const orphan = await createNote(io, { title: "Orphan", body: "b" });

    // Simulate a crash after the note file was written but before the index
    // update landed: drop the orphan's entry from index.json by hand.
    const index = JSON.parse(await readText(io.root, PATHS.index));
    index.notes = index.notes.filter(
      (n: { id: string }) => n.id !== orphan.id,
    );
    await writeText(io.root, PATHS.index, JSON.stringify(index, null, 2));

    const result = await reconcileVault(io.root);
    expect(result.changed).toBe(true);
    expect(result.added).toBe(1);

    const ids = (await readIndexNotes(io.root)).map((n) => n.id).sort();
    expect(ids).toEqual([kept.id, orphan.id].sort());
    // The recovered note is now visible through the normal listing path.
    expect((await listNotes(io)).map((n) => n.id).sort()).toEqual(
      [kept.id, orphan.id].sort(),
    );
  });

  it("prunes a dangling index entry whose file no longer exists", async () => {
    const io = await setup();
    const real = await createNote(io, { title: "Real", body: "a" });

    // Inject an index entry pointing at a file that was never written.
    const index = JSON.parse(await readText(io.root, PATHS.index));
    index.notes.push({
      id: "ghost",
      title: "Ghost",
      path: "notes/2026/05/ghost-ghost.md",
      createdAt: "2026-05-17T10:00:00.000Z",
      updatedAt: "2026-05-17T10:00:00.000Z",
    });
    await writeText(io.root, PATHS.index, JSON.stringify(index, null, 2));

    const result = await reconcileVault(io.root);
    expect(result.changed).toBe(true);
    expect(result.removed).toBe(1);
    expect((await readIndexNotes(io.root)).map((n) => n.id)).toEqual([real.id]);
  });

  it("rebuilds the index wholesale when it is corrupt", async () => {
    const io = await setup();
    const a = await createNote(io, { title: "A", body: "a" });
    const b = await createNote(io, { title: "B", body: "b" });

    await writeText(io.root, PATHS.index, "{ this is not valid json");

    const result = await reconcileVault(io.root);
    expect(result.changed).toBe(true);
    expect((await readIndexNotes(io.root)).map((n) => n.id).sort()).toEqual(
      [a.id, b.id].sort(),
    );
  });

  it("keeps a prior entry for a present-but-unparseable note file", async () => {
    const io = await setup();
    const note = await createNote(io, { title: "Broken", body: "a" });

    // Corrupt the note file's content but leave the index entry intact.
    await writeText(io.root, note.path, "not a valid note");

    const result = await reconcileVault(io.root);
    // We must NOT drop the note: its file is on disk, just unreadable now.
    expect(result.removed).toBe(0);
    expect(result.skipped).toEqual([]);
    expect((await readIndexNotes(io.root)).map((n) => n.id)).toEqual([note.id]);
  });

  it("reports an unparseable file that has no prior index entry as skipped", async () => {
    const io = await setup();
    await writeText(io.root, "notes/2026/05/junk-junk.md", "garbage");

    const result = await reconcileVault(io.root);
    expect(result.skipped).toEqual(["notes/2026/05/junk-junk.md"]);
    expect(result.index.notes).toHaveLength(0);
  });
});
