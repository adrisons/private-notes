import {
  fileExists,
  getDirectory,
  readText,
  writeText,
} from "../fs/handle";
import {
  SEMANTIC_PATHS,
  SEMANTIC_SCHEMA_VERSION,
  type ContentHashIndex,
  type NoteEmbeddings,
  type SemanticManifest,
} from "./types";
import { parseNoteEmbeddings, parseSemanticManifest } from "./validate";

/** Read the semantic manifest if present. */
export async function readSemanticManifest(
  root: FileSystemDirectoryHandle,
): Promise<SemanticManifest | null> {
  if (!(await fileExists(root, SEMANTIC_PATHS.manifest))) return null;
  const text = await readText(root, SEMANTIC_PATHS.manifest);
  try {
    return parseSemanticManifest(JSON.parse(text));
  } catch {
    // Unreadable manifest is treated as absent; the index rebuilds.
    return null;
  }
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
  try {
    return parseNoteEmbeddings(JSON.parse(raw));
  } catch {
    // Corrupt embeddings file — treat as missing so it gets re-embedded.
    return null;
  }
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

/** Cheap existence check for a note's vectors file — no read, no parse. */
export async function hasNoteEmbeddings(
  root: FileSystemDirectoryHandle,
  noteId: string,
): Promise<boolean> {
  return fileExists(root, notePath(noteId));
}

/**
 * Every note id that has an embeddings file, read from directory *names* only.
 * The filename is `<noteId>.json`, so orphan detection never has to open —
 * let alone JSON-parse the vectors of — a single file.
 */
export async function listNoteEmbeddingIds(
  root: FileSystemDirectoryHandle,
): Promise<string[]> {
  let dir: FileSystemDirectoryHandle;
  try {
    dir = await getDirectory(root, SEMANTIC_PATHS.notes);
  } catch {
    return [];
  }
  const ids: string[] = [];
  for await (const [name, handle] of dir.entries()) {
    if (handle.kind === "file" && name.endsWith(".json")) {
      ids.push(name.slice(0, -".json".length));
    }
  }
  return ids;
}

/** File name of the content-hash hint, relative to the index root. */
const CONTENT_HASHES_FILE = "content-hashes.json";

/** Read the `noteId → contentHash` hint map; empty when absent or corrupt. */
export async function readContentHashes(
  root: FileSystemDirectoryHandle,
): Promise<ContentHashIndex> {
  if (!(await fileExists(root, SEMANTIC_PATHS.contentHashes))) return {};
  try {
    const parsed: unknown = JSON.parse(
      await readText(root, SEMANTIC_PATHS.contentHashes),
    );
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const out: ContentHashIndex = {};
    for (const [id, hash] of Object.entries(parsed)) {
      if (typeof hash === "string") out[id] = hash;
    }
    return out;
  } catch {
    // A corrupt hint file is treated as absent: the scan falls back to reading
    // the per-note files, which are authoritative, and rewrites the hint.
    return {};
  }
}

/** Write or replace the `noteId → contentHash` hint map. */
export async function writeContentHashes(
  root: FileSystemDirectoryHandle,
  hashes: ContentHashIndex,
): Promise<void> {
  await getDirectory(root, SEMANTIC_PATHS.root, { create: true });
  await writeText(
    root,
    SEMANTIC_PATHS.contentHashes,
    JSON.stringify(hashes),
  );
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
    let parsed: NoteEmbeddings | null = null;
    try {
      parsed = parseNoteEmbeddings(JSON.parse(await file.text()));
    } catch {
      // Skip a corrupt file; a reindex regenerates it.
    }
    if (parsed) yield parsed;
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

  // The content-hash hints describe vectors that no longer exist. Drop them so
  // the next reindex cannot fast-skip a note against a stale hint.
  try {
    const rootDir = await getDirectory(root, SEMANTIC_PATHS.root);
    await rootDir.removeEntry(CONTENT_HASHES_FILE);
  } catch {
    // Absent hint file is fine.
  }
}

export function isCurrentSchema(version: number): boolean {
  return version === SEMANTIC_SCHEMA_VERSION;
}
