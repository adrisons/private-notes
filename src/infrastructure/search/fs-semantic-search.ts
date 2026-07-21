import { loadSearchApi } from "./runtime";
import type { LexicalIndexCache } from "./search";
import type {
  SemanticSearch,
  SemanticSearchFactory,
} from "../../application/ports/semantic-search";

export const fsSemanticSearchFactory: SemanticSearchFactory = {
  create(root) {
    let apiPromise: ReturnType<typeof loadSearchApi> | null = null;
    const getApi = async () => {
      if (!apiPromise) apiPromise = loadSearchApi();
      return apiPromise;
    };
    // One lexical index per open vault, reused across keystrokes and dropped
    // whenever the on-disk index changes underneath it (ADR-010).
    const lexicalCache: LexicalIndexCache = { current: null };
    return {
      async searchSemantic(query, embedder, options) {
        const api = await getApi();
        return api.searchSemantic(root, query, embedder, options, lexicalCache);
      },
      async reindex(notes, embedder, options) {
        const api = await getApi();
        await api.reindex(root, notes, embedder, options);
        lexicalCache.current = null;
      },
      async pruneOrphans(noteIds) {
        const api = await getApi();
        await api.pruneOrphans(root, noteIds);
        lexicalCache.current = null;
      },
    } satisfies SemanticSearch;
  },
};
