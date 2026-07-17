import { fileExists, removeFile } from "../fs/handle";

/** Delete attachment blobs whose ref lists were cleared. Best-effort per path. */
export async function deleteOrphanAttachments(
  root: FileSystemDirectoryHandle,
  paths: Iterable<string>,
): Promise<void> {
  for (const path of paths) {
    if (!(await fileExists(root, path))) continue;
    await removeFile(root, path);
  }
}
