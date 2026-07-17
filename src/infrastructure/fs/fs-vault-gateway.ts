import * as permissions from "../../lib/fs/permissions";
import * as vault from "../../lib/fs/vault";
import * as reconcile from "../../lib/notes/reconcile";
import type { VaultGateway } from "../../application/ports/vault-gateway";

export const fsVaultGateway: VaultGateway = {
  ensurePermission: (handle) => permissions.ensureReadWritePermission(handle),
  hasPermission: (handle) => permissions.hasReadWritePermission(handle),
  open: async (handle) => {
    await vault.openOrInitialize(handle);
  },
  reconcile: async (handle) => {
    await reconcile.reconcileVault(handle);
  },
};
