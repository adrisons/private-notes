import type { Embedder } from "../ports/embedder";
import type { SemanticSearch } from "../ports/semantic-search";
import type { SearchResultItem } from "../view-models";
import { toSearchResultItems } from "../view-models";

export interface SearchNotesOptions {
  topK?: number;
  minScore?: number;
}

/** Semantic query against the vault index. */
export async function searchNotes(
  search: SemanticSearch,
  embedder: Embedder,
  query: string,
  options: SearchNotesOptions = {},
): Promise<SearchResultItem[]> {
  const hits = await search.searchSemantic(query, embedder, {
    topK: options.topK ?? 8,
    minScore: options.minScore ?? 0.15,
  });
  return toSearchResultItems(hits);
}
