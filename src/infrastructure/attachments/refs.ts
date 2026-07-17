import { readText, writeText, fileExists } from "../fs/handle";
import { PATHS } from "../fs/schema";
import {
  VaultDataError,
  isNumber,
  isObject,
  isStringArray,
  parseJson,
} from "../../lib/validate";
import { extractAttachmentPaths } from "./paths";

export const ATTACHMENT_REFS_VERSION = 1 as const;

export interface AttachmentRefsIndex {
  version: typeof ATTACHMENT_REFS_VERSION;
  refs: Record<string, string[]>;
}

export function buildEmptyAttachmentRefs(): AttachmentRefsIndex {
  return { version: ATTACHMENT_REFS_VERSION, refs: {} };
}

/** Validate parsed `attachment-refs.json`; throws on structural problems. */
export function parseAttachmentRefs(
  raw: unknown,
  file: string,
): AttachmentRefsIndex {
  if (!isObject(raw)) {
    throw new VaultDataError("refs index is not a JSON object", file);
  }
  if (!isNumber(raw.version)) {
    throw new VaultDataError("refs index is missing a numeric version", file);
  }
  if (!isObject(raw.refs)) {
    throw new VaultDataError("refs.refs is not an object", file);
  }
  for (const [path, noteIds] of Object.entries(raw.refs)) {
    if (!isStringArray(noteIds)) {
      throw new VaultDataError(`refs.refs["${path}"] is not a string array`, file);
    }
  }
  return raw as unknown as AttachmentRefsIndex;
}

export async function readAttachmentRefs(
  root: FileSystemDirectoryHandle,
): Promise<AttachmentRefsIndex> {
  if (!(await fileExists(root, PATHS.attachmentRefs))) {
    return buildEmptyAttachmentRefs();
  }
  const text = await readText(root, PATHS.attachmentRefs);
  return parseAttachmentRefs(
    parseJson(text, PATHS.attachmentRefs),
    PATHS.attachmentRefs,
  );
}

export async function writeAttachmentRefs(
  root: FileSystemDirectoryHandle,
  index: AttachmentRefsIndex,
): Promise<void> {
  await writeText(root, PATHS.attachmentRefs, JSON.stringify(index, null, 2));
}

/** Register that `noteId` references `path`. Idempotent per note/path pair. */
export async function addRef(
  root: FileSystemDirectoryHandle,
  noteId: string,
  path: string,
): Promise<void> {
  const index = await readAttachmentRefs(root);
  const noteIds = index.refs[path] ?? [];
  if (noteIds.includes(noteId)) return;
  index.refs[path] = [...noteIds, noteId];
  await writeAttachmentRefs(root, index);
}

/** Register refs for every attachment path in `markdown` (e.g. after duplicate). */
export async function addRefsForBody(
  root: FileSystemDirectoryHandle,
  noteId: string,
  markdown: string,
): Promise<void> {
  for (const path of extractAttachmentPaths(markdown)) {
    await addRef(root, noteId, path);
  }
}

/**
 * Drop `noteId` from the given attachment paths. Returns paths whose ref
 * list became empty (candidates for GC).
 */
export async function dropNoteRefs(
  root: FileSystemDirectoryHandle,
  noteId: string,
  paths: Iterable<string>,
): Promise<string[]> {
  const index = await readAttachmentRefs(root);
  const emptied: string[] = [];
  for (const path of paths) {
    const noteIds = index.refs[path];
    if (!noteIds) continue;
    const next = noteIds.filter((id) => id !== noteId);
    if (next.length === 0) {
      delete index.refs[path];
      emptied.push(path);
    } else {
      index.refs[path] = next;
    }
  }
  await writeAttachmentRefs(root, index);
  return emptied;
}

/**
 * Sync refs after a note body edit. Returns paths that lost their last ref.
 */
export async function syncRefsForBodyChange(
  root: FileSystemDirectoryHandle,
  noteId: string,
  oldBody: string,
  newBody: string,
): Promise<string[]> {
  const oldPaths = extractAttachmentPaths(oldBody);
  const newPaths = extractAttachmentPaths(newBody);
  const index = await readAttachmentRefs(root);
  const emptied: string[] = [];

  for (const path of oldPaths) {
    if (newPaths.has(path)) continue;
    const noteIds = index.refs[path];
    if (!noteIds) continue;
    const next = noteIds.filter((id) => id !== noteId);
    if (next.length === 0) {
      delete index.refs[path];
      emptied.push(path);
    } else {
      index.refs[path] = next;
    }
  }

  for (const path of newPaths) {
    if (oldPaths.has(path)) continue;
    const noteIds = index.refs[path] ?? [];
    if (!noteIds.includes(noteId)) {
      index.refs[path] = [...noteIds, noteId];
    }
  }

  await writeAttachmentRefs(root, index);
  return emptied;
}
