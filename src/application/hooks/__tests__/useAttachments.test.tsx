import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { noteId } from "../../../domain";
import { FsAttachmentStore } from "../../../infrastructure/attachments/fs-attachment-store";
import { FsNoteRepository } from "../../../infrastructure/notes/fs-note-repository";
import { VaultSession } from "../../vault-session";
import { createNote } from "../../../lib/notes/storage";
import { fakeFile, setupTestVault } from "../../../test/vaultFixtures";
import { useAttachments } from "../useAttachments";

async function sessionWithNote() {
  const io = await setupTestVault();
  const record = await createNote(io, { title: "Note", body: "Body" });
  const session = VaultSession.create({
    root: io.root,
    notes: new FsNoteRepository(io.root),
    attachments: new FsAttachmentStore(io.root),
  });
  return { session, noteId: record.id };
}

describe("useAttachments", () => {
  it("stores an attachment and registers a ref for the open note", async () => {
    const { session, noteId: id } = await sessionWithNote();
    const { result } = renderHook(() =>
      useAttachments({ session, currentNoteId: id }),
    );

    let path = "";
    await act(async () => {
      path = await result.current.onUploadImage(
        fakeFile("pic.png", "image/png", [1, 2, 3]),
      );
    });

    expect(path).toMatch(/^attachments\/[0-9a-f]{64}\.png$/);

    session.dispose();
  });

  it("throws when there is no active note", async () => {
    const { session } = await sessionWithNote();
    const { result } = renderHook(() =>
      useAttachments({ session, currentNoteId: null }),
    );

    await expect(
      result.current.onUploadImage(fakeFile("pic.png", "image/png", [1])),
    ).rejects.toThrow("No active note");

    session.dispose();
  });

  it("returns null from resolveImageSrc when the session is missing", async () => {
    const { result } = renderHook(() =>
      useAttachments({ session: null, currentNoteId: noteId("n1") }),
    );

    await expect(
      result.current.resolveImageSrc("attachments/x.png"),
    ).resolves.toBeNull();
  });
});
