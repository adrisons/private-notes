import { describe, expect, it } from "vitest";
import { makeFakeRoot } from "../../../test/fakeFs";
import { initializeVault } from "../../fs/vault";
import { createNote, deleteNote, listNotes, updateNote } from "../storage";
import { resolveVaultStartup } from "../startup";
import { WELCOME_NOTE_TITLE } from "../welcome-note";

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

describe("resolveVaultStartup", () => {
  it("creates and opens the welcome note when the vault is empty", async () => {
    const io = await setup();
    const startup = await resolveVaultStartup(io);

    expect(startup.notes).toHaveLength(1);
    expect(startup.notes[0]?.title).toBe(WELCOME_NOTE_TITLE);
    expect(startup.current?.title).toBe(WELCOME_NOTE_TITLE);
    expect(startup.current?.body).toContain("Getting started");
    expect(await listNotes(io)).toHaveLength(1);
  });

  it("opens the most recently edited note when notes already exist", async () => {
    const io = await setup();
    const older = await createNote(io, { title: "Older", body: "first" });
    const midIo = {
      ...io,
      now: () => new Date("2026-05-18T10:00:00Z"),
    };
    await updateNote(midIo, older.id, { body: "edited" });
    const newerIo = {
      ...io,
      now: () => new Date("2026-05-19T10:00:00Z"),
    };
    const newer = await createNote(newerIo, { title: "Newer", body: "second" });

    const startup = await resolveVaultStartup(newerIo);

    expect(startup.notes).toHaveLength(2);
    expect(startup.current?.record.id).toBe(newer.id);
    expect(startup.current?.title).toBe("Newer");
  });

  it("prefers a recently edited note over a newer but untouched one", async () => {
    const io = await setup();
    const first = await createNote(io, { title: "First", body: "a" });
    const secondIo = {
      ...io,
      now: () => new Date("2026-05-18T10:00:00Z"),
    };
    await createNote(secondIo, { title: "Second", body: "b" });
    const editedIo = {
      ...io,
      now: () => new Date("2026-05-19T10:00:00Z"),
    };
    await updateNote(editedIo, first.id, { body: "edited again" });

    const startup = await resolveVaultStartup(editedIo);

    expect(startup.current?.record.id).toBe(first.id);
  });

  it("does not recreate the welcome note after the user deletes it", async () => {
    const io = await setup();
    const startup = await resolveVaultStartup(io);
    await deleteNote(io, startup.notes[0]!.id);

    expect(await listNotes(io)).toEqual([]);
  });
});
