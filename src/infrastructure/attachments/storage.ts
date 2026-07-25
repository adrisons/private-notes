import { writeBytes, fileExists } from "../fs/handle";
import { PATHS } from "../fs/schema";
import { AttachmentRejectedError } from "../../lib/attachment-errors";
import {
  isAllowedImageMime,
  MAX_ATTACHMENT_BYTES,
} from "./image-policy";
import { pickExtension, sha256Hex } from "./hash";

export { AttachmentRejectedError } from "../../lib/attachment-errors";

export interface StoredAttachment {
  /** Relative path under the vault root, e.g. "attachments/abc123....png". */
  path: string;
  /** SHA-256 of the bytes, used as the file name. */
  hash: string;
  /** File extension (without the dot), derived from the MIME type. */
  ext: string;
}

export interface AttachmentInput {
  name: string;
  type: string;
  size?: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

function rejectUnsupportedType(): never {
  throw new AttachmentRejectedError(
    "This file type is not supported.",
    "Use a PNG, JPEG, GIF, or WebP image.",
  );
}

function rejectOversized(): never {
  throw new AttachmentRejectedError(
    "This image is too large.",
    `Use an image under ${Math.round(MAX_ATTACHMENT_BYTES / (1024 * 1024))} MB.`,
  );
}

/**
 * Persists an attachment into `attachments/<sha256>.<ext>`. Content-addressed
 * naming deduplicates globally — the same bytes share one file across notes.
 */
export async function storeAttachment(
  root: FileSystemDirectoryHandle,
  file: AttachmentInput,
): Promise<StoredAttachment> {
  if (!isAllowedImageMime(file.type)) {
    rejectUnsupportedType();
  }
  if (typeof file.size === "number" && file.size > MAX_ATTACHMENT_BYTES) {
    rejectOversized();
  }
  const buf = await file.arrayBuffer();
  if (buf.byteLength > MAX_ATTACHMENT_BYTES) {
    rejectOversized();
  }
  const hash = await sha256Hex(buf);
  const ext = pickExtension(file);
  const path = `${PATHS.attachments}/${hash}.${ext}`;
  if (!(await fileExists(root, path))) {
    await writeBytes(root, path, buf);
  }
  return { path, hash, ext };
}
