import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { noteId } from "../../../domain";
import type { VaultSession } from "../../vault-session";
import { useVaultSession } from "../useVaultSession";

const mocks = vi.hoisted(() => ({
  openVault: vi.fn(),
  handleLoad: vi.fn(),
  handleClear: vi.fn(),
  hasPermission: vi.fn(),
  pick: vi.fn(),
}));

vi.mock("../../../lib/compatibility", () => ({
  getCompatibility: () => ({ supported: true, reasons: [], webgpu: false }),
}));

vi.mock("../../composition", () => ({
  defaultInfrastructure: {
    handleStore: {
      load: mocks.handleLoad,
      clear: mocks.handleClear,
      persist: vi.fn(),
    },
    vaultGateway: {
      hasPermission: mocks.hasPermission,
    },
    folderPicker: {
      pick: mocks.pick,
    },
  },
}));

vi.mock("../../use-cases/open-vault", () => ({
  openVault: mocks.openVault,
}));

function fakeSession(): VaultSession {
  return {
    dispose: vi.fn(),
    listSummaries: vi.fn().mockResolvedValue([
      { id: noteId("n1"), title: "Note", updatedAt: "2026-05-17T10:00:00.000Z" },
    ]),
  } as unknown as VaultSession;
}

describe("useVaultSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.handleLoad.mockResolvedValue(null);
    mocks.hasPermission.mockResolvedValue(true);
    mocks.pick.mockResolvedValue(null);
  });

  it("finishes booting when no vault handle is stored", async () => {
    const { result } = renderHook(() => useVaultSession());

    await waitFor(() => {
      expect(result.current.booting).toBe(false);
    });
    expect(result.current.session).toBeNull();
    expect(mocks.openVault).not.toHaveBeenCalled();
  });

  it("activates the vault when a stored handle has permission", async () => {
    const handle = {} as FileSystemDirectoryHandle;
    const session = fakeSession();
    mocks.handleLoad.mockResolvedValue(handle);
    mocks.openVault.mockResolvedValue({
      session,
      startup: {
        summaries: [{ id: noteId("n1"), title: "Hello", updatedAt: "2026-05-17T10:00:00.000Z" }],
        current: { id: "n1", title: "Hello", body: "Body", savedAt: null },
      },
    });

    const { result } = renderHook(() => useVaultSession());

    await waitFor(() => {
      expect(result.current.booting).toBe(false);
      expect(result.current.session).toBe(session);
    });
    expect(result.current.noteItems).toHaveLength(1);
    expect(result.current.current?.title).toBe("Hello");
    expect(mocks.openVault).toHaveBeenCalledWith(handle);
  });

  it("calls flushBeforeSwitch before activating a picked folder", async () => {
    const handle = {} as FileSystemDirectoryHandle;
    const session = fakeSession();
    const flush = vi.fn();
    mocks.pick.mockResolvedValue(handle);
    mocks.openVault.mockResolvedValue({
      session,
      startup: { summaries: [], current: null },
    });

    const { result } = renderHook(() =>
      useVaultSession({ flushBeforeSwitch: flush }),
    );

    await waitFor(() => expect(result.current.booting).toBe(false));

    await act(async () => {
      await result.current.handlePick();
    });

    expect(flush).toHaveBeenCalledTimes(1);
    expect(mocks.openVault).toHaveBeenCalledWith(handle);
  });

  it("surfaces picker errors", async () => {
    mocks.pick.mockRejectedValue(new Error("Permission denied"));

    const { result } = renderHook(() => useVaultSession());

    await waitFor(() => expect(result.current.booting).toBe(false));

    await act(async () => {
      await result.current.handlePick();
    });

    expect(result.current.error).toBe(
      "Permission denied Try again. If it keeps failing, reopen the folder.",
    );
  });

  it("refreshSummaries reloads note items from the active session", async () => {
    const session = fakeSession();
    mocks.handleLoad.mockResolvedValue({} as FileSystemDirectoryHandle);
    mocks.openVault.mockResolvedValue({
      session,
      startup: { summaries: [], current: null },
    });

    const { result } = renderHook(() => useVaultSession());

    await waitFor(() => expect(result.current.session).toBe(session));
    expect(result.current.noteItems).toHaveLength(0);

    await act(async () => {
      await result.current.refreshSummaries();
    });

    expect(session.listSummaries).toHaveBeenCalled();
    expect(result.current.noteItems).toHaveLength(1);
    expect(result.current.noteItems[0]?.title).toBe("Note");
  });
});
