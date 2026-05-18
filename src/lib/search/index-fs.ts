import {
  fileExists,
  getDirectory,
  readText,
  writeText,
} from "../fs/handle";
import {
  SEMANTIC_PATHS,
  SEMANTIC_SCHEMA_VERSION,
  type NoteEmbeddings,
  type SemanticManifest,
} from "./types";

/** Read the semantic manifest if present. */
export async function readSemanticManifest(
  root: FileSystemDirectoryHandle,
): Promise<SemanticManifest | null> {
  if (!(await fileExists(root, SEMANTIC_PATHS.manifest))) return null;
  const text = await readText(root, SEMANTIC_PATHS.manifest);
  return JSON.parse(text) as SemanticManifest;
}

/** Write or replace the semantic manifest. */
export async function writeSemanticManifest(
  root: FileSystemDirectoryHandle,
  manifest: SemanticManifest,
): Promise<void> {
  await getDirectory(root, SEMANTIC_PATHS.root, { create: true });
  await writeText(
    root,
    SEMANTIC_PATHS.manifest,
    JSON.stringify(manifest, null, 2),
  );
}

function notePath(noteId: string): string {
  return `${SEMANTIC_PATHS.notes}/${noteId}.json`;
}

export async function readNoteEmbeddings(
  root: FileSystemDirectoryHandle,
  noteId: string,
): Promise<NoteEmbeddings | null> {
  if (!(await fileExists(root, notePath(noteId)))) return null;
  const raw = await readText(root, notePath(noteId));
  return JSON.parse(raw) as NoteEmbeddings;
}

export async function writeNoteEmbeddings(
  root: FileSystemDirectoryHandle,
  data: NoteEmbeddings,
): Promise<void> {
  await getDirectory(root, SEMANTIC_PATHS.notes, { create: true });
  await writeText(root, notePath(data.noteId), JSON.stringify(data));
}

export async function deleteNoteEmbeddings(
  root: FileSystemDirectoryHandle,
  noteId: string,
): Promise<void> {
  if (!(await fileExists(root, notePath(noteId)))) return;
  const dir = await getDirectory(root, SEMANTIC_PATHS.notes);
  await dir.removeEntry(`${noteId}.json`);
}

/**
 * Iterate every embeddings file. Yields one note at a time so callers can
 * stream rather than load everything into memory at once.
 */
export async function* iterateNoteEmbeddings(
  root: FileSystemDirectoryHandle,
): AsyncGenerator<NoteEmbeddings> {
  let dir: FileSystemDirectoryHandle;
  try {
    dir = await getDirectory(root, SEMANTIC_PATHS.notes);
  } catch {
    return;
  }
  for await (const [name, handle] of dir.entries()) {
    if (handle.kind !== "file" || !name.endsWith(".json")) continue;
    const file = await (handle as FileSystemFileHandle).getFile();
    yield JSON.parse(await file.text()) as NoteEmbeddings;
  }
}

/** Reset the semantic index — used when the active model or schema changes. */
export async function clearSemanticIndex(
  root: FileSystemDirectoryHandle,
): Promise<void> {
  let dir: FileSystemDirectoryHandle;
  try {
    dir = await getDirectory(root, SEMANTIC_PATHS.notes);
  } catch {
    return;
  }
  const names: string[] = [];
  for await (const [name] of dir.entries()) names.push(name);
  for (const name of names) await dir.removeEntry(name);
}

export function isCurrentSchema(version: number): boolean {
  return version === SEMANTIC_SCHEMA_VERSION;
}
