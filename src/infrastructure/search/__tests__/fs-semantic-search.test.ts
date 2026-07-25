import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeFakeRoot } from "../../../test/fakeFs";
import { initializeVault } from "../../../infrastructure/fs/vault";
import { createNote } from "../../../infrastructure/notes/storage";
import { FsNoteRepository } from "../../../infrastructure/notes/fs-note-repository";
import { FakeEmbedder } from "../../../infrastructure/search/embedder";
import { fsSemanticSearchFactory } from "../fs-semantic-search";

const loadSearchApi = vi.hoisted(() => vi.fn());

vi.mock("../runtime", () => ({
  loadSearchApi,
}));

describe("fsSemanticSearchFactory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates search and reindex to the lazy runtime API", async () => {
    const root = makeFakeRoot();
    await initializeVault(root);
    await createNote({ root }, { title: "Cats", body: "Cats love pasta." });
    const notes = await new FsNoteRepository(root).listForReindex();
    const embedder = new FakeEmbedder();

    const api = {
      searchSemantic: vi.fn().mockResolvedValue([{ noteId: "n1", snippet: "pasta" }]),
      reindex: vi.fn().mockResolvedValue({ embedded: 1, skipped: 0 }),
      pruneOrphans: vi.fn().mockResolvedValue(0),
    };
    loadSearchApi.mockResolvedValue(api);

    const search = fsSemanticSearchFactory.create(root);

    await search.reindex(notes, embedder);
    expect(api.reindex).toHaveBeenCalledWith(root, notes, embedder, undefined);

    await search.searchSemantic("pasta", embedder, { topK: 3 });
    expect(api.searchSemantic).toHaveBeenCalledWith(
      root,
      "pasta",
      embedder,
      { topK: 3 },
      // A per-session lexical-index cache is threaded through so keystrokes
      // reuse the index instead of rebuilding it; reindex marks notes dirty in
      // it rather than dropping it (ADR-010).
      { current: null, dirty: expect.any(Set) },
    );

    await search.pruneOrphans(["n1"]);
    expect(api.pruneOrphans).toHaveBeenCalledWith(root, ["n1"]);

    expect(loadSearchApi).toHaveBeenCalledTimes(1);
  });
});
