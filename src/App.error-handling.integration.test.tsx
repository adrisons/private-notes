import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "fake-indexeddb/auto";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { makeFakeRoot } from "./test/fakeFs";
import { noteIOError } from "./test/errorFixtures";
import {
  advanceAutosave,
  cleanupIntegrationTest,
  renderApp,
  resetVaultStore,
  waitForVaultOpen,
} from "./test/appHarness";
import * as openVaultModule from "./application/use-cases/open-vault";
import * as saveNoteModule from "./application/use-cases/save-note";
import * as createNoteModule from "./application/use-cases/create-note";
import * as deleteNoteModule from "./application/use-cases/delete-note";
import * as duplicateNoteModule from "./application/use-cases/duplicate-note";
import * as openNoteModule from "./application/use-cases/open-note";
import * as runFullReindexModule from "./application/use-cases/run-full-reindex";
import * as loadEmbedderModule from "./application/composition/load-embedder";
import {
  BackgroundTaskError,
  registerBackgroundError,
  resetErrorReportingForTests,
} from "./application/errors";

vi.mock("./lib/compatibility", () => ({
  getCompatibility: () => ({ supported: true, reasons: [], webgpu: false }),
}));

vi.mock("./infrastructure/fs/permissions", () => ({
  ensureReadWritePermission: vi.fn().mockResolvedValue(undefined),
  hasReadWritePermission: vi.fn().mockResolvedValue(true),
}));

vi.mock("./infrastructure/search/transformers-embedder", async () => {
  const { FakeEmbedder } = await import("./infrastructure/search/embedder");
  class MockTransformersEmbedder extends FakeEmbedder {
    async ready(): Promise<void> {}
  }
  return {
    TransformersEmbedder: MockTransformersEmbedder,
    DEFAULT_MODEL_ID: "fake-hash-32",
  };
});

vi.mock("./editor/Editor", () => ({
  Editor: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
  }) => (
    <textarea
      aria-label="note body"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

describe("App error handling integration", () => {
  let pickerRoot: FileSystemDirectoryHandle;
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    resetErrorReportingForTests();
    await resetVaultStore();
    pickerRoot = makeFakeRoot();
    vi.stubGlobal(
      "showDirectoryPicker",
      vi.fn().mockResolvedValue(pickerRoot),
    );
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await cleanupIntegrationTest();
  });

  async function openVaultFromWelcome(options: { fakeTimers?: boolean } = {}) {
    if (options.fakeTimers) {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    }
    const result = await renderApp(
      options.fakeTimers
        ? {
            advanceTimers: (ms) => {
              vi.advanceTimersByTime(ms);
            },
          }
        : {},
    );
    await result.user.click(
      screen.getByRole("button", { name: /choose folder/i }),
    );
    await waitForVaultOpen(result);
    return result;
  }

  function expectToast(message: RegExp | string, fixHint?: RegExp | string) {
    const alert = screen.getByRole("alert");
    if (typeof message === "string") {
      expect(alert).toHaveTextContent(message);
    } else {
      expect(alert).toHaveTextContent(message);
    }
    if (fixHint) {
      expect(alert).toHaveTextContent(fixHint);
    }
  }

  it("surfaces open-vault failures on Welcome", async () => {
    const error = noteIOError(
      "open-vault",
      "Could not open this folder.",
      "Choose the folder again and grant read/write access when prompted.",
    );
    const openSpy = vi.spyOn(openVaultModule, "openVault").mockRejectedValue(error);

    const result = await renderApp();
    await result.user.click(
      screen.getByRole("button", { name: /choose folder/i }),
    );

    await waitFor(() => {
      expect(screen.getByText(/could not open this folder\./i)).toBeInTheDocument();
      expect(
        screen.getByText(/choose the folder again and grant read\/write access/i),
      ).toBeInTheDocument();
    });
    expect(consoleError).toHaveBeenCalledWith(
      "[private-notes] NoteIOError",
      expect.objectContaining({ operation: "open-vault" }),
      expect.any(Error),
    );
    openSpy.mockRestore();
  });

  it("shows a toast when autosave fails", async () => {
    const saveSpy = vi.spyOn(saveNoteModule, "saveNote").mockRejectedValue(
      noteIOError(
        "save-note",
        "Could not save your note.",
        "Check that the folder is still accessible, then keep editing — we'll retry on the next change.",
      ),
    );

    await openVaultFromWelcome({ fakeTimers: true });
    const body = screen.getByLabelText("note body");
    fireEvent.change(body, { target: { value: "Edited body" } });
    await advanceAutosave();

    await waitFor(() => {
      expectToast(
        "Could not save your note.",
        /folder is still accessible/i,
      );
    });
    expect(consoleError).toHaveBeenCalledWith(
      "[private-notes] NoteIOError",
      expect.objectContaining({ operation: "save-note" }),
      expect.any(Error),
    );
    saveSpy.mockRestore();
  });

  it("shows a toast when creating a note fails", async () => {
    const result = await openVaultFromWelcome();
    const createSpy = vi.spyOn(createNoteModule, "createNote").mockRejectedValue(
      noteIOError(
        "create-note",
        "Could not create a new note.",
        "Make sure the notes folder is writable, then try again.",
      ),
    );

    await result.user.click(screen.getByRole("button", { name: /^new$/i }));

    await waitFor(() => {
      expectToast(
        "Could not create a new note.",
        /notes folder is writable/i,
      );
    });
    createSpy.mockRestore();
  });

  it("shows a toast when deleting a note fails", async () => {
    const result = await openVaultFromWelcome();
    await result.user.click(screen.getByRole("button", { name: /^new$/i }));
    await waitFor(() => {
      expect(screen.getByDisplayValue("Untitled")).toBeInTheDocument();
    });

    const deleteSpy = vi.spyOn(deleteNoteModule, "deleteNote").mockRejectedValue(
      noteIOError(
        "delete-note",
        "Could not delete this note.",
        "Make sure the notes folder is writable, then try again.",
      ),
    );

    await result.user.click(screen.getByRole("button", { name: /^delete$/i }));
    const dialog = await screen.findByRole("dialog", {
      name: /delete this note/i,
    });
    await result.user.click(
      within(dialog).getByRole("button", { name: /^delete$/i }),
    );

    await waitFor(() => {
      expectToast(
        "Could not delete this note.",
        /notes folder is writable/i,
      );
    });
    deleteSpy.mockRestore();
  });

  it("shows a toast when duplicating a note fails", async () => {
    const result = await openVaultFromWelcome({ fakeTimers: true });

    await result.user.click(screen.getByRole("button", { name: /^new$/i }));
    const titleInput = screen.getByDisplayValue("Untitled");
    await result.user.clear(titleInput);
    await result.user.type(titleInput, "Original");
    await advanceAutosave();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /original/i })).toBeInTheDocument();
    });

    const duplicateSpy = vi
      .spyOn(duplicateNoteModule, "duplicateNote")
      .mockRejectedValue(
        noteIOError(
          "duplicate-note",
          "Could not duplicate this note.",
          "Make sure the notes folder is writable, then try again.",
        ),
      );

    fireEvent.contextMenu(screen.getByRole("button", { name: /original/i }));
    await result.user.click(
      screen.getByRole("menuitem", { name: /duplicate note/i }),
    );

    await waitFor(() => {
      expectToast(
        "Could not duplicate this note.",
        /notes folder is writable/i,
      );
    });
    duplicateSpy.mockRestore();
  });

  it("shows a toast when opening a note fails", async () => {
    const result = await openVaultFromWelcome({ fakeTimers: true });

    await result.user.click(screen.getByRole("button", { name: /^new$/i }));
    const titleInput = screen.getByDisplayValue("Untitled");
    await result.user.clear(titleInput);
    await result.user.type(titleInput, "Second note");
    await advanceAutosave();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /second note/i })).toBeInTheDocument();
    });

    await result.user.click(screen.getByRole("button", { name: /^new$/i }));
    await waitFor(() => {
      expect(screen.getByDisplayValue("Untitled")).toBeInTheDocument();
    });

    const openSpy = vi.spyOn(openNoteModule, "openNote").mockRejectedValue(
      noteIOError(
        "open-note",
        "Could not open this note.",
        "The note file may be missing or unreadable. Try refreshing the folder.",
      ),
    );

    await result.user.click(screen.getByRole("button", { name: /second note/i }));

    await waitFor(() => {
      expectToast(
        "Could not open this note.",
        /missing or unreadable/i,
      );
    });
    openSpy.mockRestore();
  });

  it("shows index error in the sidebar when reindex fails", async () => {
    const bgError = registerBackgroundError("reindex", new Error("worker crashed"), {
      operation: "run-full-reindex",
      module: "application/use-cases/run-full-reindex.ts",
      trace: "runFullReindex → search.reindex",
      fixHint: "Retry via IndexStatus.onReindex.",
    });
    vi.spyOn(runFullReindexModule, "runFullReindex").mockResolvedValue(bgError);

    await openVaultFromWelcome();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /index error — tap to retry/i }),
      ).toBeInTheDocument();
    });
    expect(consoleError).toHaveBeenCalledWith(
      "[private-notes] BackgroundTaskError:reindex",
      expect.objectContaining({ operation: "run-full-reindex" }),
      expect.any(Error),
    );
    expect(bgError).toBeInstanceOf(BackgroundTaskError);
  });

  it("shows a toast when the embedder fails to load", async () => {
    vi.spyOn(loadEmbedderModule, "loadDefaultEmbedder").mockRejectedValue(
      new Error("model download failed"),
    );

    await openVaultFromWelcome();

    await waitFor(() => {
      expectToast(/model download failed/i, /reopen the folder/i);
    });
    expect(consoleError).toHaveBeenCalledWith(
      "[private-notes] Unhandled user error",
      expect.objectContaining({ message: "model download failed" }),
      expect.any(Error),
    );
  });
});
