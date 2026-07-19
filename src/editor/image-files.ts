const IMAGE_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

/** Image files carried by a drag-and-drop or paste DataTransfer. */
export function imageFilesFromDataTransfer(
  dataTransfer: DataTransfer | null,
): File[] {
  if (!dataTransfer?.files?.length) return [];
  return Array.from(dataTransfer.files).filter((file) =>
    file.type.startsWith("image/"),
  );
}

export function hasImageFilesInDataTransfer(
  dataTransfer: DataTransfer | null,
): boolean {
  return imageFilesFromDataTransfer(dataTransfer).length > 0;
}

/**
 * Collect pasted image files from the clipboard. Browsers expose screenshots
 * as `items`, file copies as `files`, and some apps only as HTML with inline
 * `data:` URLs — ProseMirror would paste the latter verbatim unless we
 * intercept and store the bytes in the vault instead.
 */
export function imageFilesFromClipboard(
  dataTransfer: DataTransfer | null,
): File[] {
  if (!dataTransfer) return [];

  const fromFiles = imageFilesFromDataTransfer(dataTransfer);
  if (fromFiles.length > 0) return fromFiles;

  const fromItems: File[] = [];
  for (const item of dataTransfer.items ?? []) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) fromItems.push(file);
    }
  }
  if (fromItems.length > 0) return fromItems;

  return imageFilesFromHtml(dataTransfer.getData("text/html"));
}

export function dataUrlToFile(
  dataUrl: string,
  fallbackName = "pasted-image.png",
): File | null {
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(dataUrl);
  if (!match) return null;

  const [, mime, encoded] = match;
  if (!mime.startsWith("image/")) return null;

  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  const extension = IMAGE_EXT[mime] ?? "png";
  const name = fallbackName.includes(".")
    ? fallbackName
    : `${fallbackName.replace(/\.[^.]+$/, "")}.${extension}`;

  return new File([bytes], name, { type: mime });
}

function imageFilesFromHtml(html: string): File[] {
  if (!html) return [];

  const doc = new DOMParser().parseFromString(html, "text/html");
  const files: File[] = [];

  doc.querySelectorAll('img[src^="data:"]').forEach((img, index) => {
    const src = img.getAttribute("src");
    if (!src) return;
    const file = dataUrlToFile(src, `pasted-image-${index + 1}.png`);
    if (file) files.push(file);
  });

  return files;
}
