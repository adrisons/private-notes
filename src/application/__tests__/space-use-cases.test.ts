import { describe, expect, it, vi } from "vitest";
import { createNote } from "../../infrastructure/notes/storage";
import { FsNoteRepository } from "../../infrastructure/notes/fs-note-repository";
import { FsSpaceRepository } from "../../infrastructure/spaces/fs-space-repository";
import { FsAttachmentStore } from "../../infrastructure/attachments/fs-attachment-store";
import { VaultSession } from "../vault-session";
import { createSpace } from "../use-cases/create-space";
import { updateSpace } from "../use-cases/update-space";
import { deleteSpaces } from "../use-cases/delete-space";
import { assignNoteSpaces } from "../use-cases/assign-note-spaces";
import { GENERAL_SPACE_ID, noteId, SpaceValidationError } from "../../domain";
import { setupTestVault } from "../../test/vaultFixtures";

async function makeSession() {
  const io = await setupTestVault();
  const session = VaultSession.create({
    root: io.root,
    notes: new FsNoteRepository(io.root),
    spaces: new FsSpaceRepository(io.root),
    attachments: new FsAttachmentStore(io.root),
    createSemanticSearch: () => ({
      searchSemantic: vi.fn().mockResolvedValue([]),
      reindex: vi.fn().mockResolvedValue(undefined),
      pruneOrphans: vi.fn().mockResolvedValue(undefined),
    }),
  });
  return { io, session };
}

describe("create-space", () => {
  it("normalizes the name and drops a blank description", async () => {
    const { session } = await makeSession();
    const space = await createSpace(session, {
      name: "  Work  ",
      colorId: "blue",
      description: "   ",
    });

    expect(space.name).toBe("Work");
    expect(space.description).toBeUndefined();
    expect(space.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(space.updatedAt).toBe(space.createdAt);
    session.dispose();
  });

  it("refuses the reserved name before any I/O happens", async () => {
    const { session } = await makeSession();
    await expect(
      createSpace(session, { name: " general ", colorId: "blue" }),
    ).rejects.toBeInstanceOf(SpaceValidationError);

    expect(await session.listSpaces()).toHaveLength(0);
    session.dispose();
  });

  it("refuses a duplicate name before any I/O happens", async () => {
    const { session } = await makeSession();
    await createSpace(session, { name: "Work", colorId: "blue" });

    await expect(
      createSpace(session, { name: " work ", colorId: "red" }),
    ).rejects.toBeInstanceOf(SpaceValidationError);

    expect(await session.listSpaces()).toHaveLength(1);
    session.dispose();
  });
});

describe("update-space", () => {
  it("clears the description with null and leaves it alone when omitted", async () => {
    const { session } = await makeSession();
    const space = await createSpace(session, {
      name: "Work",
      colorId: "blue",
      description: "context",
    });

    const recolored = await updateSpace(session, space.id, { colorId: "red" });
    expect(recolored?.description).toBe("context");
    expect(recolored?.colorId).toBe("red");
    expect(recolored?.createdAt).toBe(space.createdAt);
    expect(recolored?.updatedAt).toBeTruthy();

    const cleared = await updateSpace(session, space.id, { description: null });
    expect(cleared?.description).toBeUndefined();
    session.dispose();
  });
});

describe("delete-space", () => {
  it("detaches the space from notes and removes the record", async () => {
    const { io, session } = await makeSession();
    const space = await createSpace(session, { name: "Work", colorId: "blue" });
    const note = await createNote(io, { title: "Note", body: "body" });
    await assignNoteSpaces(session, noteId(note.id), [space.id]);

    const result = await deleteSpaces(session, [space.id]);

    expect(result.deleted).toEqual([space.id]);
    expect(result.notesChanged).toBe(true);
    expect(await session.listSpaces()).toHaveLength(0);
    const summaries = await session.listSummaries();
    expect(summaries[0]?.spaceIds).toEqual([]);
    session.dispose();
  });

  it("deletes many in one pass and ignores General", async () => {
    const { session } = await makeSession();
    const a = await createSpace(session, { name: "A", colorId: "blue" });
    const b = await createSpace(session, { name: "B", colorId: "red" });

    const result = await deleteSpaces(session, [a.id, b.id, GENERAL_SPACE_ID]);

    expect(result.deleted).toEqual([a.id, b.id]);
    expect(await session.listSpaces()).toHaveLength(0);
    session.dispose();
  });

  it("is a no-op when only General is passed", async () => {
    const { session } = await makeSession();
    await createSpace(session, { name: "Keep", colorId: "blue" });

    const result = await deleteSpaces(session, [GENERAL_SPACE_ID]);

    expect(result).toEqual({ deleted: [], notesChanged: false });
    expect(await session.listSpaces()).toHaveLength(1);
    session.dispose();
  });
});
