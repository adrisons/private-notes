import {
  fileExists,
  getDirectory,
  readBytes,
  readText,
  removeFile,
  writeBytes,
  writeText,
} from "../fs/handle";
import {
  hydrateNoteEmbeddings,
  packEmbeddingVectors,
  storedNoteFromRecord,
} from "./embedding-vectors";
import {
  SEMANTIC_PATHS,
  SEMANTIC_SCHEMA_VERSION,
  type ContentHashIndex,
  type NoteEmbeddings,
  type SemanticManifest,
} from "./types";
import {
  parseLegacyNoteEmbeddings,
  parseNoteEmbeddings,
  parseSemanticManifest,
  parseStoredNoteEmbeddings,
} from "./validate";

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

function noteJsonPath(noteId: string): string {
  return `${SEMANTIC_PATHS.notes}/${noteId}.json`;
}

function noteVectorsPath(noteId: string): string {
  return `${SEMANTIC_PATHS.notes}/${noteId}.bin`;
}

async function loadNoteEmbeddingsJson(
  root: FileSystemDirectoryHandle,
  noteId: string,
  raw: unknown,
): Promise<NoteEmbeddings | null> {
  const legacy = parseLegacyNoteEmbeddings(raw);
  if (legacy) return legacy;

  const inline = parseNoteEmbeddings(raw);
  if (inline) return inline;

  const stored = parseStoredNoteEmbeddings(raw);
  if (!stored || stored.chunks.length === 0) {
    return stored ? { ...stored, chunks: [] } : null;
  }

  if (!(await fileExists(root, noteVectorsPath(noteId)))) return null;
  try {
    const vectors = await readBytes(root, noteVectorsPath(noteId));
    return hydrateNoteEmbeddings(stored, vectors);
  } catch {
    return null;
  }
}

export async function readNoteEmbeddings(
  root: FileSystemDirectoryHandle,
  noteId: string,
): Promise<NoteEmbeddings | null> {
  const path = noteJsonPath(noteId);
  if (!(await fileExists(root, path))) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(await readText(root, path));
  } catch {
    return null;
  }
  try {
    return await loadNoteEmbeddingsJson(root, noteId, raw);
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
  const jsonPath = noteJsonPath(data.noteId);
  const vectorsPath = noteVectorsPath(data.noteId);

  if (data.chunks.length === 0) {
    await writeText(root, jsonPath, JSON.stringify(storedNoteFromRecord(data)));
    if (await fileExists(root, vectorsPath)) {
      await removeFile(root, vectorsPath);
    }
    return;
  }

  const packed = packEmbeddingVectors(data.chunks, data.dimensions);
  await writeBytes(root, vectorsPath, packed);
  await writeText(root, jsonPath, JSON.stringify(storedNoteFromRecord(data)));
}

export async function deleteNoteEmbeddings(
  root: FileSystemDirectoryHandle,
  noteId: string,
): Promise<void> {
  const jsonPath = noteJsonPath(noteId);
  if (await fileExists(root, jsonPath)) {
    await removeFile(root, jsonPath);
  }
  const vectorsPath = noteVectorsPath(noteId);
  if (await fileExists(root, vectorsPath)) {
    await removeFile(root, vectorsPath);
  }
}

/** Cheap existence check for a note's vectors file — no read, no parse. */
export async function hasNoteEmbeddings(
  root: FileSystemDirectoryHandle,
  noteId: string,
): Promise<boolean> {
  return fileExists(root, noteJsonPath(noteId));
}

/**
 * Every note id that has an embeddings file, read from directory *names* only.
 * The filename is `<noteId>.json`, so orphan detection never has to open —
 * let alone parse the vectors of — a single file.
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
    const noteId = name.slice(0, -".json".length);
    const file = await (handle as FileSystemFileHandle).getFile();
    let parsed: NoteEmbeddings | null = null;
    try {
      parsed = await loadNoteEmbeddingsJson(
        root,
        noteId,
        JSON.parse(await file.text()),
      );
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
