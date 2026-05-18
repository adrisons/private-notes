import { describe, it, expect } from "vitest";
import { makeFakeRoot } from "../../../test/fakeFs";
import { initializeVault } from "../../fs/vault";
import {
  createNote,
  deleteNote,
  listNotes,
  readNote,
  updateNote,
} from "../storage";

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

describe("notes storage", () => {
  it("creates a note and indexes it", async () => {
    const io = await setup();
    const rec = await createNote(io, { title: "First", body: "Hello world" });
    expect(rec.title).toBe("First");
    expect(rec.path).toMatch(/^notes\/2026\/05\/first-01HXXX/);

    const list = await listNotes(io);
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe(rec.id);
  });

  it("reads the note back", async () => {
    const io = await setup();
    const rec = await createNote(io, { title: "Hi", body: "Body" });
    const read = await readNote(io, rec.id);
    expect(read?.parsed.body).toBe("Body");
    expect(read?.parsed.frontmatter.title).toBe("Hi");
  });

  it("updates body and bumps updatedAt", async () => {
    const io = await setup();
    const rec = await createNote(io, { title: "T", body: "old" });
    const later = {
      ...io,
      now: () => new Date("2026-05-18T10:00:00Z"),
    };
    const updated = await updateNote(later, rec.id, { body: "new" });
    expect(updated.updatedAt).toBe("2026-05-18T10:00:00.000Z");
    const read = await readNote(later, rec.id);
    expect(read?.parsed.body).toBe("new");
  });

  it("deletes a note and removes it from the index", async () => {
    const io = await setup();
    const rec = await createNote(io, { title: "X", body: "z" });
    await deleteNote(io, rec.id);
    expect(await listNotes(io)).toEqual([]);
    expect(await readNote(io, rec.id)).toBeNull();
  });
});
