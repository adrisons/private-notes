import { loadSearchApi } from "../../lib/search/runtime";
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
    return {
      async searchSemantic(query, embedder, options) {
        const api = await getApi();
        return api.searchSemantic(root, query, embedder, options);
      },
      async reindex(notes, embedder, options) {
        const api = await getApi();
        await api.reindex(root, notes, embedder, options);
      },
      async pruneOrphans(noteIds) {
        const api = await getApi();
        await api.pruneOrphans(root, noteIds);
      },
    } satisfies SemanticSearch;
  },
};
