import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { noteId } from "../../../domain";
import type { VaultSession } from "../../vault-session";
import { useVaultSession } from "../useVaultSession";

const mocks = vi.hoisted(() => ({
  openVault: vi.fn(),
  repairVault: vi.fn(),
  handleLoad: vi.fn(),
  handleClear: vi.fn(),
  hasPermission: vi.fn(),
  assessRepair: vi.fn(),
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
      assessRepair: mocks.assessRepair,
    },
    folderPicker: {
      pick: mocks.pick,
    },
  },
}));

vi.mock("../../use-cases/open-vault", () => ({
  openVault: mocks.openVault,
}));

vi.mock("../../use-cases/repair-vault", () => ({
  repairVault: mocks.repairVault,
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
    mocks.assessRepair.mockResolvedValue({ eligible: false, noteCount: 0 });
    mocks.repairVault.mockResolvedValue({ noteCount: 1, spaceCount: 0, skipped: [] });
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
        current: {
          id: "n1",
          title: "Hello",
          body: "Body",
          createdAt: "2026-05-17T10:00:00.000Z",
          updatedAt: "2026-05-17T10:00:00.000Z",
          savedAt: null,
          spaceIds: [],
        },
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
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mocks.pick.mockRejectedValue(new Error("Permission denied"));

    const { result } = renderHook(() => useVaultSession());

    await waitFor(() => expect(result.current.booting).toBe(false));

    await act(async () => {
      await result.current.handlePick();
    });

    expect(result.current.error).toBe(
      "Permission denied Try again. If it keeps failing, reopen the folder.",
    );
    consoleError.mockRestore();
  });

  it("offers repair when a folder has notes but no vault metadata", async () => {
    const { VaultIncompatibleError } = await import("../../../lib/validate");
    const { VaultIOError } = await import("../../errors");
    const handle = {} as FileSystemDirectoryHandle;
    mocks.pick.mockResolvedValue(handle);
    mocks.openVault.mockRejectedValue(
      new VaultIOError(
        "This folder is not a private-notes vault.",
        {
          operation: "open-vault",
          module: "application/use-cases/open-vault.ts",
          trace: "test",
          fixHint: "test",
        },
        "Choose an empty folder or one that already contains your notes.",
        new VaultIncompatibleError(
          "not-a-vault",
          "Folder is not empty and is not a private-notes vault.",
        ),
      ),
    );
    mocks.assessRepair.mockResolvedValue({ eligible: true, noteCount: 12 });

    const { result } = renderHook(() => useVaultSession());

    await waitFor(() => expect(result.current.booting).toBe(false));

    await act(async () => {
      await result.current.handlePick();
    });

    expect(result.current.openIssue).toEqual({
      kind: "repair",
      handle,
      noteCount: 12,
    });
    expect(result.current.error).toBeNull();
  });

  it("shows a blocked-folder issue when the folder is not a vault and cannot be repaired", async () => {
    const { VaultIncompatibleError } = await import("../../../lib/validate");
    const { VaultIOError } = await import("../../errors");
    const handle = {} as FileSystemDirectoryHandle;
    mocks.pick.mockResolvedValue(handle);
    mocks.openVault.mockRejectedValue(
      new VaultIOError(
        "This folder is not a private-notes vault.",
        {
          operation: "open-vault",
          module: "application/use-cases/open-vault.ts",
          trace: "test",
          fixHint: "test",
        },
        "Choose an empty folder or one that already contains your notes.",
        new VaultIncompatibleError("not-a-vault", "not a vault"),
      ),
    );
    mocks.assessRepair.mockResolvedValue({ eligible: false, noteCount: 0 });

    const { result } = renderHook(() => useVaultSession());

    await waitFor(() => expect(result.current.booting).toBe(false));

    await act(async () => {
      await result.current.handlePick();
    });

    expect(result.current.openIssue).toEqual({
      kind: "blocked",
      message: "This folder is not a private-notes vault.",
      fixHint:
        "Choose an empty folder to create a new vault, or one that already contains note files under notes/.",
    });
    expect(result.current.session).toBeNull();
  });

  it("clears the active session when switching to an invalid folder", async () => {
    const session = fakeSession();
    mocks.handleLoad.mockResolvedValue({} as FileSystemDirectoryHandle);
    mocks.openVault.mockResolvedValue({
      session,
      startup: { summaries: [], current: null },
    });

    const { result } = renderHook(() => useVaultSession());
    await waitFor(() => expect(result.current.session).toBe(session));

    const { VaultIncompatibleError } = await import("../../../lib/validate");
    const { VaultIOError } = await import("../../errors");
    const badHandle = {} as FileSystemDirectoryHandle;
    mocks.pick.mockResolvedValue(badHandle);
    mocks.openVault.mockRejectedValueOnce(
      new VaultIOError(
        "This folder is not a private-notes vault.",
        {
          operation: "open-vault",
          module: "application/use-cases/open-vault.ts",
          trace: "test",
          fixHint: "test",
        },
        "Choose an empty folder or one that already contains your notes.",
        new VaultIncompatibleError("not-a-vault", "not a vault"),
      ),
    );
    mocks.assessRepair.mockResolvedValue({ eligible: false, noteCount: 0 });

    await act(async () => {
      await result.current.handlePick();
    });

    expect(result.current.session).toBeNull();
    expect(result.current.openIssue?.kind).toBe("blocked");
  });

  it("repairAndOpen rebuilds metadata then activates the vault", async () => {
    const { VaultIncompatibleError } = await import("../../../lib/validate");
    const { VaultIOError } = await import("../../errors");
    const handle = {} as FileSystemDirectoryHandle;
    const session = fakeSession();
    mocks.pick.mockResolvedValue(handle);
    mocks.openVault
      .mockRejectedValueOnce(
        new VaultIOError(
          "This folder is not a private-notes vault.",
          {
            operation: "open-vault",
            module: "application/use-cases/open-vault.ts",
            trace: "test",
            fixHint: "test",
          },
          "Choose an empty folder or one that already contains your notes.",
          new VaultIncompatibleError("not-a-vault", "not a vault"),
        ),
      )
      .mockResolvedValueOnce({
        session,
        startup: { summaries: [], current: null },
      });
    mocks.assessRepair.mockResolvedValue({ eligible: true, noteCount: 3 });

    const { result } = renderHook(() => useVaultSession());

    await waitFor(() => expect(result.current.booting).toBe(false));

    await act(async () => {
      await result.current.handlePick();
    });
    await act(async () => {
      await result.current.repairAndOpen();
    });

    expect(mocks.repairVault).toHaveBeenCalledWith(handle);
    expect(result.current.session).toBe(session);
    expect(result.current.openIssue).toBeNull();
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
