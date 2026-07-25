/** Allowed image MIME types for vault attachments (SEC-5). */
export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
] as const;

export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

const MIME_TO_EXT: Record<AllowedImageMime, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

/** Maximum attachment size accepted on ingest (10 MiB). */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export function isAllowedImageMime(type: string): type is AllowedImageMime {
  return (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(type);
}

/** File extension for a vetted MIME type, or null when unsupported. */
export function extensionForMime(type: string): string | null {
  if (!isAllowedImageMime(type)) return null;
  return MIME_TO_EXT[type];
}
