import { defaultInfrastructure } from "../composition";
import type { InfrastructureDefaults } from "../composition";
import { VaultIOError } from "../errors";
import type { VaultRepairResult } from "../ports/vault-gateway";

export interface RepairVaultOptions {
  infra?: InfrastructureDefaults;
}

/** Rebuild vault metadata for a folder that has notes but no manifest. */
export async function repairVault(
  handle: FileSystemDirectoryHandle,
  options: RepairVaultOptions = {},
): Promise<VaultRepairResult> {
  const infra = options.infra ?? defaultInfrastructure;
  const debug = {
    operation: "repair-vault",
    module: "application/use-cases/repair-vault.ts",
    trace:
      "repairVault → vaultGateway.ensurePermission/repair → openVault",
    fixHint:
      "Check infrastructure/fs/repair-vault.ts and note frontmatter under notes/.",
  };

  try {
    await infra.vaultGateway.ensurePermission(handle);
    return await infra.vaultGateway.repair(handle);
  } catch (cause) {
    const message =
      cause instanceof Error ? cause.message : "Could not repair this folder.";
    throw new VaultIOError(
      message,
      debug,
      "Check that the folder contains readable note files under notes/, then try again.",
      cause,
    );
  }
}
