import { FsNoteRepository } from "../notes/fs-note-repository";
import { FsAttachmentStore } from "../attachments/fs-attachment-store";
import { fsVaultGateway } from "../fs/fs-vault-gateway";
import { idbVaultHandleStore } from "../fs/idb-vault-handle-store";
import { browserFolderPicker } from "../fs/browser-folder-picker";
import { fsSemanticSearchFactory } from "../search/fs-semantic-search";
import type { VaultGateway } from "../../application/ports/vault-gateway";
import type { VaultHandleStore } from "../../application/ports/vault-handle-store";
import type { FolderPicker } from "../../application/ports/folder-picker";
import type { SemanticSearchFactory } from "../../application/ports/semantic-search";

export interface InfrastructureDefaults {
  vaultGateway: VaultGateway;
  handleStore: VaultHandleStore;
  folderPicker: FolderPicker;
  semanticSearchFactory: SemanticSearchFactory;
}

export const defaultInfrastructure: InfrastructureDefaults = {
  vaultGateway: fsVaultGateway,
  handleStore: idbVaultHandleStore,
  folderPicker: browserFolderPicker,
  semanticSearchFactory: fsSemanticSearchFactory,
};

export function createNoteRepository(root: FileSystemDirectoryHandle) {
  return new FsNoteRepository(root);
}

export function createAttachmentStore(root: FileSystemDirectoryHandle) {
  return new FsAttachmentStore(root);
}

export function createSemanticSearch(root: FileSystemDirectoryHandle) {
  return defaultInfrastructure.semanticSearchFactory.create(root);
}
