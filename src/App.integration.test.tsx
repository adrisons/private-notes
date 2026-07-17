import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "fake-indexeddb/auto";
import userEvent from "@testing-library/user-event";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { listNotes, readNote } from "./lib/notes/storage";
import { persistVaultHandle } from "./lib/fs/vault-handle-store";
import * as vaultHandleStore from "./lib/fs/vault-handle-store";
import { initializeVault } from "./lib/fs/vault";
import { makeFakeRoot } from "./test/fakeFs";
import {
  advanceAutosave,
  cleanupIntegrationTest,
  renderApp,
  resetVaultStore,
  waitForVaultOpen,
  waitForSearchReady,
} from "./test/appHarness";

vi.mock("./lib/compatibility", () => ({
  getCompatibility: () => ({ supported: true, reasons: [], webgpu: false }),
}));

vi.mock("./lib/fs/permissions", () => ({
  ensureReadWritePermission: vi.fn().mockResolvedValue(undefined),
  hasReadWritePermission: vi.fn().mockResolvedValue(true),
}));

vi.mock("./lib/search/transformers-embedder", async () => {
  const { FakeEmbedder } = await import("./lib/search/embedder");
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

describe("App integration", () => {
  let pickerRoot: FileSystemDirectoryHandle;

  beforeEach(async () => {
    await resetVaultStore();
    pickerRoot = makeFakeRoot();
    vi.stubGlobal(
      "showDirectoryPicker",
      vi.fn().mockResolvedValue(pickerRoot),
    );
  });

  afterEach(async () => {
    await cleanupIntegrationTest();
  });

  async function openVaultFromWelcome() {
    const result = await renderApp();
    expect(
      screen.getByRole("heading", { name: /your notes, on your machine/i }),
    ).toBeInTheDocument();
    await result.user.click(
      screen.getByRole("button", { name: /choose folder/i }),
    );
    await waitForVaultOpen(result);
    return result;
  }

  it("shows Welcome on cold start then opens the vault from the picker", async () => {
    await openVaultFromWelcome();
    expect(screen.getByText("Welcome to private-notes")).toBeInTheDocument();
  });

  it("restores the last vault from IndexedDB and skips Welcome", async () => {
    await initializeVault(pickerRoot);
    await persistVaultHandle(pickerRoot);
    // fake-indexeddb structured-clone drops FS handle methods; return the live root.
    const loadSpy = vi
      .spyOn(vaultHandleStore, "loadVaultHandle")
      .mockResolvedValue(pickerRoot);
    try {
      const result = await renderApp();
      await waitFor(() => {
        expect(
          screen.queryByRole("heading", {
            name: /your notes, on your machine/i,
          }),
        ).not.toBeInTheDocument();
      });
      await waitForVaultOpen(result);
    } finally {
      loadSpy.mockRestore();
    }
  });

  it("creates a new note from the sidebar", async () => {
    const result = await openVaultFromWelcome();
    await result.user.click(screen.getByRole("button", { name: /^new$/i }));
    await waitFor(() => {
      expect(screen.getByDisplayValue("Untitled")).toBeInTheDocument();
      expect(screen.getByLabelText("note body")).toBeInTheDocument();
    });
  });

  it("selects a note from the sidebar list", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const result = await renderApp({
      advanceTimers: (ms) => {
        vi.advanceTimersByTime(ms);
      },
    });
    await result.user.click(
      screen.getByRole("button", { name: /choose folder/i }),
    );
    await waitForVaultOpen(result);

    await result.user.click(screen.getByRole("button", { name: /^new$/i }));
    const titleInput = screen.getByDisplayValue("Untitled");
    await result.user.clear(titleInput);
    await result.user.type(titleInput, "Second note");
    await advanceAutosave();

    await result.user.click(screen.getByRole("button", { name: /^new$/i }));
    await waitFor(() => {
      expect(screen.getByDisplayValue("Untitled")).toBeInTheDocument();
    });

    await result.user.click(screen.getByRole("button", { name: /second note/i }));
    await waitFor(() => {
      expect(screen.getByDisplayValue("Second note")).toBeInTheDocument();
    });
  });

  it("deletes the active note after confirmation", async () => {
    const result = await openVaultFromWelcome();
    await result.user.click(screen.getByRole("button", { name: /^new$/i }));
    const titleInput = screen.getByDisplayValue("Untitled");
    await result.user.clear(titleInput);
    await result.user.type(titleInput, "Delete me");

    await result.user.click(screen.getByRole("button", { name: /^delete$/i }));
    const dialog = await screen.findByRole("dialog", {
      name: /delete this note/i,
    });
    await result.user.click(
      within(dialog).getByRole("button", { name: /^delete$/i }),
    );

    await waitFor(() => {
      expect(screen.queryByDisplayValue("Delete me")).not.toBeInTheDocument();
      expect(screen.getByText("No note selected")).toBeInTheDocument();
    });
  });

  it("deletes a note from the sidebar context menu", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const result = await renderApp({
      advanceTimers: (ms) => {
        vi.advanceTimersByTime(ms);
      },
    });
    await result.user.click(
      screen.getByRole("button", { name: /choose folder/i }),
    );
    await waitForVaultOpen(result);

    await result.user.click(screen.getByRole("button", { name: /^new$/i }));
    const titleInput = screen.getByDisplayValue("Untitled");
    await result.user.clear(titleInput);
    await result.user.type(titleInput, "Context delete");
    await advanceAutosave();
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /context delete/i }),
      ).toBeInTheDocument();
    });

    const noteButton = screen.getByRole("button", { name: /context delete/i });
    fireEvent.contextMenu(noteButton);
    await result.user.click(screen.getByRole("menuitem", { name: /delete note/i }));

    const dialog = await screen.findByRole("dialog", {
      name: /delete this note/i,
    });
    await result.user.click(
      within(dialog).getByRole("button", { name: /^delete$/i }),
    );

    await waitFor(() => {
      expect(screen.queryByText("Context delete")).not.toBeInTheDocument();
    });
  });

  it("duplicates a note from the sidebar context menu", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const result = await renderApp({
      advanceTimers: (ms) => {
        vi.advanceTimersByTime(ms);
      },
    });
    await result.user.click(
      screen.getByRole("button", { name: /choose folder/i }),
    );
    await waitForVaultOpen(result);

    await result.user.click(screen.getByRole("button", { name: /^new$/i }));
    const titleInput = screen.getByDisplayValue("Untitled");
    await result.user.clear(titleInput);
    await result.user.type(titleInput, "My Original");
    await advanceAutosave();
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /my original/i }),
      ).toBeInTheDocument();
    });

    const noteButton = screen.getByRole("button", { name: /my original/i });
    fireEvent.contextMenu(noteButton);
    await result.user.click(
      screen.getByRole("menuitem", { name: /duplicate note/i }),
    );

    await waitFor(() => {
      expect(screen.getByText("My Original (copy)")).toBeInTheDocument();
      expect(screen.getByDisplayValue("My Original (copy)")).toBeInTheDocument();
    });
  });

  it("opens the command palette with Cmd+K", async () => {
    const result = await openVaultFromWelcome();
    await result.user.keyboard("{Meta>}k{/Meta}");
    expect(await screen.findByLabelText("Search notes")).toBeInTheDocument();
  });

  it("autosaves title edits after the debounce delay", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const result = await renderApp({
      advanceTimers: (ms) => {
        vi.advanceTimersByTime(ms);
      },
    });
    await result.user.click(
      screen.getByRole("button", { name: /choose folder/i }),
    );
    await waitForVaultOpen(result);

    const titleInput = screen.getByDisplayValue("Welcome to private-notes");
    await result.user.clear(titleInput);
    await result.user.type(titleInput, "Saved title");
    await advanceAutosave();

    await waitFor(async () => {
      const saved = (await listNotes({ root: pickerRoot })).find(
        (n) => n.title === "Saved title",
      );
      expect(saved).toBeDefined();
      const note = await readNote({ root: pickerRoot }, saved!.id);
      expect(note?.parsed.frontmatter.title).toBe("Saved title");
    });
  });

  it("autosaves body edits after the debounce delay", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const result = await renderApp({
      advanceTimers: (ms) => {
        vi.advanceTimersByTime(ms);
      },
    });
    await result.user.click(
      screen.getByRole("button", { name: /choose folder/i }),
    );
    await waitForVaultOpen(result);

    const body = screen.getByLabelText("note body");
    await result.user.clear(body);
    await result.user.type(body, "Persisted body paragraph.");
    await advanceAutosave();

    await waitFor(async () => {
      const welcome = (await listNotes({ root: pickerRoot })).find((n) =>
        n.title.includes("Welcome"),
      );
      expect(welcome).toBeDefined();
      const note = await readNote({ root: pickerRoot }, welcome!.id);
      expect(note?.parsed.body).toBe("Persisted body paragraph.");
    });
  });

  it(
    "falls back to lexical title matches in the command palette",
    async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const result = await renderApp({
        advanceTimers: (ms) => {
        vi.advanceTimersByTime(ms);
      },
      });
      await result.user.click(
        screen.getByRole("button", { name: /choose folder/i }),
      );
      await waitForVaultOpen(result);

      await result.user.click(screen.getByRole("button", { name: /^new$/i }));
      const titleInput = await screen.findByDisplayValue("Untitled");
      await result.user.clear(titleInput);
      await result.user.type(titleInput, "Unique Zebra Title");
      await advanceAutosave();
      await waitFor(() => {
        expect(screen.getByText("Unique Zebra Title")).toBeInTheDocument();
      });

      vi.useRealTimers();
      const user = userEvent.setup();
      await user.keyboard("{Meta>}k{/Meta}");
      const searchInput = await screen.findByLabelText("Search notes");
      await user.type(searchInput, "zebra");

      await waitFor(() => {
        expect(screen.getAllByText("Unique Zebra Title").length).toBeGreaterThan(
          0,
        );
      });
    },
    10000,
  );

  it(
    "returns semantic hits from the command palette",
    async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const result = await renderApp({
        advanceTimers: (ms) => {
        vi.advanceTimersByTime(ms);
      },
      });
      await result.user.click(
        screen.getByRole("button", { name: /choose folder/i }),
      );
      await waitForVaultOpen(result);
      await waitFor(() =>
        expect(screen.getByLabelText("note body")).toBeInTheDocument(),
      );

      const body = screen.getByLabelText("note body");
      await result.user.clear(body);
      await result.user.type(
        body,
        "Astronomers observe distant xylophone nebulae every night.",
      );
      await advanceAutosave();
      vi.useRealTimers();
      await waitForSearchReady(result);

      const user = userEvent.setup();
      await user.keyboard("{Meta>}k{/Meta}");
      const searchInput = await screen.findByLabelText("Search notes");
      await user.type(searchInput, "xylophone nebulae");

      await waitFor(
        () => {
          expect(screen.getByText(/xylophone nebulae/i)).toBeInTheDocument();
        },
        { timeout: 10000 },
      );
    },
    15000,
  );
});
