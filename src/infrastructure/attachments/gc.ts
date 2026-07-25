import { fileExists, listFilesRecursive, removeFile } from "../fs/handle";
import { PATHS } from "../fs/schema";
import { extractAttachmentPaths } from "./paths";
import { readAttachmentRefs, writeAttachmentRefs } from "./refs";

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

/**
 * Remove attachment blobs not referenced by any live note body. Called on note
 * delete and full reindex — not on every autosave, so a cut-and-undo within
 * one debounce window cannot delete the blob before the reference returns.
 */
export async function sweepOrphanAttachments(
  root: FileSystemDirectoryHandle,
  liveBodies: Iterable<string>,
): Promise<string[]> {
  const referenced = new Set<string>();
  for (const body of liveBodies) {
    for (const path of extractAttachmentPaths(body)) {
      referenced.add(path);
    }
  }

  const onDisk = await listFilesRecursive(root, PATHS.attachments);
  const orphans = onDisk.filter((path) => !referenced.has(path));
  if (orphans.length === 0) return [];

  await deleteOrphanAttachments(root, orphans);

  const refs = await readAttachmentRefs(root);
  let touched = false;
  for (const path of orphans) {
    if (refs.refs[path]) {
      delete refs.refs[path];
      touched = true;
    }
  }
  if (touched) await writeAttachmentRefs(root, refs);

  return orphans;
}
