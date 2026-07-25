import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  BackgroundTaskError,
  VaultIOError,
  guardVaultIO,
  openVaultUserError,
  registerBackgroundError,
  reportUserError,
  resetErrorReportingForTests,
  setBackgroundErrorListener,
  userFacingMessage,
  vaultIncompatibleCause,
} from "../errors";
import {
  NoteNotFoundError,
  VaultDataError,
  VaultIncompatibleError,
} from "../../domain";

describe("application/errors", () => {
  beforeEach(() => {
    resetErrorReportingForTests();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("wraps vault I/O failures as VaultIOError", async () => {
    await expect(
      guardVaultIO(
        {
          operation: "save-note",
          module: "application/use-cases/save-note.ts",
          trace: "saveNote → VaultSession.saveNote",
          fixHint: "Check FsNoteRepository.update.",
        },
        "Could not save your note.",
        "Try again.",
        async () => {
          throw new Error("disk full");
        },
      ),
    ).rejects.toBeInstanceOf(VaultIOError);
  });

  it("reports user errors with friendly payload and technical console log", () => {
    const error = new VaultIOError(
      "Could not save your note.",
      {
        operation: "save-note",
        module: "application/use-cases/save-note.ts",
        trace: "saveNote → VaultSession.saveNote",
        fixHint: "Check FsNoteRepository.update.",
      },
      "Try again.",
      new Error("disk full"),
    );

    const payload = reportUserError(error);

    expect(payload).toEqual({
      message: "Could not save your note.",
      fixHint: "Try again.",
    });
    expect(console.error).toHaveBeenCalledWith(
      "[private-notes] VaultIOError",
      expect.objectContaining({
        operation: "save-note",
        module: "application/use-cases/save-note.ts",
        trace: "saveNote → VaultSession.saveNote",
        fixHint: "Check FsNoteRepository.update.",
      }),
      expect.any(Error),
    );
  });

  it("registers background errors once and notifies listeners", () => {
    const listener = vi.fn();
    setBackgroundErrorListener(listener);

    registerBackgroundError("reindex", new Error("worker crashed"), {
      operation: "run-full-reindex",
      module: "application/use-cases/run-full-reindex.ts",
      trace: "runFullReindex → search.reindex",
      fixHint: "Retry via IndexStatus.onReindex.",
    });
    registerBackgroundError("reindex", new Error("worker crashed"), {
      operation: "run-full-reindex",
      module: "application/use-cases/run-full-reindex.ts",
      trace: "runFullReindex → search.reindex",
      fixHint: "Retry via IndexStatus.onReindex.",
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0]?.[0]).toBeInstanceOf(BackgroundTaskError);
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it("maps open-vault failures to user-facing copy", () => {
    expect(
      openVaultUserError(
        new VaultIncompatibleError(
          "newer-app-version",
          "Vault was written by a newer app version (2).",
        ),
      ),
    ).toEqual({
      message: "This vault was created by a newer version of private-notes.",
      fixHint: "Update the app, then open this folder again.",
    });

    expect(
      openVaultUserError(new VaultDataError("not valid JSON", "index.json")),
    ).toEqual({
      message: "A vault file in this folder looks damaged.",
      fixHint:
        "Check `.private-notes/` in the folder, restore from a backup if you have one, or choose a different folder.",
    });

    expect(
      openVaultUserError(new Error("Folder permission was not granted.")),
    ).toEqual({
      message: "Could not access this folder.",
      fixHint:
        "Grant read/write access when the browser asks, then choose the folder again.",
    });
  });

  it("extracts vault incompatibility from wrapped VaultIOError", () => {
    const cause = new VaultIncompatibleError("not-a-vault", "not a vault");
    const error = new VaultIOError(
      "This folder is not a private-notes vault.",
      {
        operation: "open-vault",
        module: "application/use-cases/open-vault.ts",
        trace: "openVault",
        fixHint: "test",
      },
      "Choose another folder.",
      cause,
    );

    expect(vaultIncompatibleCause(error)).toBe(cause);
    expect(vaultIncompatibleCause(cause)).toBe(cause);
    expect(vaultIncompatibleCause(new Error("other"))).toBeNull();
  });

  it("maps note-not-found to a specific user message", async () => {
    await expect(
      guardVaultIO(
        {
          operation: "save-note",
          module: "application/use-cases/save-note.ts",
          trace: "saveNote → VaultSession.saveNote",
          fixHint: "Check FsNoteRepository.update.",
        },
        "Could not save your note.",
        "Try again.",
        async () => {
          throw new NoteNotFoundError("missing-id");
        },
      ),
    ).rejects.toMatchObject({
      message: "This note no longer exists.",
      fixHint:
        "It may have been deleted in another tab. Pick another note or refresh the list.",
    });
  });

  it("extracts user-facing text from typed errors", () => {
    const error = new VaultIOError(
      "Could not open this note.",
      {
        operation: "open-note",
        module: "application/use-cases/open-note.ts",
        trace: "openNote → VaultSession.openNote",
        fixHint: "Check FsNoteRepository.read.",
      },
      "Try reopening the folder.",
    );

    expect(userFacingMessage(error)).toBe("Could not open this note.");
    expect(error.fixHint).toBe("Try reopening the folder.");
  });
});
