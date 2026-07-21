import { DEFAULT_RELATIVE_CUTOFF } from "../../domain";
import type { Embedder } from "../ports/embedder";
import type { SemanticSearch } from "../ports/semantic-search";
import type { SearchResultItem } from "../view-models";
import { toSearchResultItems } from "../view-models";

export interface SearchNotesOptions {
  topK?: number;
  minScore?: number;
  relativeCutoff?: number;
}

/** Rows the palette can show without scrolling into guesswork. */
const DEFAULT_TOP_K = 8;

/**
 * Content relevance for a query. Title and space signals are added later, by
 * the ranker that also holds the in-memory note list — this stage only knows
 * what is in the index.
 *
 * `minScore` is deliberately not defaulted here: what counts as "too weak to
 * show" is a property of the embedding model, so it comes from the embedder
 * unless a caller overrides it. The relative cutoff is the model-independent
 * half of the same job and is why a query with two good answers now shows
 * two instead of `topK` least-bad ones.
 */
export async function searchNotes(
  search: SemanticSearch,
  embedder: Embedder,
  query: string,
  options: SearchNotesOptions = {},
): Promise<SearchResultItem[]> {
  const hits = await search.searchSemantic(query, embedder, {
    topK: options.topK ?? DEFAULT_TOP_K,
    minScore: options.minScore,
    relativeCutoff: options.relativeCutoff ?? DEFAULT_RELATIVE_CUTOFF,
  });
  return toSearchResultItems(hits);
}
