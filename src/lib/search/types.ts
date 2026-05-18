/**
 * Schema for the on-disk semantic index. Lives in a sibling folder of `notes/`
 * so it can be shared across devices (e.g. via Dropbox) without touching the
 * notes themselves. Each note gets its own JSON file under
 * `.semantic-index/notes/<noteId>.json` to keep sync conflicts narrow.
 */
export const SEMANTIC_SCHEMA_VERSION = 1 as const;

export const SEMANTIC_PATHS = {
  root: ".semantic-index",
  manifest: ".semantic-index/manifest.json",
  notes: ".semantic-index/notes",
} as const;

export interface SemanticManifest {
  schemaVersion: number;
  modelId: string;
  dimensions: number;
}

export interface ChunkRecord {
  /** Chunk index within the note (0-based). */
  idx: number;
  /** Original chunk text — kept so we can show snippets without re-reading the note. */
  text: string;
  /** Character offset of the chunk inside the body. */
  offset: number;
  /** Character length of the chunk. */
  length: number;
  /** Unit-normalized embedding. Stored as a JSON array (small, deterministic). */
  embedding: number[];
}

export interface NoteEmbeddings {
  noteId: string;
  filePath: string;
  /** SHA-1 of the body the chunks were derived from. */
  contentHash: string;
  modelId: string;
  dimensions: number;
  schemaVersion: number;
  /** ISO timestamp of the last (re)indexing. */
  updatedAt: string;
  chunks: ChunkRecord[];
}
