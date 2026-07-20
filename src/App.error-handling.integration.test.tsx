import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "fake-indexeddb/auto";
import "./test/registerIntegrationMocks";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { vaultIOError } from "./test/errorFixtures";
import {
  advanceAutosave,
  cleanupIntegrationTest,
  renderAppWithFakeTimers,
  resetVaultStore,
} from "./test/appHarness";
import {
  confirmDeleteActiveNote,
  createIntegrationTestContext,
  createNoteWithTitle,
  expectErrorToast,
  expectLoggedVaultIOError,
  openVaultFromWelcomeScreen,
  sidebarNoteButton,
  stubDirectoryPicker,
  waitForIndexErrorInSidebar,
  type IntegrationTestContext,
} from "./test/integrationHelpers";
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

describe("App error handling integration", () => {
  let ctx: IntegrationTestContext;
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    resetErrorReportingForTests();
    await resetVaultStore();
    ctx = createIntegrationTestContext();
    stubDirectoryPicker(ctx.pickerRoot);
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(async () => {
    await cleanupIntegrationTest();
    vi.restoreAllMocks();
  });

  describe("Welcome screen", () => {
    it("surfaces open-vault failures on Welcome", async () => {
      const error = vaultIOError(
        "open-vault",
        "Could not open this folder.",
        "Choose the folder again and grant read/write access when prompted.",
      );
      const openSpy = vi
        .spyOn(openVaultModule, "openVault")
        .mockRejectedValueOnce(error);

      const result = await renderAppWithFakeTimers();
      await result.user.click(
        screen.getByRole("button", { name: /choose folder/i }),
      );

      await waitFor(() => {
        expect(
          screen.getByText(/could not open this folder\./i),
        ).toBeInTheDocument();
        expect(
          screen.getByText(
            /choose the folder again and grant read\/write access/i,
          ),
        ).toBeInTheDocument();
      });
      expectLoggedVaultIOError(consoleError, "open-vault");
      openSpy.mockRestore();
    });
  });

  describe("note I/O error toasts", () => {
    it("shows a toast when autosave fails", async () => {
      await openVaultFromWelcomeScreen();
      vi.spyOn(saveNoteModule, "saveNote").mockRejectedValue(
        vaultIOError(
          "save-note",
          "Could not save your note.",
          "Check that the folder is still accessible, then keep editing — we'll retry on the next change.",
        ),
      );

      fireEvent.change(screen.getByLabelText("note body"), {
        target: { value: "Edited body" },
      });
      await advanceAutosave();

      await waitFor(() => {
        expectErrorToast(
          "Could not save your note.",
          /folder is still accessible/i,
        );
      });
      expectLoggedVaultIOError(consoleError, "save-note");
    });

    it("shows a toast when creating a note fails", async () => {
      const result = await openVaultFromWelcomeScreen();
      vi.spyOn(createNoteModule, "createNote").mockRejectedValue(
        vaultIOError(
          "create-note",
          "Could not create a new note.",
          "Make sure the notes folder is writable, then try again.",
        ),
      );

      await result.user.click(screen.getByRole("button", { name: /^new$/i }));

      await waitFor(() => {
        expectErrorToast(
          "Could not create a new note.",
          /notes folder is writable/i,
        );
      });
    });

    it("shows a toast when deleting a note fails", async () => {
      const result = await openVaultFromWelcomeScreen();
      await result.user.click(screen.getByRole("button", { name: /^new$/i }));
      await waitFor(() => {
        expect(screen.getByDisplayValue("Untitled")).toBeInTheDocument();
      });

      vi.spyOn(deleteNoteModule, "deleteNote").mockRejectedValue(
        vaultIOError(
          "delete-note",
          "Could not delete this note.",
          "Make sure the notes folder is writable, then try again.",
        ),
      );
      await confirmDeleteActiveNote(result);

      await waitFor(() => {
        expectErrorToast(
          "Could not delete this note.",
          /notes folder is writable/i,
        );
      });
    });

    it("shows a toast when duplicating a note fails", async () => {
      const result = await openVaultFromWelcomeScreen();
      await createNoteWithTitle(result, "Original");

      vi.spyOn(duplicateNoteModule, "duplicateNote").mockRejectedValue(
        vaultIOError(
          "duplicate-note",
          "Could not duplicate this note.",
          "Make sure the notes folder is writable, then try again.",
        ),
      );
      fireEvent.contextMenu(sidebarNoteButton(/original/i));
      await result.user.click(
        screen.getByRole("menuitem", { name: /duplicate note/i }),
      );

      await waitFor(() => {
        expectErrorToast(
          "Could not duplicate this note.",
          /notes folder is writable/i,
        );
      });
    });

    it("shows a toast when opening a note fails", async () => {
      const result = await openVaultFromWelcomeScreen();
      await createNoteWithTitle(result, "Second note");

      await result.user.click(screen.getByRole("button", { name: /^new$/i }));
      await waitFor(() => {
        expect(screen.getByDisplayValue("Untitled")).toBeInTheDocument();
      });

      vi.spyOn(openNoteModule, "openNote").mockRejectedValue(
        vaultIOError(
          "open-note",
          "Could not open this note.",
          "The note file may be missing or unreadable. Try refreshing the folder.",
        ),
      );
      await result.user.click(sidebarNoteButton(/second note/i));

      await waitFor(() => {
        expectErrorToast(
          "Could not open this note.",
          /missing or unreadable/i,
        );
      });
    });
  });

  describe("background task errors", () => {
    it("shows index error in the sidebar when reindex fails", async () => {
      const bgError = registerBackgroundError(
        "reindex",
        new Error("worker crashed"),
        {
          operation: "run-full-reindex",
          module: "application/use-cases/run-full-reindex.ts",
          trace: "runFullReindex → search.reindex",
          fixHint: "Retry via IndexStatus.onReindex.",
        },
      );
      vi.spyOn(runFullReindexModule, "runFullReindex").mockResolvedValue(
        bgError,
      );

      await openVaultFromWelcomeScreen();

      await waitForIndexErrorInSidebar();
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

      await openVaultFromWelcomeScreen();

      await waitFor(() => {
        expectErrorToast(/model download failed/i, /reopen the folder/i);
      });
      expect(consoleError).toHaveBeenCalledWith(
        "[private-notes] Unhandled user error",
        expect.objectContaining({ message: "model download failed" }),
        expect.any(Error),
      );
    });
  });
});
