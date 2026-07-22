import { registerBackgroundError } from "../errors";
import {
  createAttachmentStore as createInfraAttachmentStore,
  createNoteRepository as createInfraNoteRepository,
  createSpaceRepository as createInfraSpaceRepository,
  createSemanticSearch as createInfraSemanticSearch,
  defaultInfrastructure,
} from "../../infrastructure/composition/default-deps";

export {
  defaultInfrastructure,
  type InfrastructureDefaults,
} from "../../infrastructure/composition/default-deps";

export function createNoteRepository(root: FileSystemDirectoryHandle) {
  return createInfraNoteRepository(root);
}

export function createSpaceRepository(root: FileSystemDirectoryHandle) {
  return createInfraSpaceRepository(root);
}

export function createAttachmentStore(root: FileSystemDirectoryHandle) {
  return createInfraAttachmentStore(root, {
    onCacheError: (path, cause) => {
      registerBackgroundError("attachment-cache", cause, {
        operation: "attachment-cache-load",
        module: "infrastructure/attachments/cache.ts",
        trace: `AttachmentURLCache.load("${path}") → FsAttachmentStore.resolve`,
        fixHint:
          "Verify the attachment file exists in the vault and read permission is granted.",
        details: { path },
      });
    },
  });
}

export function createSemanticSearch(root: FileSystemDirectoryHandle) {
  return createInfraSemanticSearch(root);
}

/**
 * Backend-agnostic file I/O for the open vault (ADR-013). Hooks that need raw
 * vault I/O go through this port instead of touching a `FileSystemDirectoryHandle`.
 */
export function createVaultStorage(root: FileSystemDirectoryHandle) {
  return defaultInfrastructure.createVaultStorage(root);
}

export type { VaultStorage, VaultRef } from "../ports/vault-storage";

export { loadDefaultEmbedder } from "./load-embedder";
