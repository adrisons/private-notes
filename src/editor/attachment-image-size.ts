/** Keep aligned with `--attachment-max-width` in design-tokens.css (35rem). */
export const ATTACHMENT_IMAGE_MAX_WIDTH = 560;
export const ATTACHMENT_IMAGE_MIN_WIDTH = 120;

export function clampAttachmentImageWidth(
  width: number,
  max = ATTACHMENT_IMAGE_MAX_WIDTH,
): number {
  return Math.max(
    ATTACHMENT_IMAGE_MIN_WIDTH,
    Math.min(Math.round(width), Math.round(max)),
  );
}

export async function defaultAttachmentImageWidth(
  file: File,
): Promise<number> {
  try {
    const naturalWidth = await readNaturalWidth(file);
    return clampAttachmentImageWidth(naturalWidth);
  } catch {
    return ATTACHMENT_IMAGE_MAX_WIDTH;
  }
}

function readNaturalWidth(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img.naturalWidth);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image dimensions"));
    };

    img.src = url;
  });
}
