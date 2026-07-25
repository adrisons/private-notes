import { describe, it, expect } from "vitest";
import { makeFakeRoot } from "../../../test/fakeFs";
import { initializeVault } from "../../fs/vault";
import { FakeEmbedder, type Embedder } from "../embedder";
import { deleteNoteEmbeddings, writeNoteEmbeddings } from "../index-fs";
import { searchSemantic, type LexicalIndexCache } from "../search";
import { SEMANTIC_SCHEMA_VERSION, TITLE_CHUNK_IDX } from "../types";

async function setupRoot() {
  const root = makeFakeRoot();
  await initializeVault(root);
  return root;
}

interface ChunkSpec {
  text: string;
  embedding: number[];
  kind?: "title" | "body";
}

function makeRecord(
  noteId: string,
  chunks: ChunkSpec[],
  overrides: Partial<{
    modelId: string;
    dimensions: number;
  }> = {},
) {
  const embedder = new FakeEmbedder();
  return {
    noteId,
    filePath: `notes/2026/01/${noteId}.md`,
    contentHash: noteId,
    modelId: overrides.modelId ?? embedder.id,
    dimensions: overrides.dimensions ?? embedder.dimensions,
    schemaVersion: SEMANTIC_SCHEMA_VERSION,
    updatedAt: "2026-05-17T10:00:00Z",
    chunks: chunks.map((c, idx) => ({
      idx: c.kind === "title" ? TITLE_CHUNK_IDX : idx,
      kind: c.kind ?? ("body" as const),
      text: c.text,
      offset: 0,
      length: c.text.length,
      embedding: new Float32Array(c.embedding),
    })),
  };
}

describe("searchSemantic", () => {
  it("returns an empty list when the embedder yields no query vector", async () => {
    const root = await setupRoot();
    const emptyEmbedder: Embedder = {
      id: "empty",
      dimensions: 32,
      embed: async () => [],
    };
    expect(await searchSemantic(root, "query", emptyEmbedder)).toEqual([]);
  });

  it("returns an empty list for a blank query without touching the model", async () => {
    const root = await setupRoot();
    let calls = 0;
    const counting: Embedder = {
      id: "counting",
      dimensions: 32,
      embed: async (texts) => {
        calls++;
        return texts.map(() => new Array(32).fill(0));
      },
    };
    expect(await searchSemantic(root, "   ", counting)).toEqual([]);
    expect(calls).toBe(0);
  });

  it("skips records with a mismatched modelId or dimensions", async () => {
    const root = await setupRoot();
    const embedder = new FakeEmbedder("active-model", 32);
    const [qVec] = await embedder.embed(["target"]);
    await writeNoteEmbeddings(
      root,
      makeRecord("stale", [{ text: "target words", embedding: qVec! }], {
        modelId: "old-model",
      }),
    );
    expect(await searchSemantic(root, "target", embedder)).toEqual([]);
  });

  it("still finds a note whose only literal match is below the cosine floor", async () => {
    const root = await setupRoot();
    const embedder = new FakeEmbedder();
    const [qVec] = await embedder.embed(["cats"]);
    const orthogonal = qVec!.map((_, i) => (i === 0 ? 1 : 0));
    await writeNoteEmbeddings(
      root,
      makeRecord("n1", [{ text: "cats and dogs", embedding: orthogonal }]),
    );
    // Dense scoring rejects it; the inverted index does not, which is the
    // whole point of fusing the two.
    const hits = await searchSemantic(root, "cats", embedder, {
      minScore: 0.99,
    });
    expect(hits.map((h) => h.noteId)).toEqual(["n1"]);
    expect(hits[0]?.matchKind).toBe("text");
  });

  it("drops a note that neither signal supports", async () => {
    const root = await setupRoot();
    const embedder = new FakeEmbedder();
    const [qVec] = await embedder.embed(["cats"]);
    const orthogonal = qVec!.map((_, i) => (i === 0 ? 1 : 0));
    await writeNoteEmbeddings(
      root,
      makeRecord("n1", [{ text: "unrelated topic", embedding: orthogonal }]),
    );
    expect(await searchSemantic(root, "cats", embedder, { minScore: 0.5 })).toEqual(
      [],
    );
  });

  it("returns at most one hit per note", async () => {
    const root = await setupRoot();
    const embedder = new FakeEmbedder();
    const [qVec] = await embedder.embed(["alpha"]);
    await writeNoteEmbeddings(
      root,
      makeRecord("n1", [
        { text: "alpha one", embedding: qVec! },
        { text: "alpha two", embedding: qVec! },
        { text: "alpha three", embedding: qVec! },
      ]),
    );
    const hits = await searchSemantic(root, "alpha", embedder);
    expect(hits.filter((h) => h.noteId === "n1")).toHaveLength(1);
  });

  it("limits global results with topK", async () => {
    const root = await setupRoot();
    const embedder = new FakeEmbedder();
    const [qVec] = await embedder.embed(["shared"]);
    for (let i = 0; i < 5; i++) {
      await writeNoteEmbeddings(
        root,
        makeRecord(`note-${i}`, [{ text: `shared chunk ${i}`, embedding: qVec! }]),
      );
    }
    const hits = await searchSemantic(root, "shared", embedder, { topK: 2 });
    expect(hits).toHaveLength(2);
  });

  it("sorts by fused score and propagates snippet metadata", async () => {
    const root = await setupRoot();
    const embedder = new FakeEmbedder();
    const [strong] = await embedder.embed(["pasta tomato sauce"]);
    const [weak] = await embedder.embed(["rockets orbit"]);
    await writeNoteEmbeddings(
      root,
      makeRecord("cooking", [{ text: "pasta tomato sauce", embedding: strong! }]),
    );
    await writeNoteEmbeddings(
      root,
      makeRecord("space", [{ text: "rockets orbit", embedding: weak! }]),
    );
    const hits = await searchSemantic(root, "pasta tomato", embedder);
    expect(hits[0]?.noteId).toBe("cooking");
    expect(hits[0]?.snippet).toBe("pasta tomato sauce");
    expect(hits[0]?.offset).toBe(0);
    expect(hits[0]?.length).toBe("pasta tomato sauce".length);
    expect(hits[0]!.score).toBeGreaterThanOrEqual(hits[1]?.score ?? 0);
  });

  it("finds a note by its title chunk alone", async () => {
    const root = await setupRoot();
    const embedder = new FakeEmbedder();
    const [titleVec] = await embedder.embed(["Chermoula para pescado"]);
    const [bodyVec] = await embedder.embed(["cilantro comino y ajo"]);
    await writeNoteEmbeddings(
      root,
      makeRecord("chermoula", [
        { text: "Chermoula para pescado", embedding: titleVec!, kind: "title" },
        { text: "cilantro comino y ajo", embedding: bodyVec! },
      ]),
    );
    const hits = await searchSemantic(root, "chermoula", embedder);
    expect(hits.map((h) => h.noteId)).toEqual(["chermoula"]);
    expect(hits[0]?.chunkIdx).toBe(TITLE_CHUNK_IDX);
  });

  it("prefers a snippet that contains the query term", async () => {
    const root = await setupRoot();
    const embedder = new FakeEmbedder();
    const [qVec] = await embedder.embed(["chorizo"]);
    await writeNoteEmbeddings(
      root,
      makeRecord("lentejas", [
        { text: "Lentejas de la abuela", embedding: qVec!, kind: "title" },
        { text: "sofrie cebolla y zanahoria", embedding: qVec! },
        { text: "anade el chorizo y el laurel", embedding: qVec! },
      ]),
    );
    const [hit] = await searchSemantic(root, "chorizo", embedder);
    expect(hit?.snippet).toContain("chorizo");
  });

  it("keeps only what is competitive with the top hit", async () => {
    const root = await setupRoot();
    const embedder = new FakeEmbedder();
    const [qVec] = await embedder.embed(["alpha"]);
    const halfway = qVec!.map((v, i) => (i % 2 === 0 ? v : 0));
    await writeNoteEmbeddings(
      root,
      makeRecord("strong", [{ text: "alpha", embedding: qVec! }]),
    );
    await writeNoteEmbeddings(
      root,
      makeRecord("weak", [{ text: "unrelated", embedding: halfway }]),
    );
    const withoutCutoff = await searchSemantic(root, "alpha", embedder);
    const withCutoff = await searchSemantic(root, "alpha", embedder, {
      relativeCutoff: 0.6,
    });
    expect(withoutCutoff.map((h) => h.noteId)).toContain("weak");
    expect(withCutoff.map((h) => h.noteId)).toEqual(["strong"]);
  });

  it("does not let the cutoff hand the win to a note that merely ranks in both lists", async () => {
    const root = await setupRoot();
    const embedder = new FakeEmbedder();
    const [qVec] = await embedder.embed(["alpha beta"]);
    const [halfVec] = await embedder.embed(["alpha"]);
    // `both` scores higher on vectors but carries one query term; `lexical`
    // carries both. The cutoff used to prune `lexical` out of the dense list,
    // after which fusion rewarded `both` for appearing in two lists.
    await writeNoteEmbeddings(
      root,
      makeRecord("both", [{ text: "alpha only", embedding: qVec! }]),
    );
    await writeNoteEmbeddings(
      root,
      makeRecord("lexical", [{ text: "alpha beta together", embedding: halfVec! }]),
    );
    const hits = await searchSemantic(root, "alpha beta", embedder, {
      relativeCutoff: 0.6,
    });
    expect(hits[0]?.noteId).toBe("lexical");
  });

  it("falls back to the model's own floor", async () => {
    const root = await setupRoot();
    const base = new FakeEmbedder();
    const [qVec] = await base.embed(["alpha"]);
    const strict: Embedder = {
      id: base.id,
      dimensions: base.dimensions,
      minScore: 0.99,
      embed: (texts) => base.embed(texts),
    };
    await writeNoteEmbeddings(
      root,
      makeRecord("n1", [{ text: "beta gamma", embedding: qVec!.map(() => 0) }]),
    );
    expect(await searchSemantic(root, "alpha", strict)).toEqual([]);
  });

  it("populates the lexical cache on a miss and reuses it without re-tokenising", async () => {
    const root = await setupRoot();
    const embedder = new FakeEmbedder();
    const [qVec] = await embedder.embed(["pescado"]);
    await writeNoteEmbeddings(
      root,
      makeRecord("tiradito", [
        { text: "Tiradito de pescado", embedding: qVec!, kind: "title" },
        { text: "lomo en laminas finas", embedding: qVec! },
      ]),
    );

    const cache: LexicalIndexCache = { current: null };
    const first = await searchSemantic(root, "pescado", embedder, {}, cache);
    expect(first.map((h) => h.noteId)).toEqual(["tiradito"]);
    const built = cache.current;
    expect(built).not.toBeNull();

    // A second query keeps the exact same index instance (no rebuild) and still
    // resolves against it.
    const second = await searchSemantic(root, "laminas", embedder, {}, cache);
    expect(cache.current).toBe(built);
    expect(second.map((h) => h.noteId)).toEqual(["tiradito"]);
  });

  it("serves lexical hits from a stale cache until the session clears it", async () => {
    const root = await setupRoot();
    const embedder = new FakeEmbedder();
    const [qVec] = await embedder.embed(["ceviche"]);
    // Orthogonal so dense scoring rejects it under a strict floor: the note can
    // only ever surface through the lexical index.
    const orthogonal = qVec!.map((_, i) => (i === 0 ? 1 : 0));
    await writeNoteEmbeddings(
      root,
      makeRecord("tiradito", [{ text: "Tiradito de pescado", embedding: orthogonal }]),
    );

    // Prime the cache, then add a note the cache does not know about.
    const cache: LexicalIndexCache = { current: null };
    await searchSemantic(root, "pescado", embedder, { minScore: 0.99 }, cache);
    await writeNoteEmbeddings(
      root,
      makeRecord("ceviche", [{ text: "Ceviche de pescado", embedding: orthogonal }]),
    );

    // "ceviche" is dense-rejected and invisible to the stale lexical index —
    // proving the index is genuinely reused, not rebuilt per query.
    const stale = await searchSemantic(root, "ceviche", embedder, { minScore: 0.99 }, cache);
    expect(stale.map((h) => h.noteId)).not.toContain("ceviche");

    // Clearing the cache (what reindex/pruneOrphans do) rebuilds it, and now
    // the literal match lands.
    cache.current = null;
    const fresh = await searchSemantic(root, "ceviche", embedder, { minScore: 0.99 }, cache);
    expect(fresh.map((h) => h.noteId)).toContain("ceviche");
  });

  it("patches a dirty note into the cached index without rebuilding it", async () => {
    const root = await setupRoot();
    const embedder = new FakeEmbedder();
    const [qVec] = await embedder.embed(["pescado"]);
    // Orthogonal so notes can only ever surface through the lexical index.
    const orthogonal = qVec!.map((_, i) => (i === 0 ? 1 : 0));
    // Enough notes that one dirty note stays under the rebuild threshold.
    for (let i = 0; i < 5; i++) {
      await writeNoteEmbeddings(
        root,
        makeRecord(`filler-${i}`, [{ text: `nota ${i}`, embedding: orthogonal }]),
      );
    }
    await writeNoteEmbeddings(
      root,
      makeRecord("target", [{ text: "Tiradito de pescado", embedding: orthogonal }]),
    );

    const cache: LexicalIndexCache = { current: null, dirty: new Set() };
    await searchSemantic(root, "pescado", embedder, { minScore: 0.99 }, cache);
    const built = cache.current;
    expect(built).not.toBeNull();

    // Rewrite the note (what reindex does on disk) and mark just it dirty.
    await writeNoteEmbeddings(
      root,
      makeRecord("target", [{ text: "Ceviche de corvina", embedding: orthogonal }]),
    );
    cache.dirty!.add("target");

    const hits = await searchSemantic(root, "ceviche", embedder, { minScore: 0.99 }, cache);
    // Same instance, patched in place — not rebuilt.
    expect(cache.current).toBe(built);
    expect(hits.map((h) => h.noteId)).toEqual(["target"]);
    expect(cache.dirty!.size).toBe(0);

    // The old term is gone from the patched index.
    const stale = await searchSemantic(root, "pescado", embedder, { minScore: 0.99 }, cache);
    expect(stale.map((h) => h.noteId)).not.toContain("target");
  });

  it("drops a dirty note whose record vanished, still patching in place", async () => {
    const root = await setupRoot();
    const embedder = new FakeEmbedder();
    const [qVec] = await embedder.embed(["pescado"]);
    const orthogonal = qVec!.map((_, i) => (i === 0 ? 1 : 0));
    for (let i = 0; i < 5; i++) {
      await writeNoteEmbeddings(
        root,
        makeRecord(`filler-${i}`, [{ text: `nota ${i}`, embedding: orthogonal }]),
      );
    }
    await writeNoteEmbeddings(
      root,
      makeRecord("target", [{ text: "Tiradito de pescado", embedding: orthogonal }]),
    );

    const cache: LexicalIndexCache = { current: null, dirty: new Set() };
    await searchSemantic(root, "pescado", embedder, { minScore: 0.99 }, cache);
    const built = cache.current;

    await deleteNoteEmbeddings(root, "target");
    cache.dirty!.add("target");

    const hits = await searchSemantic(root, "pescado", embedder, { minScore: 0.99 }, cache);
    expect(cache.current).toBe(built);
    expect(hits.map((h) => h.noteId)).not.toContain("target");
    expect(cache.dirty!.size).toBe(0);
  });

  it("rebuilds instead of patching when the dirty set rivals the corpus", async () => {
    const root = await setupRoot();
    const embedder = new FakeEmbedder();
    const [qVec] = await embedder.embed(["pescado"]);
    const orthogonal = qVec!.map((_, i) => (i === 0 ? 1 : 0));
    await writeNoteEmbeddings(
      root,
      makeRecord("a", [{ text: "Pescado", embedding: orthogonal }]),
    );
    await writeNoteEmbeddings(
      root,
      makeRecord("b", [{ text: "Pollo", embedding: orthogonal }]),
    );

    const cache: LexicalIndexCache = { current: null, dirty: new Set() };
    await searchSemantic(root, "pescado", embedder, { minScore: 0.99 }, cache);
    const built = cache.current;

    // Half the corpus dirty → a fresh build is cheaper than patching each.
    await writeNoteEmbeddings(
      root,
      makeRecord("a", [{ text: "Ceviche", embedding: orthogonal }]),
    );
    cache.dirty!.add("a");

    const hits = await searchSemantic(root, "ceviche", embedder, { minScore: 0.99 }, cache);
    expect(cache.current).not.toBe(built);
    expect(hits.map((h) => h.noteId)).toEqual(["a"]);
    expect(cache.dirty!.size).toBe(0);
  });

  it("sends the model's query prefix, not the raw query", async () => {
    const root = await setupRoot();
    const seen: string[] = [];
    const prefixed: Embedder = {
      id: "prefixed",
      dimensions: 4,
      prefixes: { query: "query: ", passage: "passage: " },
      embed: async (texts) => {
        seen.push(...texts);
        return texts.map(() => [1, 0, 0, 0]);
      },
    };
    await searchSemantic(root, "pescado", prefixed);
    expect(seen).toEqual(["query: pescado"]);
  });
});
