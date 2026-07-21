/**
 * Schema for the on-disk semantic index. Lives in a sibling folder of `notes/`
 * so it can be shared across devices (e.g. via Dropbox) without touching the
 * notes themselves. Each note gets its own JSON file under
 * `.semantic-index/notes/<noteId>.json` to keep sync conflicts narrow.
 * See docs/adr/004-semantic-index-persistence.md and docs/adr/008-schema-compatibility.md
 */
export const SEMANTIC_SCHEMA_VERSION = 2 as const;

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

/**
 * Titles are embedded on their own as well as prefixed onto every body chunk
 * (ADR-010). A title-only vector lets "Tiradito de pescado" score as a title
 * rather than being averaged away by two hundred words of method.
 */
export type ChunkKind = "title" | "body";

/** Sentinel index for the title chunk — it has no position in the body. */
export const TITLE_CHUNK_IDX = -1;

export interface ChunkRecord {
  /** Chunk index within the note (0-based); `TITLE_CHUNK_IDX` for the title. */
  idx: number;
  /** Which field this vector represents. */
  kind: ChunkKind;
  /** Original chunk text — kept so we can show snippets without re-reading the note. */
  text: string;
  /** Character offset of the chunk inside the body; 0 for a title chunk. */
  offset: number;
  /** Character length of the chunk; 0 for a title chunk, which is not a body range. */
  length: number;
  /** Unit-normalized embedding. Stored as a JSON array (small, deterministic). */
  embedding: number[];
}

export interface NoteEmbeddings {
  noteId: string;
  filePath: string;
  /** SHA-256 of the body the chunks were derived from. */
  contentHash: string;
  modelId: string;
  dimensions: number;
  schemaVersion: number;
  /** ISO timestamp of the last (re)indexing. */
  updatedAt: string;
  chunks: ChunkRecord[];
}
