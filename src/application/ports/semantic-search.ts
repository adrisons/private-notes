import type { NoteId } from "../../domain";
import type { Embedder } from "./embedder";
import type { SearchHit } from "./search-hit";

/** Minimal note payload for embedding — no on-disk index row shape. */
export interface ReindexNoteInput {
  id: NoteId;
  title: string;
  body: string;
}

export interface SemanticSearchOptions {
  topK?: number;
  /** Cosine floor; defaults to the active model's own floor. */
  minScore?: number;
  /** Share of the best score a hit must keep to survive, measured from the floor. */
  relativeCutoff?: number;
}

export interface ReindexOptions {
  onProgress?: (progress: { done: number; total: number }) => void;
}

export interface SemanticSearch {
  searchSemantic(
    query: string,
    embedder: Embedder,
    options?: SemanticSearchOptions,
  ): Promise<SearchHit[]>;
  reindex(
    notes: ReindexNoteInput[],
    embedder: Embedder,
    options?: ReindexOptions,
  ): Promise<void>;
  pruneOrphans(noteIds: string[]): Promise<void>;
}

export interface SemanticSearchFactory {
  create(root: FileSystemDirectoryHandle): SemanticSearch;
}

export type { Embedder, SearchHit };
