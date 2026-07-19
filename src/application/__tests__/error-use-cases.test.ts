import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { noteId } from "../../domain";
import type { VaultSession } from "../vault-session";
import { BackgroundTaskError, resetErrorReportingForTests } from "../errors";
import { createNote } from "../use-cases/create-note";
import { saveNote } from "../use-cases/save-note";
import { openNote } from "../use-cases/open-note";
import { deleteNote } from "../use-cases/delete-note";
import { duplicateNote } from "../use-cases/duplicate-note";
import { openVault } from "../use-cases/open-vault";
import { runFullReindex } from "../use-cases/run-full-reindex";
import type { SemanticSearch } from "../ports/semantic-search";
import type { Embedder } from "../ports/embedder";

function sessionStub(methods: Partial<VaultSession>): VaultSession {
  return methods as unknown as VaultSession;
}

const NOTE_IO_CASES = [
  {
    operation: "save-note",
    message: "Could not save your note.",
    run: (session: VaultSession) =>
      saveNote(session, noteId("n1"), "Title", "body"),
    mock: (session: VaultSession) => {
      session.saveNote = vi.fn().mockRejectedValue(new Error("disk full"));
    },
  },
  {
    operation: "create-note",
    message: "Could not create a new note.",
    run: (session: VaultSession) => createNote(session),
    mock: (session: VaultSession) => {
      session.createNote = vi.fn().mockRejectedValue(new Error("disk full"));
    },
  },
  {
    operation: "open-note",
    message: "Could not open this note.",
    run: (session: VaultSession) => openNote(session, noteId("n1")),
    mock: (session: VaultSession) => {
      session.openNote = vi.fn().mockRejectedValue(new Error("missing file"));
    },
  },
  {
    operation: "delete-note",
    message: "Could not delete this note.",
    run: (session: VaultSession) => deleteNote(session, noteId("n1")),
    mock: (session: VaultSession) => {
      session.deleteNote = vi.fn().mockRejectedValue(new Error("locked"));
    },
  },
  {
    operation: "duplicate-note",
    message: "Could not duplicate this note.",
    run: (session: VaultSession) => duplicateNote(session, noteId("n1")),
    mock: (session: VaultSession) => {
      session.duplicateNote = vi.fn().mockRejectedValue(new Error("locked"));
    },
  },
] as const;

describe("error use cases", () => {
  beforeEach(() => {
    resetErrorReportingForTests();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(NOTE_IO_CASES)(
    "$operation wraps I/O failures as NoteIOError",
    async ({ operation, message, run, mock }) => {
      const session = sessionStub({});
      mock(session);

      await expect(run(session)).rejects.toMatchObject({
        message,
        debug: { operation },
      });
    },
  );

  it("open-vault wraps activation failures as NoteIOError", async () => {
    const handle = {} as FileSystemDirectoryHandle;
    await expect(
      openVault(handle, {
        infra: {
          vaultGateway: {
            ensurePermission: vi.fn().mockRejectedValue(new Error("denied")),
            hasPermission: vi.fn(),
            open: vi.fn(),
            reconcile: vi.fn(),
          },
          handleStore: {
            load: vi.fn(),
            persist: vi.fn(),
            clear: vi.fn(),
          },
          folderPicker: { pick: vi.fn() },
          semanticSearchFactory: { create: vi.fn() },
        },
      }),
    ).rejects.toMatchObject({
      message: "Could not open this folder.",
      debug: { operation: "open-vault" },
    });
  });

  it("run-full-reindex returns BackgroundTaskError when indexing fails", async () => {
    const session = sessionStub({
      listNoteRecords: vi.fn().mockResolvedValue([]),
    });
    const search = {
      pruneOrphans: vi.fn().mockResolvedValue(undefined),
      reindex: vi.fn().mockRejectedValue(new Error("worker crashed")),
    } as unknown as SemanticSearch;
    const embedder = { id: "fake", dimensions: 32, embed: vi.fn() } as Embedder;

    const error = await runFullReindex(session, search, embedder);

    expect(error).toBeInstanceOf(BackgroundTaskError);
    expect(error?.task).toBe("reindex");
  });
});
