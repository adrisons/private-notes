import { describe, it, expect, vi } from "vitest";
import { createNote, updateNote } from "../../infrastructure/notes/storage";
import { openVault, defaultInfrastructure } from "../use-cases/open-vault";
import { WELCOME_NOTE_TITLE } from "../../domain";
import { FsNoteRepository } from "../../infrastructure/notes/fs-note-repository";
import { FsSpaceRepository } from "../../infrastructure/spaces/fs-space-repository";
import { FsAttachmentStore } from "../../infrastructure/attachments/fs-attachment-store";
import { VaultSession } from "../vault-session";
import type { VaultGateway } from "../ports/vault-gateway";
import { noteId } from "../../domain";
import { fakeFile, setupTestVault } from "../../test/vaultFixtures";

const testVaultGateway: VaultGateway = {
  ensurePermission: vi.fn().mockResolvedValue(undefined),
  hasPermission: vi.fn().mockResolvedValue(true),
  open: vi.fn().mockResolvedValue(undefined),
  reconcile: vi.fn().mockResolvedValue(undefined),
  assessRepair: vi.fn().mockResolvedValue({ eligible: false, noteCount: 0 }),
  repair: vi.fn().mockResolvedValue({ noteCount: 0, spaceCount: 0, skipped: [] }),
};

describe("openVault", () => {
  it("seeds the welcome note on an empty vault", async () => {
    const io = await setupTestVault();
    const { session, startup } = await openVault(io.root, {
      infra: {
        ...defaultInfrastructure,
        vaultGateway: testVaultGateway,
        handleStore: {
          load: async () => null,
          persist: async () => {},
          clear: async () => {},
        },
      },
    });

    expect(startup.summaries).toHaveLength(1);
    expect(startup.summaries[0]?.title).toBe(WELCOME_NOTE_TITLE);
    expect(startup.current?.title).toBe(WELCOME_NOTE_TITLE);
    expect(startup.current?.body).toContain("Getting started");

    session.dispose();
  });
});

describe("VaultSession", () => {
  it("opens the most recently edited note on startup", async () => {
    const io = await setupTestVault();
    const older = await createNote(io, { title: "Older", body: "first" });
    await updateNote(
      { ...io, now: () => new Date("2026-05-18T10:00:00Z") },
      older.id,
      { body: "edited" },
    );
    await createNote(
      { ...io, now: () => new Date("2026-05-19T10:00:00Z") },
      { title: "Newer", body: "second" },
    );

    const notes = new FsNoteRepository(io.root);
    const attachments = new FsAttachmentStore(io.root);
    const session = VaultSession.create({ root: io.root, notes, spaces: new FsSpaceRepository(io.root), attachments });
    const startup = await session.resolveStartup();

    expect(startup.summaries).toHaveLength(2);
    expect(startup.current?.title).toBe("Newer");

    session.dispose();
  });

  it("prefers a recently edited note over a newer but untouched one", async () => {
    const io = await setupTestVault();
    const first = await createNote(io, { title: "First", body: "a" });
    await createNote(
      { ...io, now: () => new Date("2026-05-18T10:00:00Z") },
      { title: "Second", body: "b" },
    );
    await updateNote(
      { ...io, now: () => new Date("2026-05-19T10:00:00Z") },
      first.id,
      { body: "edited again" },
    );

    const notes = new FsNoteRepository(io.root);
    const attachments = new FsAttachmentStore(io.root);
    const session = VaultSession.create({ root: io.root, notes, spaces: new FsSpaceRepository(io.root), attachments });
    const startup = await session.resolveStartup();

    expect(startup.current?.id).toBe(first.id);
    expect(startup.current?.title).toBe("First");

    session.dispose();
  });

  it("invalidates removed attachment paths after save", async () => {
    const io = await setupTestVault();
    const attachments = new FsAttachmentStore(io.root);
    const notes = new FsNoteRepository(io.root);
    const session = VaultSession.create({ root: io.root, notes, spaces: new FsSpaceRepository(io.root), attachments });
    const invalidate = vi.spyOn(attachments, "invalidate");

    const { path } = await attachments.store(fakeFile("pic.png", "image/png", [1]));
    const opened = await session.createNote({
      title: "With image",
      body: `![pic](${path})`,
    });
    await attachments.addRef(noteId(opened.id), path);

    await session.saveNote(noteId(opened.id), "With image", "plain text");

    expect(invalidate).toHaveBeenCalledWith(
      expect.arrayContaining([path]),
    );

    session.dispose();
  });
});
