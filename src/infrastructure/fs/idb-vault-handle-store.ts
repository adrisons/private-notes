import * as vaultHandleStore from "../../lib/fs/vault-handle-store";
import type { VaultHandleStore } from "../../application/ports/vault-handle-store";

export const idbVaultHandleStore: VaultHandleStore = {
  load: () => vaultHandleStore.loadVaultHandle(),
  persist: (handle) => vaultHandleStore.persistVaultHandle(handle),
  clear: () => vaultHandleStore.clearVaultHandle(),
};
