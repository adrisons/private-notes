import { writeBytes, fileExists } from "../fs/handle";
import { PATHS } from "../fs/types";
import { pickExtension, sha1Hex } from "./hash";

export interface StoredAttachment {
  /** Relative path under the vault root, e.g. "attachments/01H.../abc.png". */
  path: string;
  /** SHA-1 of the bytes, used as the file name. */
  hash: string;
  /** File extension (without the dot), preserved from the original name. */
  ext: string;
}

export interface AttachmentInput {
  name: string;
  type: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}

/**
 * Persists an attachment into `attachments/<noteId>/<sha1>.<ext>`. Content-
 * addressed naming means uploading the same image twice is a no-op.
 */
export async function storeAttachment(
  root: FileSystemDirectoryHandle,
  noteId: string,
  file: AttachmentInput,
): Promise<StoredAttachment> {
  const buf = await file.arrayBuffer();
  const hash = await sha1Hex(buf);
  const ext = pickExtension(file);
  const path = `${PATHS.attachments}/${noteId}/${hash}.${ext}`;
  if (!(await fileExists(root, path))) {
    await writeBytes(root, path, buf);
  }
  return { path, hash, ext };
}
