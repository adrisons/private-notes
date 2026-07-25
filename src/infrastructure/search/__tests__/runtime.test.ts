import { describe, it, expect } from "vitest";
import { makeFakeRoot } from "../../../test/fakeFs";
import { initializeVault } from "../../fs/vault";
import { createNote } from "../../notes/storage";
import { FsNoteRepository } from "../../notes/fs-note-repository";
import { FakeEmbedder } from "../embedder";
import { loadSearchApi } from "../runtime";

describe("loadSearchApi", () => {
  it("returns reindex, pruneOrphans, and searchSemantic", async () => {
    const api = await loadSearchApi();
    expect(typeof api.reindex).toBe("function");
    expect(typeof api.pruneOrphans).toBe("function");
    expect(typeof api.searchSemantic).toBe("function");
  });

  it("delegates to indexer and search modules", async () => {
    const root = makeFakeRoot();
    await initializeVault(root);
    await createNote({ root }, { title: "Cats", body: "Cats love pasta." });
    const notes = await new FsNoteRepository(root).listForReindex();
    const embedder = new FakeEmbedder();
    const api = await loadSearchApi();

    const result = await api.reindex(root, notes, embedder);
    expect(result.embedded).toBe(1);

    const hits = await api.searchSemantic(root, "pasta", embedder);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.snippet.toLowerCase()).toContain("pasta");
  });
});
