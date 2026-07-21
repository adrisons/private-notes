import * as permissions from "./permissions";
import * as vault from "./vault";
import * as reconcile from "../notes/reconcile";
import * as repair from "./repair-vault";
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
  assessRepair: (handle) => repair.assessVaultRepair(handle),
  repair: (handle) => repair.repairVault(handle),
};
