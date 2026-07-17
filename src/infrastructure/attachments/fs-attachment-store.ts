import { AttachmentURLCache } from "./cache";
import { addRef } from "./refs";
import { storeAttachment } from "./storage";
import type { AttachmentStore } from "../../application/ports/attachment-store";
import type { NoteId } from "../../domain";

export class FsAttachmentStore implements AttachmentStore {
  private readonly root: FileSystemDirectoryHandle;
  private readonly cache: AttachmentURLCache;

  constructor(root: FileSystemDirectoryHandle) {
    this.root = root;
    this.cache = new AttachmentURLCache(root);
  }

  async store(file: File) {
    const result = await storeAttachment(this.root, file);
    return { path: result.path };
  }

  async addRef(noteId: NoteId, path: string) {
    await addRef(this.root, noteId, path);
  }

  resolve(path: string) {
    return this.cache.resolve(path);
  }

  invalidate(paths: string[]) {
    for (const path of paths) {
      this.cache.invalidate(path);
    }
  }

  dispose() {
    this.cache.dispose();
  }
}
