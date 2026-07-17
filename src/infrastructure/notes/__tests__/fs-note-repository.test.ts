import { describe, it, expect } from "vitest";
import { addRef } from "../../../infrastructure/attachments/refs";
import { storeAttachment } from "../../../infrastructure/attachments/storage";
import { createNote, readNote } from "../../../infrastructure/notes/storage";
import { noteId } from "../../../domain";
import { fakeFile, setupTestVault } from "../../../test/vaultFixtures";
import { FsNoteRepository } from "../fs-note-repository";

describe("FsNoteRepository", () => {
  it("lists domain summaries from the vault index", async () => {
    const io = await setupTestVault();
    await createNote(io, { title: "One", body: "a" });

    const repo = new FsNoteRepository(io.root);
    const summaries = await repo.list();

    expect(summaries).toHaveLength(1);
    expect(summaries[0]?.title).toBe("One");
  });

  it("creates a note as a domain entity", async () => {
    const io = await setupTestVault();
    const repo = new FsNoteRepository(io.root);

    const note = await repo.create({ title: "Fresh", body: "New body" });

    expect(note).toEqual(
      expect.objectContaining({
        title: "Fresh",
        body: "New body",
      }),
    );
    expect(await repo.list()).toHaveLength(1);
  });

  it("reads a note as a domain entity", async () => {
    const io = await setupTestVault();
    const record = await createNote(io, { title: "Read me", body: "Content" });
    const repo = new FsNoteRepository(io.root);

    const note = await repo.read(noteId(record.id));

    expect(note).toEqual(
      expect.objectContaining({
        id: noteId(record.id),
        title: "Read me",
        body: "Content",
      }),
    );
  });

  it("updates a note and returns gc attachment paths", async () => {
    const io = await setupTestVault();
    const stored = await storeAttachment(io.root, fakeFile("pic.png", "image/png", [1]));
    const record = await createNote(io, {
      title: "T",
      body: `![img](${stored.path})`,
    });
    await addRef(io.root, record.id, stored.path);
    const repo = new FsNoteRepository(io.root);

    const { note, gcAttachments } = await repo.update(noteId(record.id), {
      body: "plain text",
    });

    expect(note.body).toBe("plain text");
    expect(gcAttachments).toEqual([stored.path]);
    expect(await readNote(io, record.id)).toMatchObject({
      parsed: { body: "plain text" },
    });
  });

  it("duplicates a note with its body", async () => {
    const io = await setupTestVault();
    const original = await createNote(io, { title: "Src", body: "Copy me" });
    const repo = new FsNoteRepository(io.root);

    const copy = await repo.duplicate(noteId(original.id));

    expect(copy?.title).toBe("Src (copy)");
    expect(copy?.body).toBe("Copy me");
    expect(await repo.list()).toHaveLength(2);
  });

  it("deletes a note from the vault", async () => {
    const io = await setupTestVault();
    const record = await createNote(io, { title: "Gone", body: "x" });
    const repo = new FsNoteRepository(io.root);

    await repo.delete(noteId(record.id));

    expect(await repo.list()).toHaveLength(0);
    expect(await repo.read(noteId(record.id))).toBeNull();
  });
});
