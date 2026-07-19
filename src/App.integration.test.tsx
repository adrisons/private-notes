import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "fake-indexeddb/auto";
import "./test/registerIntegrationMocks";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { listNotes, readNote } from "./infrastructure/notes/storage";
import {
  advanceAutosave,
  cleanupIntegrationTest,
  resetVaultStore,
  waitForSearchReady,
} from "./test/appHarness";
import {
  confirmDeleteActiveNote,
  confirmDeleteDialog,
  createIntegrationTestContext,
  createNoteWithTitle,
  openVaultFromWelcomeScreen,
  openVaultSkippingWelcome,
  searchInCommandPalette,
  setFieldValue,
  stubDirectoryPicker,
  type IntegrationTestContext,
} from "./test/integrationHelpers";

describe("App integration", () => {
  let ctx: IntegrationTestContext;

  beforeEach(async () => {
    await resetVaultStore();
    ctx = createIntegrationTestContext();
    stubDirectoryPicker(ctx.pickerRoot);
  });

  afterEach(async () => {
    await cleanupIntegrationTest();
  });

  describe("vault lifecycle", () => {
    it("shows Welcome on cold start then opens the vault from the picker", async () => {
      await openVaultFromWelcomeScreen();
      expect(
        screen.getByRole("button", { name: /welcome to private-notes/i }),
      ).toBeInTheDocument();
    });

    it("restores the last vault from IndexedDB and skips Welcome", async () => {
      await openVaultSkippingWelcome(ctx.pickerRoot);
      expect(
        screen.queryByRole("heading", {
          name: /your notes, on your machine/i,
        }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /welcome to private-notes/i }),
      ).toBeInTheDocument();
    });
  });

  describe("note editing", () => {
    it("creates a new note from the sidebar", async () => {
      const result = await openVaultSkippingWelcome(ctx.pickerRoot);
      await result.user.click(screen.getByRole("button", { name: /^new$/i }));
      await waitFor(() => {
        expect(screen.getByDisplayValue("Untitled")).toBeInTheDocument();
        expect(screen.getByLabelText("note body")).toBeInTheDocument();
      });
    });

    it("selects a note from the sidebar list", async () => {
      const result = await openVaultSkippingWelcome(ctx.pickerRoot);
      await createNoteWithTitle(result, "Second note");

      await result.user.click(screen.getByRole("button", { name: /^new$/i }));
      await waitFor(() => {
        expect(screen.getByDisplayValue("Untitled")).toBeInTheDocument();
      });

      await result.user.click(
        screen.getByRole("button", { name: /second note/i }),
      );
      await waitFor(() => {
        expect(screen.getByDisplayValue("Second note")).toBeInTheDocument();
      });
    });

    it("autosaves title edits after the debounce delay", async () => {
      await openVaultSkippingWelcome(ctx.pickerRoot);
      setFieldValue(
        screen.getByDisplayValue("Welcome to private-notes"),
        "Saved title",
      );
      await advanceAutosave();

      await waitFor(async () => {
        const saved = (await listNotes({ root: ctx.pickerRoot })).find(
          (n) => n.title === "Saved title",
        );
        expect(saved).toBeDefined();
        const note = await readNote({ root: ctx.pickerRoot }, saved!.id);
        expect(note?.parsed.frontmatter.title).toBe("Saved title");
      });
    });

    it("autosaves body edits after the debounce delay", async () => {
      await openVaultSkippingWelcome(ctx.pickerRoot);
      setFieldValue(
        screen.getByLabelText("note body"),
        "Persisted body paragraph.",
      );
      await advanceAutosave();

      await waitFor(async () => {
        const welcome = (await listNotes({ root: ctx.pickerRoot })).find((n) =>
          n.title.includes("Welcome"),
        );
        expect(welcome).toBeDefined();
        const note = await readNote({ root: ctx.pickerRoot }, welcome!.id);
        expect(note?.parsed.body).toBe("Persisted body paragraph.");
      });
    });
  });

  describe("note deletion and duplication", () => {
    it("deletes the active note after confirmation", async () => {
      const result = await openVaultSkippingWelcome(ctx.pickerRoot);
      await result.user.click(screen.getByRole("button", { name: /^new$/i }));
      setFieldValue(screen.getByDisplayValue("Untitled"), "Delete me");
      await confirmDeleteActiveNote(result);

      await waitFor(() => {
        expect(screen.queryByDisplayValue("Delete me")).not.toBeInTheDocument();
        expect(screen.getByText("No note selected")).toBeInTheDocument();
      });
    });

    it("deletes a note from the sidebar context menu", async () => {
      const result = await openVaultSkippingWelcome(ctx.pickerRoot);
      await createNoteWithTitle(result, "Context delete");

      const noteButton = screen.getByRole("button", {
        name: /context delete/i,
      });
      fireEvent.contextMenu(noteButton);
      await result.user.click(
        screen.getByRole("menuitem", { name: /delete note/i }),
      );
      await confirmDeleteDialog(result);

      await waitFor(() => {
        expect(screen.queryByText("Context delete")).not.toBeInTheDocument();
      });
    });

    it("duplicates a note from the sidebar context menu", async () => {
      const result = await openVaultSkippingWelcome(ctx.pickerRoot);
      await createNoteWithTitle(result, "My Original");

      fireEvent.contextMenu(
        screen.getByRole("button", { name: /my original/i }),
      );
      await result.user.click(
        screen.getByRole("menuitem", { name: /duplicate note/i }),
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /my original \(copy\)/i }),
        ).toBeInTheDocument();
        expect(
          screen.getByDisplayValue("My Original (copy)"),
        ).toBeInTheDocument();
      });
    });
  });

  describe("command palette", () => {
    it("opens the command palette with Cmd+K", async () => {
      const result = await openVaultSkippingWelcome(ctx.pickerRoot);
      await result.user.keyboard("{Meta>}k{/Meta}");
      expect(await screen.findByLabelText("Search notes")).toBeInTheDocument();
    });

    it("falls back to lexical title matches in the command palette", async () => {
      const result = await openVaultSkippingWelcome(ctx.pickerRoot, {
        waitForSemanticSearch: true,
      });
      await createNoteWithTitle(result, "Unique Zebra Title");
      await searchInCommandPalette(result, "zebra");

      await waitFor(() => {
        expect(
          screen.getAllByText("Unique Zebra Title").length,
        ).toBeGreaterThan(0);
      });
    });

    it("returns semantic hits from the command palette", async () => {
      const result = await openVaultSkippingWelcome(ctx.pickerRoot, {
        waitForSemanticSearch: true,
      });
      setFieldValue(
        screen.getByLabelText("note body"),
        "Astronomers observe distant xylophone nebulae every night.",
      );
      await advanceAutosave();
      await waitForSearchReady(result);
      await searchInCommandPalette(result, "xylophone nebulae");

      await waitFor(() => {
        expect(screen.getByText(/xylophone nebulae/i)).toBeInTheDocument();
      });
    });
  });
});
