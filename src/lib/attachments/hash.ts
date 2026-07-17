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

/** Pick the file extension for an attachment, preferring the original. */
export function pickExtension(file: { name: string; type: string }): string {
  const fromName = file.name.includes(".")
    ? file.name.split(".").pop()!.toLowerCase()
    : "";
  if (fromName.length > 0 && fromName.length <= 5) return fromName;
  // Fall back to mime type.
  const m = /image\/(.+)/.exec(file.type);
  if (m) return m[1] === "jpeg" ? "jpg" : m[1]!;
  return "bin";
}
