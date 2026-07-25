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
    // One lexical index per open vault, reused across keystrokes. Instead of
    // dropping it whenever the on-disk index changes, we mark the touched notes
    // dirty so the next query patches just those documents in place — an
    // autosave tick no longer costs the next keystroke a full rebuild (ADR-010).
    const dirty = new Set<string>();
    const lexicalCache: LexicalIndexCache = { current: null, dirty };
    return {
      async searchSemantic(query, embedder, options) {
        const api = await getApi();
        return api.searchSemantic(root, query, embedder, options, lexicalCache);
      },
      async reindex(notes, embedder, options) {
        const api = await getApi();
        await api.reindex(root, notes, embedder, options);
        for (const note of notes) dirty.add(note.id);
      },
      async pruneOrphans(noteIds) {
        const api = await getApi();
        await api.pruneOrphans(root, noteIds);
        for (const id of noteIds) dirty.add(id);
      },
    } satisfies SemanticSearch;
  },
};
