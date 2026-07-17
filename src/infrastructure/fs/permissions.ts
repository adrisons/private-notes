/**
 * File System Access API permission helpers. Callers should obtain
 * readwrite access while a user gesture is still active (e.g. right after
 * `showDirectoryPicker`). Background work later in the session relies on
 * the permission having been granted during that pick.
 */
export async function ensureReadWritePermission(
  root: FileSystemDirectoryHandle,
): Promise<void> {
  const opts = { mode: "readwrite" as const };
  const current = await root.queryPermission(opts);
  if (current === "granted") return;
  const requested = await root.requestPermission(opts);
  if (requested !== "granted") {
    throw new Error("Folder permission was not granted.");
  }
}

/** True when we can read/write without showing a permission prompt. */
export async function hasReadWritePermission(
  root: FileSystemDirectoryHandle,
): Promise<boolean> {
  return (await root.queryPermission({ mode: "readwrite" })) === "granted";
}
