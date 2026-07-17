import { writeBytes, fileExists } from "../fs/handle";
import { PATHS } from "../fs/schema";
import { pickExtension, sha256Hex } from "./hash";

export interface StoredAttachment {
  /** Relative path under the vault root, e.g. "attachments/abc123....png". */
  path: string;
  /** SHA-256 of the bytes, used as the file name. */
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
 * Persists an attachment into `attachments/<sha256>.<ext>`. Content-addressed
 * naming deduplicates globally — the same bytes share one file across notes.
 */
export async function storeAttachment(
  root: FileSystemDirectoryHandle,
  file: AttachmentInput,
): Promise<StoredAttachment> {
  const buf = await file.arrayBuffer();
  const hash = await sha256Hex(buf);
  const ext = pickExtension(file);
  const path = `${PATHS.attachments}/${hash}.${ext}`;
  if (!(await fileExists(root, path))) {
    await writeBytes(root, path, buf);
  }
  return { path, hash, ext };
}
