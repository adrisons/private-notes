import type { NoteId } from "../../domain";

export interface StoredAttachment {
  path: string;
}

export interface AttachmentStore {
  store(file: File): Promise<StoredAttachment>;
  addRef(noteId: NoteId, path: string): Promise<void>;
  resolve(path: string): Promise<string | null>;
  invalidate(paths: string[]): void;
  dispose(): void;
}
