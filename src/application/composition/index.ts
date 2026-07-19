import { registerBackgroundError } from "../errors";
import {
  createAttachmentStore as createInfraAttachmentStore,
  createNoteRepository as createInfraNoteRepository,
  createSemanticSearch as createInfraSemanticSearch,
} from "../../infrastructure/composition/default-deps";

export {
  defaultInfrastructure,
  type InfrastructureDefaults,
} from "../../infrastructure/composition/default-deps";

export function createNoteRepository(root: FileSystemDirectoryHandle) {
  return createInfraNoteRepository(root);
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

export { loadDefaultEmbedder } from "./load-embedder";
