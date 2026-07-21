import { describe, it, expect, vi } from "vitest";
import { VaultIOError } from "../errors";
import { repairVault } from "../use-cases/repair-vault";
import type { VaultGateway } from "../ports/vault-gateway";

describe("repairVault use case", () => {
  it("wraps gateway repair failures as VaultIOError", async () => {
    const handle = {} as FileSystemDirectoryHandle;
    const gateway: VaultGateway = {
      ensurePermission: vi.fn().mockResolvedValue(undefined),
      hasPermission: vi.fn(),
      open: vi.fn(),
      reconcile: vi.fn(),
      assessRepair: vi.fn(),
      repair: vi.fn().mockRejectedValue(new Error("No note files found under notes/.")),
    };

    await expect(
      repairVault(handle, {
        infra: {
          vaultGateway: gateway,
          handleStore: { load: vi.fn(), persist: vi.fn(), clear: vi.fn() },
          folderPicker: { pick: vi.fn() },
          semanticSearchFactory: { create: vi.fn() },
        },
      }),
    ).rejects.toBeInstanceOf(VaultIOError);
  });
});
