import { expect, vi } from "vitest";
import { act, cleanup, render, waitFor, type RenderResult } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../App";
import { initializeVault } from "../infrastructure/fs/vault";
import { clearVaultHandle } from "../infrastructure/fs/vault-handle-store";
import * as vaultHandleStore from "../infrastructure/fs/vault-handle-store";
import { createNote } from "../infrastructure/notes/storage";
import { makeFakeRootWithPermissions } from "./fakeFs";

/** Autosave debounce in App.tsx (ADR-007). */
export const AUTOSAVE_DEBOUNCE_MS = 500;

/** Command palette search debounce in CommandPalette.tsx. */
export const COMMAND_PALETTE_DEBOUNCE_MS = 200;

export interface AppRenderResult extends RenderResult {
  user: ReturnType<typeof userEvent.setup>;
}

export interface WaitForVaultOpenOptions {
  /** Wait for embedder load + sidebar "Search…" (only needed for search scenarios). */
  waitForSemanticSearch?: boolean;
}

/** Remove persisted vault handle between integration tests. */
export async function resetVaultStore(): Promise<void> {
  await clearVaultHandle();
}

/** Reset timers, globals, and vault state after an integration test. */
export async function cleanupIntegrationTest(): Promise<void> {
  cleanup();
  vi.useRealTimers();
  vi.clearAllTimers();
  vi.unstubAllGlobals();
  await resetVaultStore();
}

/** Enable fake timers and return the advance handler for userEvent. */
export function enableIntegrationFakeTimers(): {
  advanceTimers: (ms: number) => void;
} {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  return {
    advanceTimers: (ms: number) => {
      vi.advanceTimersByTime(ms);
    },
  };
}

/** Re-bind userEvent on an existing render result to use fake timer advances. */
export function attachFakeTimersToUser(
  result: AppRenderResult,
): AppRenderResult {
  const { advanceTimers } = enableIntegrationFakeTimers();
  return {
    ...result,
    user: userEvent.setup({ advanceTimers }),
  };
}

/** Advance past the autosave debounce and flush pending timers. */
export async function advanceAutosave(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);
  });
}

/** Advance past the command palette search debounce. */
export async function advanceCommandPaletteSearch(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(COMMAND_PALETTE_DEBOUNCE_MS);
  });
}

/** Initialize an empty vault on a fresh in-memory root. */
export async function seedVault(
  root: FileSystemDirectoryHandle = makeFakeRootWithPermissions(),
): Promise<FileSystemDirectoryHandle> {
  await initializeVault(root);
  return root;
}

/** Create notes in the vault for list/selection scenarios. */
export async function seedVaultWithNotes(
  titles: string[],
): Promise<FileSystemDirectoryHandle> {
  const root = await seedVault();
  const io = { root };
  for (const title of titles) {
    await createNote(io, { title, body: `Body for ${title}` });
  }
  return root;
}

/**
 * Render `App` after integration mocks are registered. Waits until the boot
 * spinner disappears. Uses real timers so async vault boot can settle.
 */
export async function renderApp(
  options: {
    advanceTimers?: (ms: number) => void | Promise<void> | unknown;
  } = {},
): Promise<AppRenderResult> {
  if (options.advanceTimers) {
    enableIntegrationFakeTimers();
  } else {
    vi.useRealTimers();
  }
  const user = options.advanceTimers
    ? userEvent.setup({ advanceTimers: options.advanceTimers })
    : userEvent.setup();
  let result!: RenderResult;
  await act(async () => {
    result = render(<App />);
  });
  await waitFor(
    () => {
      expect(result.queryByText("Loading…")).not.toBeInTheDocument();
      const settled =
        result.queryByRole("heading", {
          name: /your notes, on your machine/i,
        }) ?? result.queryByText("Notes");
      expect(settled).toBeTruthy();
    },
    { timeout: 5000 },
  );
  return { ...result, user };
}

/** Render `App` with fake timers enabled for debounced UI (autosave, search). */
export async function renderAppWithFakeTimers(): Promise<AppRenderResult> {
  const { advanceTimers } = enableIntegrationFakeTimers();
  return renderApp({ advanceTimers });
}

/** Wait until the vault editor shell is ready. */
export async function waitForVaultOpen(
  result: RenderResult,
  options: WaitForVaultOpenOptions = {},
): Promise<void> {
  await waitFor(
    () => {
      expect(result.getByText("Notes")).toBeInTheDocument();
      expect(result.getByLabelText("note body")).toBeInTheDocument();
    },
    { timeout: 5000 },
  );
  if (options.waitForSemanticSearch) {
    await waitForSearchReady(result);
  }
}

/** Wait until semantic search reports ready in the sidebar. */
export async function waitForSearchReady(result: RenderResult): Promise<void> {
  await waitFor(
    () => {
      expect(result.getByLabelText(/search notes/i)).toHaveTextContent(
        /search…/i,
      );
    },
    { timeout: 10000 },
  );
}

/**
 * Open the vault by restoring a persisted handle (skips the Welcome screen).
 * fake-indexeddb structured-clone drops FS handle methods; return the live root.
 */
export async function openVaultFromPersistedHandle(
  pickerRoot: FileSystemDirectoryHandle,
  options: WaitForVaultOpenOptions = {},
): Promise<AppRenderResult> {
  vi.useRealTimers();
  await initializeVault(pickerRoot);
  const { persistVaultHandle } = await import(
    "../infrastructure/fs/vault-handle-store"
  );
  await persistVaultHandle(pickerRoot);

  const loadSpy = vi
    .spyOn(vaultHandleStore, "loadVaultHandle")
    .mockResolvedValue(pickerRoot);
  try {
    const result = await renderApp();
    await waitForVaultOpen(result, options);
    return result;
  } finally {
    loadSpy.mockRestore();
  }
}
