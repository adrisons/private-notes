/**
 * SHA-256 hex digest using the Web Crypto API. Content-addressed paths rely
 * on collision resistance; SHA-1 is deprecated for that use (ADR-006).
 */
export async function sha256Hex(
  data: ArrayBuffer | Uint8Array,
): Promise<string> {
  // Copy into a fresh ArrayBuffer so we always pass a non-shared buffer.
  const view =
    data instanceof Uint8Array
      ? data
      : new Uint8Array(data);
  const copy = new ArrayBuffer(view.byteLength);
  new Uint8Array(copy).set(view);
  const digest = await crypto.subtle.digest("SHA-256", copy);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

import { extensionForMime } from "./image-policy";

/** Pick the file extension from a vetted MIME type (never the original name). */
export function pickExtension(file: { type: string }): string {
  const ext = extensionForMime(file.type);
  if (!ext) {
    throw new Error(`Unsupported attachment MIME type: ${file.type || "(empty)"}`);
  }
  return ext;
}
