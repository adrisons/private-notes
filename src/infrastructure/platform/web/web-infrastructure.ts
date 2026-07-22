/**
 * Aggregates the web (File System Access) platform adapters in one place
 * (ADR-013). `application/composition/` imports the web backend from here, so
 * the concrete adapters have a single, discoverable boundary and a future
 * `platform/opfs/` sibling can mirror this shape.
 */
import { fsVaultGateway } from "../../fs/fs-vault-gateway";
import { idbVaultHandleStore } from "../../fs/idb-vault-handle-store";
import { browserFolderPicker } from "../../fs/browser-folder-picker";
import { fsSemanticSearchFactory } from "../../search/fs-semantic-search";
import { createFsaVaultStorage } from "./fsa-vault-storage";
import type { VaultGateway } from "../../../application/ports/vault-gateway";
import type { VaultHandleStore } from "../../../application/ports/vault-handle-store";
import type { FolderPicker } from "../../../application/ports/folder-picker";
import type { SemanticSearchFactory } from "../../../application/ports/semantic-search";
import type { VaultStorage } from "../../../application/ports/vault-storage";

export interface WebInfrastructure {
  vaultGateway: VaultGateway;
  handleStore: VaultHandleStore;
  folderPicker: FolderPicker;
  semanticSearchFactory: SemanticSearchFactory;
  createVaultStorage: (root: FileSystemDirectoryHandle) => VaultStorage;
}

export const webInfrastructure: WebInfrastructure = {
  vaultGateway: fsVaultGateway,
  handleStore: idbVaultHandleStore,
  folderPicker: browserFolderPicker,
  semanticSearchFactory: fsSemanticSearchFactory,
  createVaultStorage: createFsaVaultStorage,
};

export { createFsaVaultStorage, FsaVaultStorage } from "./fsa-vault-storage";
export { registerServiceWorker } from "./pwa/register-sw";
