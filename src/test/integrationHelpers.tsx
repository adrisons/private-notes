import { expect, vi, type MockInstance } from "vitest";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { makeFakeRoot } from "./fakeFs";
import { serializeNote } from "../domain/note/frontmatter";
import { writeText } from "../infrastructure/fs/handle";
import {
  advanceAutosave,
  advanceCommandPaletteSearch,
  attachFakeTimersToUser,
  type AppRenderResult,
  openVaultFromPersistedHandle,
  renderAppWithFakeTimers,
  waitForVaultOpen,
} from "./appHarness";

/** Shared beforeEach state for App integration tests. */
export interface IntegrationTestContext {
  pickerRoot: FileSystemDirectoryHandle;
}

/** Sidebar note row button by title fragment. */
export function sidebarNoteButton(title: string | RegExp): HTMLElement {
  const pattern = typeof title === "string" ? new RegExp(title, "i") : title;
  return screen.getByRole("button", { name: pattern });
}

/** Set an input or textarea value in one shot (faster than userEvent.type). */
export function setFieldValue(element: HTMLElement, value: string): void {
  fireEvent.change(element, { target: { value } });
}

/** Open the vault via the Welcome screen picker flow. */
export async function openVaultFromWelcomeScreen(
  options: { waitForSemanticSearch?: boolean } = {},
): Promise<AppRenderResult> {
  const result = await renderAppWithFakeTimers();
  expect(
    screen.getByRole("heading", { name: /your notes, on your machine/i }),
  ).toBeInTheDocument();
  await result.user.click(
    screen.getByRole("button", { name: /choose folder/i }),
  );
  await waitForVaultOpen(result, options);
  return result;
}

/**
 * Shortcut for tests that only need an open vault, not the Welcome flow.
 * Attaches fake timers after boot so debounced UI can be advanced in tests.
 */
export async function openVaultSkippingWelcome(
  pickerRoot: FileSystemDirectoryHandle,
  options: { waitForSemanticSearch?: boolean } = {},
): Promise<AppRenderResult> {
  const result = await openVaultFromPersistedHandle(pickerRoot, options);
  return attachFakeTimersToUser(result);
}

/** Create a note and autosave its title so it appears in the sidebar. */
export async function createNoteWithTitle(
  result: AppRenderResult,
  title: string,
): Promise<void> {
  await result.user.click(screen.getByRole("button", { name: /^new$/i }));
  setFieldValue(screen.getByDisplayValue("Untitled"), title);
  await advanceAutosave();
  await waitFor(() => {
    expect(sidebarNoteButton(title)).toBeInTheDocument();
  });
}

/** Confirm the delete-note dialog. */
export async function confirmDeleteDialog(
  result: AppRenderResult,
  title: RegExp = /delete (this note|\d+ notes)/i,
): Promise<void> {
  const dialog = await screen.findByRole("dialog", {
    name: title,
  });
  await result.user.click(
    within(dialog).getByRole("button", { name: /^delete$/i }),
  );
}

/** Delete the active note via the header button and confirm the dialog. */
export async function confirmDeleteActiveNote(
  result: AppRenderResult,
): Promise<void> {
  await result.user.click(screen.getByRole("button", { name: /^delete$/i }));
  await confirmDeleteDialog(result);
}

/** Open the command palette and run a debounced search query. */
export async function searchInCommandPalette(
  result: AppRenderResult,
  query: string,
): Promise<void> {
  await result.user.keyboard("{Meta>}k{/Meta}");
  const searchInput = await screen.findByLabelText("Search notes");
  await act(async () => {
    setFieldValue(searchInput, query);
    await advanceCommandPaletteSearch();
  });
}

/** Assert the visible error toast shows the expected copy. */
export function expectErrorToast(
  message: RegExp | string,
  fixHint?: RegExp | string,
): void {
  const alert = screen.getByRole("alert");
  expect(alert).toHaveTextContent(message);
  if (fixHint) {
    expect(alert).toHaveTextContent(fixHint);
  }
}

/** Assert VaultIOError was logged with the expected operation. */
export function expectLoggedVaultIOError(
  consoleError: MockInstance,
  operation: string,
): void {
  expect(consoleError).toHaveBeenCalledWith(
    "[private-notes] VaultIOError",
    expect.objectContaining({ operation }),
    expect.any(Error),
  );
}

/** Wait until the sidebar shows the semantic index error state. */
export async function waitForIndexErrorInSidebar(): Promise<void> {
  await waitFor(() => {
    expect(
      screen.getByRole("button", { name: /index error — tap to retry/i }),
    ).toBeInTheDocument();
  });
}

/** Stub showDirectoryPicker to return the in-memory vault root. */
export function stubDirectoryPicker(
  pickerRoot: FileSystemDirectoryHandle,
): void {
  vi.stubGlobal(
    "showDirectoryPicker",
    vi.fn().mockResolvedValue(pickerRoot),
  );
}

/** Prepare a fresh fake vault root and directory picker for integration tests. */
export function createIntegrationTestContext(): IntegrationTestContext {
  return { pickerRoot: makeFakeRoot() };
}

/** Folder with unrelated files — triggers the blocked-folder dialog on open. */
export async function seedBlockedFolder(
  root: FileSystemDirectoryHandle,
): Promise<void> {
  await writeText(root, "readme.txt", "not a private-notes vault");
}

/** Folder with note markdown but no vault metadata — triggers the repair dialog. */
export async function seedRepairableFolder(
  root: FileSystemDirectoryHandle,
  title = "Sample note",
): Promise<void> {
  await writeText(
    root,
    "notes/2026/05/sample-note-001.md",
    serializeNote(
      {
        id: "note-001",
        title,
        createdAt: "2026-05-17T10:00:00.000Z",
        updatedAt: "2026-05-17T10:00:00.000Z",
      },
      "Body",
    ),
  );
}

/** Pick a folder from Welcome and wait until a vault-open dialog appears. */
export async function pickFolderExpectingOpenDialog(
  result: AppRenderResult,
  dialogTitle: RegExp,
): Promise<void> {
  await result.user.click(
    screen.getByRole("button", { name: /choose folder/i }),
  );
  await waitFor(() => {
    expect(screen.getByRole("dialog", { name: dialogTitle })).toBeInTheDocument();
  });
}
