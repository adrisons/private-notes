import { describe, it, expect } from "vitest";
import { makeFakeRoot } from "../../../test/fakeFs";
import { initializeVault } from "../../fs/vault";
import { fileExists } from "../../fs/handle";
import { addRef } from "../../attachments/refs";
import { storeAttachment } from "../../attachments/storage";
import {
  createNote,
  deleteNote,
  duplicateNote,
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

function fakeFile(bytes: number[]) {
  return {
    name: "pic.png",
    type: "image/png",
    async arrayBuffer() {
      const out = new ArrayBuffer(bytes.length);
      new Uint8Array(out).set(bytes);
      return out;
    },
  };
}

describe("notes with shared attachments", () => {
  it("keeps one blob when two notes reference the same image", async () => {
    const io = await setup();
    const stored = await storeAttachment(io.root, fakeFile([7, 8, 9]));
    const noteA = await createNote(io, {
      title: "A",
      body: `![a](${stored.path})`,
    });
    const noteB = await createNote(io, {
      title: "B",
      body: `![b](${stored.path})`,
    });
    await addRef(io.root, noteA.id, stored.path);
    await addRef(io.root, noteB.id, stored.path);

    const attachmentsDir = await io.root.getDirectoryHandle("attachments");
    let count = 0;
    for await (const entry of attachmentsDir.entries()) {
      void entry;
      count++;
    }
    expect(count).toBe(1);
  });

  it("deletes the blob only after the last referencing note is removed", async () => {
    const io = await setup();
    const stored = await storeAttachment(io.root, fakeFile([1, 1, 1]));
    const noteA = await createNote(io, {
      title: "A",
      body: `![a](${stored.path})`,
    });
    const noteB = await createNote(io, {
      title: "B",
      body: `![b](${stored.path})`,
    });
    await addRef(io.root, noteA.id, stored.path);
    await addRef(io.root, noteB.id, stored.path);

    await deleteNote(io, noteA.id);
    expect(await fileExists(io.root, stored.path)).toBe(true);

    await deleteNote(io, noteB.id);
    expect(await fileExists(io.root, stored.path)).toBe(false);
  });

  it("duplicates a note without copying the blob", async () => {
    const io = await setup();
    const stored = await storeAttachment(io.root, fakeFile([2, 3, 4]));
    const original = await createNote(io, {
      title: "Original",
      body: `![pic](${stored.path})`,
    });
    await addRef(io.root, original.id, stored.path);

    const copy = await duplicateNote(io, original.id);
    expect(copy).not.toBeNull();

    const attachmentsDir = await io.root.getDirectoryHandle("attachments");
    let count = 0;
    for await (const entry of attachmentsDir.entries()) {
      void entry;
      count++;
    }
    expect(count).toBe(1);

    await deleteNote(io, original.id);
    expect(await fileExists(io.root, stored.path)).toBe(true);

    await deleteNote(io, copy!.id);
    expect(await fileExists(io.root, stored.path)).toBe(false);
  });

  it("defers blob deletion until note delete or a sweep, not on body edit", async () => {
    const io = await setup();
    const stored = await storeAttachment(io.root, fakeFile([5, 6, 7]));
    const note = await createNote(io, {
      title: "T",
      body: `![pic](${stored.path})`,
    });
    await addRef(io.root, note.id, stored.path);

    const { gcAttachments } = await updateNote(io, note.id, {
      body: "no images here",
    });
    expect(gcAttachments).toEqual([stored.path]);
    expect(await fileExists(io.root, stored.path)).toBe(true);

    await deleteNote(io, note.id);
    expect(await fileExists(io.root, stored.path)).toBe(false);
  });
});
