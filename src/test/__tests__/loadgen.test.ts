import { describe, it, expect } from "vitest";
import { buildFakeVault } from "../loadgen";
import { reconcileVault } from "../../infrastructure/notes/reconcile";
import { reindex } from "../../infrastructure/search/indexer";
import { searchSemantic } from "../../infrastructure/search/search";

describe("buildFakeVault", () => {
  it("seeds the requested number of notes into a reconcilable vault", async () => {
    const { root, records } = await buildFakeVault({ notes: 5, chunksPerNote: 2 });
    expect(records).toHaveLength(5);

    const result = await reconcileVault(root);
    expect(result.index.notes).toHaveLength(5);
    // On-disk index already matches the note files, so nothing is rewritten.
    expect(result.changed).toBe(false);
    expect(result.skipped).toEqual([]);
  });

  it("pre-populates embeddings so search returns hits and reindex is a no-op", async () => {
    const { root, reindexNotes, embedder, totalChunks } = await buildFakeVault({
      notes: 4,
      chunksPerNote: 2,
    });
    expect(totalChunks).toBeGreaterThan(0);

    // Every note is already indexed with a matching content hash → all skipped.
    const { embedded, skipped } = await reindex(root, reindexNotes, embedder);
    expect(embedded).toBe(0);
    expect(skipped).toBe(reindexNotes.length);

    const hits = await searchSemantic(root, "project meeting plan", embedder, {
      minScore: 0,
      topK: 8,
    });
    expect(hits.length).toBeGreaterThan(0);
  });

  it("can skip embeddings for cold-reindex scenarios", async () => {
    const { root, reindexNotes, embedder } = await buildFakeVault({
      notes: 3,
      chunksPerNote: 2,
      withEmbeddings: false,
    });

    // No index yet → every note is stale and gets embedded.
    const { embedded, skipped } = await reindex(root, reindexNotes, embedder);
    expect(embedded).toBe(3);
    expect(skipped).toBe(0);
  });

  it("is deterministic for a given seed", async () => {
    const a = await buildFakeVault({ notes: 3, seed: 42 });
    const b = await buildFakeVault({ notes: 3, seed: 42 });
    expect(a.records.map((r) => r.path)).toEqual(b.records.map((r) => r.path));
    expect(a.totalChunks).toBe(b.totalChunks);
  });
});
