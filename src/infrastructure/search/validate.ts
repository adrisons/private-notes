import { isNumber, isNumberArray, isObject, isString } from "../../lib/validate";
import type { ChunkRecord, NoteEmbeddings, SemanticManifest } from "./types";

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
    isString(v.text) &&
    isNumber(v.offset) &&
    isNumber(v.length) &&
    isNumberArray(v.embedding) &&
    v.embedding.length === dimensions
  );
}

/**
 * Validate a parsed `.semantic-index/notes/<id>.json`. Returns `null` if the
 * shape is wrong or an embedding's length disagrees with `dimensions` — both
 * mean the file must be re-embedded rather than trusted.
 */
export function parseNoteEmbeddings(raw: unknown): NoteEmbeddings | null {
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
  if (!raw.chunks.every((c) => isChunkRecord(c, raw.dimensions as number))) {
    return null;
  }
  return raw as unknown as NoteEmbeddings;
}
