import { expect, vi } from "vitest";
import { act, render, waitFor, type RenderResult } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { initializeVault } from "../lib/fs/vault";
import { clearVaultHandle } from "../lib/fs/vault-handle-store";
import { createNote } from "../lib/notes/storage";
import { makeFakeRootWithPermissions } from "./fakeFs";

/** Autosave debounce in App.tsx (ADR-007). */
export const AUTOSAVE_DEBOUNCE_MS = 500;

/** Remove persisted vault handle between integration tests. */
export async function resetVaultStore(): Promise<void> {
  await clearVaultHandle();
}

/** Reset timers, globals, and vault state after an integration test. */
export async function cleanupIntegrationTest(): Promise<void> {
  vi.useRealTimers();
  vi.clearAllTimers();
  vi.unstubAllGlobals();
  await resetVaultStore();
}

/** Advance past the autosave debounce and flush pending timers. */
export async function advanceAutosave(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);
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

export interface AppRenderResult extends RenderResult {
  user: ReturnType<typeof userEvent.setup>;
}

/**
 * Render `App` after integration mocks are registered. Waits until the boot
 * spinner disappears.
 */
export async function renderApp(
  options: {
    advanceTimers?: (ms: number) => void | Promise<void> | unknown;
  } = {},
): Promise<AppRenderResult> {
  const { App } = await import("../App");
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

/** Wait until the vault shell and semantic search are ready. */
export async function waitForVaultOpen(result: RenderResult): Promise<void> {
  await waitFor(() => {
    expect(result.getByText("Notes")).toBeInTheDocument();
    expect(result.getByLabelText("note body")).toBeInTheDocument();
  });
  await waitForSearchReady(result);
}

/** Wait until semantic search reports ready in the sidebar. */
export async function waitForSearchReady(
  result: RenderResult,
): Promise<void> {
  await waitFor(
    () => {
      expect(result.getByLabelText(/search notes/i)).toHaveTextContent(
        /search…/i,
      );
    },
    { timeout: 10000 },
  );
}
