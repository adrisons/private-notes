import { isNumber, isNumberArray, isObject, isString } from "../../lib/validate";
import type {
  ChunkRecord,
  NoteEmbeddings,
  SemanticManifest,
  StoredChunkRecord,
  StoredNoteEmbeddings,
} from "./types";

/**
 * Validators for the semantic index. Unlike the vault index, these files are a
 * rebuildable cache (ADR-004): a corrupt or stale-schema file is treated as
 * missing and re-embedded, so every validator returns `null` on bad input
 * rather than throwing. That keeps a single damaged embeddings file from
 * breaking search or a full reindex.
 */

/** Validate a parsed `.semantic-index/manifest.json`; `null` if unusable. */
export function parseSemanticManifest(raw: unknown): SemanticManifest | null {
  if (!isObject(raw)) return null;
  if (
    !isNumber(raw.schemaVersion) ||
    !isString(raw.modelId) ||
    !isNumber(raw.dimensions)
  ) {
    return null;
  }
  return raw as unknown as SemanticManifest;
}

function isChunkRecord(v: unknown, dimensions: number): v is ChunkRecord {
  return (
    isObject(v) &&
    isNumber(v.idx) &&
    (v.kind === "title" || v.kind === "body") &&
    isString(v.text) &&
    isNumber(v.offset) &&
    isNumber(v.length) &&
    isNumberArray(v.embedding) &&
    v.embedding.length === dimensions
  );
}

function isStoredChunkRecord(v: unknown): v is StoredChunkRecord {
  return (
    isObject(v) &&
    isNumber(v.idx) &&
    (v.kind === "title" || v.kind === "body") &&
    isString(v.text) &&
    isNumber(v.offset) &&
    isNumber(v.length) &&
    isNumber(v.embeddingOffset) &&
    v.embeddingOffset >= 0
  );
}

function isLegacyEmbeddingsJson(raw: unknown): boolean {
  if (!isObject(raw) || !Array.isArray(raw.chunks) || raw.chunks.length === 0) {
    return false;
  }
  const first = raw.chunks[0];
  return isObject(first) && "embedding" in first;
}

/**
 * Validate a parsed `.semantic-index/notes/<id>.json` with inline vectors
 * (schema ≤ 2). Returns `null` if the shape is wrong.
 */
export function parseLegacyNoteEmbeddings(raw: unknown): NoteEmbeddings | null {
  if (!isObject(raw)) return null;
  if (
    !isString(raw.noteId) ||
    !isString(raw.filePath) ||
    !isString(raw.contentHash) ||
    !isString(raw.modelId) ||
    !isNumber(raw.dimensions) ||
    !isNumber(raw.schemaVersion) ||
    !isString(raw.updatedAt) ||
    !Array.isArray(raw.chunks)
  ) {
    return null;
  }
  const dimensions = raw.dimensions as number;
  if (!raw.chunks.every((c) => isChunkRecord(c, dimensions))) {
    return null;
  }
  const chunks = (
    raw.chunks as unknown as Array<{
      idx: number;
      kind: ChunkRecord["kind"];
      text: string;
      offset: number;
      length: number;
      embedding: number[];
    }>
  ).map((chunk) => ({
    ...chunk,
    embedding: new Float32Array(chunk.embedding),
  }));
  return {
    noteId: raw.noteId as string,
    filePath: raw.filePath as string,
    contentHash: raw.contentHash as string,
    modelId: raw.modelId as string,
    dimensions,
    schemaVersion: raw.schemaVersion as number,
    updatedAt: raw.updatedAt as string,
    chunks,
  };
}

/**
 * Validate the JSON half of a v3 embeddings record (vectors in `.bin`).
 */
export function parseStoredNoteEmbeddings(
  raw: unknown,
): StoredNoteEmbeddings | null {
  if (!isObject(raw)) return null;
  if (
    !isString(raw.noteId) ||
    !isString(raw.filePath) ||
    !isString(raw.contentHash) ||
    !isString(raw.modelId) ||
    !isNumber(raw.dimensions) ||
    !isNumber(raw.schemaVersion) ||
    !isString(raw.updatedAt) ||
    !Array.isArray(raw.chunks)
  ) {
    return null;
  }
  if (!raw.chunks.every((c) => isStoredChunkRecord(c))) {
    return null;
  }
  return raw as unknown as StoredNoteEmbeddings;
}

/**
 * Validate a parsed `.semantic-index/notes/<id>.json`. Returns `null` if the
 * shape is wrong — legacy inline vectors only; v3 sidecar JSON is hydrated in
 * {@link index-fs}.
 */
export function parseNoteEmbeddings(raw: unknown): NoteEmbeddings | null {
  if (isLegacyEmbeddingsJson(raw)) {
    return parseLegacyNoteEmbeddings(raw);
  }
  const stored = parseStoredNoteEmbeddings(raw);
  if (!stored) return null;
  if (stored.chunks.length === 0) {
    return { ...stored, chunks: [] };
  }
  return null;
}
