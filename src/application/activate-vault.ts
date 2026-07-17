import {
  createAttachmentStore,
  createNoteRepository,
  defaultInfrastructure,
} from "./composition";
import type { InfrastructureDefaults } from "./composition";
import { VaultSession, type VaultStartup } from "./vault-session";

export interface ActivateVaultOptions {
  infra?: InfrastructureDefaults;
}

export interface ActivateVaultResult {
  session: VaultSession;
  startup: VaultStartup;
}

/** Open, reconcile, and bootstrap a vault session for the given folder handle. */
export async function activateVaultSession(
  handle: FileSystemDirectoryHandle,
  options: ActivateVaultOptions = {},
): Promise<ActivateVaultResult> {
  const infra = options.infra ?? defaultInfrastructure;

  await infra.vaultGateway.ensurePermission(handle);
  await infra.vaultGateway.open(handle);
  await infra.vaultGateway.reconcile(handle);
  await infra.handleStore.persist(handle);

  const session = VaultSession.create({
    root: handle,
    notes: createNoteRepository(handle),
    attachments: createAttachmentStore(handle),
  });
  const startup = await session.resolveStartup();
  return { session, startup };
}

export { defaultInfrastructure };
