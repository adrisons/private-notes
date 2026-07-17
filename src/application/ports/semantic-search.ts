import type { NoteRecord } from "../../lib/fs/types";
import type { Embedder } from "../../lib/search/embedder";
import type { SearchHit } from "../../lib/search/search";

export interface SemanticSearchOptions {
  topK?: number;
  minScore?: number;
  maxPerNote?: number;
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
    notes: NoteRecord[],
    embedder: Embedder,
    options?: ReindexOptions,
  ): Promise<void>;
  pruneOrphans(noteIds: string[]): Promise<void>;
}

export interface SemanticSearchFactory {
  create(root: FileSystemDirectoryHandle): SemanticSearch;
}
