import { describe, it, expect } from "vitest";
import { makeFakeRoot } from "../../../test/fakeFs";
import { initializeVault } from "../../fs/vault";
import { createNote, updateNote } from "../../notes/storage";
import { FakeEmbedder } from "../embedder";
import { reindex, pruneOrphans } from "../indexer";
import { searchSemantic } from "../search";
import {
  readNoteEmbeddings,
  readSemanticManifest,
} from "../index-fs";
import { listNotes } from "../../notes/storage";

async function setup() {
  const root = makeFakeRoot();
  await initializeVault(root);
  const io = {
    root,
    now: () => new Date("2026-05-17T10:00:00Z"),
    newId: (() => {
      let n = 0;
      return () => `id-${n++}`;
    })(),
  };
  return io;
}

describe("indexer", () => {
  it("writes a per-note embeddings file and a manifest", async () => {
    const io = await setup();
    await createNote(io, { title: "Cats", body: "Cats love sunny windows." });
    const notes = await listNotes(io);
    const embedder = new FakeEmbedder();

    const result = await reindex(io.root, notes, embedder);
    expect(result.embedded).toBe(1);

    const manifest = await readSemanticManifest(io.root);
    expect(manifest?.modelId).toBe(embedder.id);
    expect(manifest?.dimensions).toBe(embedder.dimensions);

    const rec = await readNoteEmbeddings(io.root, notes[0]!.id);
    expect(rec?.modelId).toBe(embedder.id);
    expect(rec?.chunks).toHaveLength(1);
    expect(rec?.chunks[0]?.embedding.length).toBe(embedder.dimensions);
  });

  it("skips notes whose content has not changed", async () => {
    const io = await setup();
    await createNote(io, { title: "x", body: "same body" });
    const notes = await listNotes(io);
    const embedder = new FakeEmbedder();
    await reindex(io.root, notes, embedder);
    const second = await reindex(io.root, notes, embedder);
    expect(second.embedded).toBe(0);
    expect(second.skipped).toBe(1);
  });

  it("re-embeds when content changes", async () => {
    const io = await setup();
    const rec = await createNote(io, { title: "x", body: "first body" });
    const embedder = new FakeEmbedder();
    await reindex(io.root, await listNotes(io), embedder);

    await updateNote(io, rec.id, { body: "second body" });
    const result = await reindex(io.root, await listNotes(io), embedder);
    expect(result.embedded).toBe(1);
    expect(result.skipped).toBe(0);
  });

  it("clears the index when the embedder model changes", async () => {
    const io = await setup();
    await createNote(io, { title: "x", body: "anything" });
    const e1 = new FakeEmbedder("model-a", 32);
    await reindex(io.root, await listNotes(io), e1);

    const e2 = new FakeEmbedder("model-b", 32);
    await reindex(io.root, await listNotes(io), e2);

    const manifest = await readSemanticManifest(io.root);
    expect(manifest?.modelId).toBe("model-b");
    const rec = await readNoteEmbeddings(
      io.root,
      (await listNotes(io))[0]!.id,
    );
    expect(rec?.modelId).toBe("model-b");
  });
});

describe("semantic search", () => {
  it("ranks the most relevant chunk first", async () => {
    const io = await setup();
    await createNote(io, {
      title: "Cooking",
      body: "Today I cooked pasta with tomato sauce. Italian recipes are simple.",
    });
    await createNote(io, {
      title: "Astronomy",
      body: "Rockets launch into orbit at thousands of kilometers per hour.",
    });
    const embedder = new FakeEmbedder();
    await reindex(io.root, await listNotes(io), embedder);

    const hits = await searchSemantic(io.root, "pasta tomato", embedder);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.snippet.toLowerCase()).toContain("pasta");
  });
});

describe("pruneOrphans", () => {
  it("removes embeddings for notes that no longer exist", async () => {
    const io = await setup();
    const a = await createNote(io, { title: "a", body: "a" });
    const b = await createNote(io, { title: "b", body: "b" });
    const embedder = new FakeEmbedder();
    await reindex(io.root, await listNotes(io), embedder);

    const removed = await pruneOrphans(io.root, [a.id]);
    expect(removed).toBe(1);
    expect(await readNoteEmbeddings(io.root, b.id)).toBeNull();
  });
});
