import {
  createAttachmentStore,
  createNoteRepository,
  createSpaceRepository,
  defaultInfrastructure,
} from "../composition";
import type { InfrastructureDefaults } from "../composition";
import { guardNoteIO } from "../errors";
import { VaultSession, type VaultStartup } from "../vault-session";
import { resolveVaultStartup } from "./resolve-startup";

export interface OpenVaultOptions {
  infra?: InfrastructureDefaults;
}

export interface OpenVaultResult {
  session: VaultSession;
  startup: VaultStartup;
}

/** Open, reconcile, and bootstrap a vault session for the given folder handle. */
export async function openVault(
  handle: FileSystemDirectoryHandle,
  options: OpenVaultOptions = {},
): Promise<OpenVaultResult> {
  const infra = options.infra ?? defaultInfrastructure;

  return guardNoteIO(
    {
      operation: "open-vault",
      module: "application/use-cases/open-vault.ts",
      trace:
        "openVault → vaultGateway.ensurePermission/open/reconcile → VaultSession.create → resolveVaultStartup",
      fixHint:
        "Check fs-vault-gateway.ts, ensureReadWritePermission, and vault layout validation in infrastructure/fs/vault.ts.",
    },
    "Could not open this folder.",
    "Choose the folder again and grant read/write access when prompted.",
    async () => {
      await infra.vaultGateway.ensurePermission(handle);
      await infra.vaultGateway.open(handle);
      await infra.vaultGateway.reconcile(handle);
      await infra.handleStore.persist(handle);

      const session = VaultSession.create({
        root: handle,
        notes: createNoteRepository(handle),
        spaces: createSpaceRepository(handle),
        attachments: createAttachmentStore(handle),
      });
      const startup = await resolveVaultStartup(session);
      return { session, startup };
    },
  );
}

export { defaultInfrastructure };
