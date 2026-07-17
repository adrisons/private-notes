import {
  createAttachmentStore,
  createNoteRepository,
  defaultInfrastructure,
} from "../composition";
import type { InfrastructureDefaults } from "../composition";
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

  await infra.vaultGateway.ensurePermission(handle);
  await infra.vaultGateway.open(handle);
  await infra.vaultGateway.reconcile(handle);
  await infra.handleStore.persist(handle);

  const session = VaultSession.create({
    root: handle,
    notes: createNoteRepository(handle),
    attachments: createAttachmentStore(handle),
  });
  const startup = await resolveVaultStartup(session);
  return { session, startup };
}

export { defaultInfrastructure };
