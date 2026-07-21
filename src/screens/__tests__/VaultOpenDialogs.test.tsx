import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VaultOpenDialogs } from "../VaultOpenDialogs";
import type { UseVaultSessionResult } from "../../application/hooks/useVaultSession";

function buildVault(overrides: Partial<UseVaultSessionResult>): UseVaultSessionResult {
  return {
    session: null,
    noteItems: [],
    current: null,
    setCurrent: vi.fn(),
    error: null,
    setError: vi.fn(),
    openIssue: null,
    repairing: false,
    booting: false,
    handlePick: vi.fn(),
    repairAndOpen: vi.fn(),
    dismissOpenIssue: vi.fn(),
    chooseAnotherFolder: vi.fn(),
    refreshSummaries: vi.fn(),
    ...overrides,
  };
}

describe("VaultOpenDialogs", () => {
  it("renders the blocked-folder dialog", () => {
    render(
      <VaultOpenDialogs
        vault={buildVault({
          openIssue: {
            kind: "blocked",
            message: "This folder is not a private-notes vault.",
            fixHint: "Choose an empty folder to create a new vault.",
          },
        })}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: /cannot open this folder/i });
    expect(within(dialog).getByText(/not a private-notes vault/i)).toBeInTheDocument();
    expect(
      within(dialog).getByText(/choose an empty folder to create a new vault/i),
    ).toBeInTheDocument();
  });

  it("renders the repair dialog with the note count", () => {
    render(
      <VaultOpenDialogs
        vault={buildVault({
          openIssue: {
            kind: "repair",
            handle: {} as FileSystemDirectoryHandle,
            noteCount: 12,
          },
        })}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: /repair this folder/i });
    expect(within(dialog).getByText(/12 note files/i)).toBeInTheDocument();
  });

  it("calls repairAndOpen from the repair dialog primary action", async () => {
    const user = userEvent.setup();
    const repairAndOpen = vi.fn();
    render(
      <VaultOpenDialogs
        vault={buildVault({
          openIssue: {
            kind: "repair",
            handle: {} as FileSystemDirectoryHandle,
            noteCount: 1,
          },
          repairAndOpen,
        })}
      />,
    );

    await user.click(screen.getByRole("button", { name: /repair and open/i }));
    expect(repairAndOpen).toHaveBeenCalledTimes(1);
  });

  it("calls chooseAnotherFolder from the blocked dialog primary action", async () => {
    const user = userEvent.setup();
    const chooseAnotherFolder = vi.fn();
    render(
      <VaultOpenDialogs
        vault={buildVault({
          openIssue: {
            kind: "blocked",
            message: "This folder is not a private-notes vault.",
            fixHint: "Choose another folder.",
          },
          chooseAnotherFolder,
        })}
      />,
    );

    await user.click(screen.getByRole("button", { name: /choose another folder/i }));
    expect(chooseAnotherFolder).toHaveBeenCalledTimes(1);
  });
});
