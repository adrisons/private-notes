import { FsNoteRepository } from "../notes/fs-note-repository";
import { FsSpaceRepository } from "../spaces/fs-space-repository";
import {
  FsAttachmentStore,
  type FsAttachmentStoreOptions,
} from "../attachments/fs-attachment-store";
import { webInfrastructure } from "../platform/web/web-infrastructure";
import type { VaultGateway } from "../../application/ports/vault-gateway";
import type { VaultHandleStore } from "../../application/ports/vault-handle-store";
import type { FolderPicker } from "../../application/ports/folder-picker";
import type { SemanticSearchFactory } from "../../application/ports/semantic-search";
import type { VaultStorage } from "../../application/ports/vault-storage";

export interface InfrastructureDefaults {
  vaultGateway: VaultGateway;
  handleStore: VaultHandleStore;
  folderPicker: FolderPicker;
  semanticSearchFactory: SemanticSearchFactory;
  createVaultStorage: (root: FileSystemDirectoryHandle) => VaultStorage;
}

// The active platform backend. Today only the web (File System Access) bundle
// exists; a future OPFS/native backend would be selected here (ADR-013).
export const defaultInfrastructure: InfrastructureDefaults = {
  vaultGateway: webInfrastructure.vaultGateway,
  handleStore: webInfrastructure.handleStore,
  folderPicker: webInfrastructure.folderPicker,
  semanticSearchFactory: webInfrastructure.semanticSearchFactory,
  createVaultStorage: webInfrastructure.createVaultStorage,
};

export function createNoteRepository(root: FileSystemDirectoryHandle) {
  return new FsNoteRepository(root);
}

export function createSpaceRepository(root: FileSystemDirectoryHandle) {
  return new FsSpaceRepository(root);
}

export function createAttachmentStore(
  root: FileSystemDirectoryHandle,
  options?: FsAttachmentStoreOptions,
) {
  return new FsAttachmentStore(root, options);
}

export function createSemanticSearch(root: FileSystemDirectoryHandle) {
  return defaultInfrastructure.semanticSearchFactory.create(root);
}
