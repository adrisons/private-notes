/**
 * Lazy entry point for semantic search. Keeps indexer + search out of the
 * initial bundle until a vault is opened.
 */
export async function loadSearchApi() {
  const [indexer, search] = await Promise.all([
    import("./indexer"),
    import("./search"),
  ]);
  return {
    reindex: indexer.reindex,
    pruneOrphans: indexer.pruneOrphans,
    searchSemantic: search.searchSemantic,
  };
}

export type SearchApi = Awaited<ReturnType<typeof loadSearchApi>>;
