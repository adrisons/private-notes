import { describe, it, expect } from "vitest";
import { makeFakeRoot } from "../../../test/fakeFs";
import { initializeVault } from "../../fs/vault";
import { FakeEmbedder, type Embedder } from "../embedder";
import { writeNoteEmbeddings } from "../index-fs";
import { searchSemantic } from "../search";
import { SEMANTIC_SCHEMA_VERSION } from "../types";

async function setupRoot() {
  const root = makeFakeRoot();
  await initializeVault(root);
  return root;
}

function makeRecord(
  noteId: string,
  chunks: { text: string; embedding: number[] }[],
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
      idx,
      text: c.text,
      offset: 0,
      length: c.text.length,
      embedding: c.embedding,
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

  it("filters hits below minScore", async () => {
    const root = await setupRoot();
    const embedder = new FakeEmbedder();
    const [qVec] = await embedder.embed(["cats"]);
    const orthogonal = qVec!.map((_, i) => (i === 0 ? 1 : 0));
    await writeNoteEmbeddings(
      root,
      makeRecord("n1", [
        { text: "unrelated topic", embedding: orthogonal },
        { text: "cats and dogs", embedding: qVec! },
      ]),
    );
    const hits = await searchSemantic(root, "cats", embedder, { minScore: 0.5 });
    expect(hits.every((h) => h.score >= 0.5)).toBe(true);
    expect(hits.some((h) => h.snippet.includes("cats"))).toBe(true);
  });

  it("caps hits per note with maxPerNote", async () => {
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
    const hits = await searchSemantic(root, "alpha", embedder, {
      maxPerNote: 1,
      minScore: 0,
    });
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
    const hits = await searchSemantic(root, "shared", embedder, {
      topK: 2,
      minScore: 0,
    });
    expect(hits).toHaveLength(2);
  });

  it("sorts by score descending and propagates snippet metadata", async () => {
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
    const hits = await searchSemantic(root, "pasta tomato", embedder, {
      minScore: 0,
    });
    expect(hits[0]?.noteId).toBe("cooking");
    expect(hits[0]?.snippet).toBe("pasta tomato sauce");
    expect(hits[0]?.offset).toBe(0);
    expect(hits[0]?.length).toBe("pasta tomato sauce".length);
    expect(hits[0]!.score).toBeGreaterThanOrEqual(hits[1]!.score);
  });
});
