/**
 * Thin helpers over the File System Access API. They operate on the user's
 * chosen root directory (a `FileSystemDirectoryHandle`).
 *
 * All paths passed here are POSIX-style relative paths ("notes/2026/foo.md").
 */

function splitPath(path: string): string[] {
  return path.split("/").filter((s) => s.length > 0);
}

export async function getDirectory(
  root: FileSystemDirectoryHandle,
  path: string,
  options: { create?: boolean } = {},
): Promise<FileSystemDirectoryHandle> {
  let dir = root;
  for (const segment of splitPath(path)) {
    dir = await dir.getDirectoryHandle(segment, { create: options.create });
  }
  return dir;
}

export async function getFile(
  root: FileSystemDirectoryHandle,
  path: string,
  options: { create?: boolean } = {},
): Promise<FileSystemFileHandle> {
  const segments = splitPath(path);
  if (segments.length === 0) {
    throw new Error("Empty path");
  }
  const fileName = segments[segments.length - 1]!;
  const parentSegments = segments.slice(0, -1);
  let dir = root;
  for (const segment of parentSegments) {
    dir = await dir.getDirectoryHandle(segment, { create: options.create });
  }
  return dir.getFileHandle(fileName, { create: options.create });
}

export async function readText(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<string> {
  const file = await getFile(root, path);
  const blob = await file.getFile();
  return blob.text();
}

export async function writeText(
  root: FileSystemDirectoryHandle,
  path: string,
  text: string,
): Promise<void> {
  const file = await getFile(root, path, { create: true });
  const writable = await file.createWritable();
  await writable.write(text);
  await writable.close();
}

export async function writeBytes(
  root: FileSystemDirectoryHandle,
  path: string,
  data: ArrayBuffer | Uint8Array<ArrayBuffer> | Blob,
): Promise<void> {
  const file = await getFile(root, path, { create: true });
  const writable = await file.createWritable();
  // Cast to bypass the ArrayBufferLike vs ArrayBuffer friction in the DOM lib;
  // all three branches are valid FileSystemWriteChunkType values at runtime.
  await writable.write(data as unknown as FileSystemWriteChunkType);
  await writable.close();
}

export async function fileExists(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<boolean> {
  try {
    await getFile(root, path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns true when the directory contains no entries other than entries that
 * are safe to coexist with (currently: macOS `.DS_Store`).
 */
export async function isEffectivelyEmpty(
  root: FileSystemDirectoryHandle,
): Promise<boolean> {
  const allowedNoise = new Set([".DS_Store"]);
  // The iterator is async; we exit as soon as we find a single disallowed entry.
  for await (const [name] of root.entries()) {
    if (!allowedNoise.has(name)) return false;
  }
  return true;
}
