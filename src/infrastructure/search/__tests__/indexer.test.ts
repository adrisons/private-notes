import { describe, it, expect } from "vitest";
import { makeFakeRoot } from "../../../test/fakeFs";
import { initializeVault } from "../../fs/vault";
import { createNote, updateNote } from "../../notes/storage";
import { FakeEmbedder } from "../embedder";
import { reindex, pruneOrphans } from "../indexer";
import { searchSemantic } from "../search";
import {
  clearSemanticIndex,
  deleteNoteEmbeddings,
  readContentHashes,
  readNoteEmbeddings,
  readSemanticManifest,
} from "../index-fs";
import { writeText } from "../../fs/handle";
import { FsNoteRepository } from "../../notes/fs-note-repository";
import { SEMANTIC_PATHS, TITLE_CHUNK_IDX } from "../types";

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

async function reindexNotes(io: { root: FileSystemDirectoryHandle }) {
  return new FsNoteRepository(io.root).listForReindex();
}

describe("indexer", () => {
  it("writes a per-note embeddings file and a manifest", async () => {
    const io = await setup();
    await createNote(io, { title: "Cats", body: "Cats love sunny windows." });
    const notes = await reindexNotes(io);
    const embedder = new FakeEmbedder();

    const result = await reindex(io.root, notes, embedder);
    expect(result.embedded).toBe(1);

    const manifest = await readSemanticManifest(io.root);
    expect(manifest?.modelId).toBe(embedder.id);
    expect(manifest?.dimensions).toBe(embedder.dimensions);

    const rec = await readNoteEmbeddings(io.root, notes[0]!.id);
    expect(rec?.modelId).toBe(embedder.id);
    // One vector for the title, one for the body.
    expect(rec?.chunks.map((c) => c.kind)).toEqual(["title", "body"]);
    expect(rec?.chunks[0]?.text).toBe("Cats");
    expect(rec?.chunks[0]?.idx).toBe(TITLE_CHUNK_IDX);
    expect(rec?.chunks[0]?.embedding.length).toBe(embedder.dimensions);
  });

  it("re-embeds when only the title changes", async () => {
    const io = await setup();
    const rec = await createNote(io, { title: "Cats", body: "same body" });
    const embedder = new FakeEmbedder();
    await reindex(io.root, await reindexNotes(io), embedder);

    await updateNote(io, rec.id, { title: "Dogs" });
    const result = await reindex(io.root, await reindexNotes(io), embedder);
    expect(result.embedded).toBe(1);
  });

  it("embeds the title alongside each body chunk", async () => {
    const io = await setup();
    const seen: string[] = [];
    const base = new FakeEmbedder();
    const spy = {
      id: base.id,
      dimensions: base.dimensions,
      embed: async (texts: string[]) => {
        seen.push(...texts);
        return base.embed(texts);
      },
    };
    await createNote(io, { title: "Tiradito", body: "leche de tigre" });
    await reindex(io.root, await reindexNotes(io), spy);
    expect(seen).toEqual(["Tiradito", "Tiradito\n\nleche de tigre"]);
  });

  it("skips notes whose content has not changed", async () => {
    const io = await setup();
    await createNote(io, { title: "x", body: "same body" });
    const notes = await reindexNotes(io);
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
    await reindex(io.root, await reindexNotes(io), embedder);

    await updateNote(io, rec.id, { body: "second body" });
    const result = await reindex(io.root, await reindexNotes(io), embedder);
    expect(result.embedded).toBe(1);
    expect(result.skipped).toBe(0);
  });

  it("writes a content-hash hint for every indexed note", async () => {
    const io = await setup();
    const a = await createNote(io, { title: "a", body: "one" });
    const b = await createNote(io, { title: "b", body: "two" });
    const embedder = new FakeEmbedder();
    await reindex(io.root, await reindexNotes(io), embedder);

    const hints = await readContentHashes(io.root);
    expect(Object.keys(hints).sort()).toEqual([a.id, b.id].sort());
    const rec = await readNoteEmbeddings(io.root, a.id);
    expect(hints[a.id]).toBe(rec?.contentHash);
  });

  it("trusts the hint and skips an unchanged note without reading its vectors", async () => {
    const io = await setup();
    const rec = await createNote(io, { title: "x", body: "same body" });
    const embedder = new FakeEmbedder();
    await reindex(io.root, await reindexNotes(io), embedder);

    // Corrupt the vectors file but leave it in place. A scan that trusted the
    // hint never opens it; one that parsed it would treat the garbage as stale
    // and re-embed. Search tolerates a corrupt file by skipping it, so trusting
    // the hint here is the deliberate trade-off (ADR-011).
    await writeText(
      io.root,
      `${SEMANTIC_PATHS.notes}/${rec.id}.json`,
      "not json at all",
    );
    const second = await reindex(io.root, await reindexNotes(io), embedder);
    expect(second.embedded).toBe(0);
    expect(second.skipped).toBe(1);
  });

  it("does not re-embed a body that differs only by what the file format strips", async () => {
    const io = await setup();
    await createNote(io, { title: "x", body: "same body" });
    const embedder = new FakeEmbedder();

    // What autosave hands the indexer: the editor's text, before
    // `serializeNote` trims it and `parseNote` strips the framing newlines.
    const [onDisk] = await reindexNotes(io);
    await reindex(
      io.root,
      [{ ...onDisk!, body: "\nsame body \n\n" }],
      embedder,
    );
    // What the next reload hands it: the same note, read back off disk.
    const second = await reindex(io.root, await reindexNotes(io), embedder);

    expect(second.embedded).toBe(0);
    expect(second.skipped).toBe(1);
  });

  it("keeps the other notes' hints when one note is reindexed on its own", async () => {
    const io = await setup();
    const a = await createNote(io, { title: "a", body: "one" });
    const b = await createNote(io, { title: "b", body: "two" });
    const embedder = new FakeEmbedder();
    await reindex(io.root, await reindexNotes(io), embedder);

    // Autosave reindexes a single note every 500 ms. Rebuilding the hint map
    // from that one note left every other note without a fast path, so the
    // next reload re-read every vectors file on disk.
    await updateNote(io, a.id, { body: "one more" });
    const changed = (await reindexNotes(io)).filter((n) => n.id === a.id);
    await reindex(io.root, changed, embedder);

    const hints = await readContentHashes(io.root);
    expect(Object.keys(hints).sort()).toEqual([a.id, b.id].sort());
    expect(hints[b.id]).toBe((await readNoteEmbeddings(io.root, b.id))?.contentHash);
  });

  it("re-embeds when the vectors file vanished even though the hint remains", async () => {
    const io = await setup();
    const rec = await createNote(io, { title: "x", body: "same body" });
    const embedder = new FakeEmbedder();
    await reindex(io.root, await reindexNotes(io), embedder);

    // Hint still points at this note, but its vectors are gone. The existence
    // guard must catch that and re-embed rather than fast-skip into a hole.
    await deleteNoteEmbeddings(io.root, rec.id);
    const second = await reindex(io.root, await reindexNotes(io), embedder);
    expect(second.embedded).toBe(1);
    expect(second.skipped).toBe(0);
  });

  it("drops the hint file when the index is cleared", async () => {
    const io = await setup();
    const rec = await createNote(io, { title: "x", body: "anything" });
    await reindex(io.root, await reindexNotes(io), new FakeEmbedder());
    expect(await readContentHashes(io.root)).toHaveProperty(rec.id);

    // A model change wipes the vectors via clearSemanticIndex; the hints must
    // go with them so the next scan cannot fast-skip against a hint whose
    // vectors no longer exist.
    await clearSemanticIndex(io.root);
    expect(await readContentHashes(io.root)).toEqual({});
  });

  it("clears the index when the embedder model changes", async () => {
    const io = await setup();
    await createNote(io, { title: "x", body: "anything" });
    const e1 = new FakeEmbedder("model-a", 32);
    await reindex(io.root, await reindexNotes(io), e1);

    const e2 = new FakeEmbedder("model-b", 32);
    await reindex(io.root, await reindexNotes(io), e2);

    const manifest = await readSemanticManifest(io.root);
    expect(manifest?.modelId).toBe("model-b");
    const rec = await readNoteEmbeddings(
      io.root,
      (await reindexNotes(io))[0]!.id,
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
    await reindex(io.root, await reindexNotes(io), embedder);

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
    await reindex(io.root, await reindexNotes(io), embedder);

    const removed = await pruneOrphans(io.root, [a.id]);
    expect(removed).toBe(1);
    expect(await readNoteEmbeddings(io.root, b.id)).toBeNull();
  });

  it("drops the pruned note's content-hash hint", async () => {
    const io = await setup();
    const a = await createNote(io, { title: "a", body: "a" });
    const b = await createNote(io, { title: "b", body: "b" });
    const embedder = new FakeEmbedder();
    await reindex(io.root, await reindexNotes(io), embedder);

    await pruneOrphans(io.root, [a.id]);
    const hints = await readContentHashes(io.root);
    expect(hints).toHaveProperty(a.id);
    expect(hints).not.toHaveProperty(b.id);
  });

  it("detects an orphan from its filename, even a corrupt one it cannot parse", async () => {
    const io = await setup();
    const a = await createNote(io, { title: "a", body: "a" });
    await reindex(io.root, await reindexNotes(io), new FakeEmbedder());
    // A corrupt vectors file for a note that is not live. Name-based pruning
    // still sees it; a parse-based scan would skip it and leak the orphan.
    await writeText(io.root, `${SEMANTIC_PATHS.notes}/ghost.json`, "corrupt");

    const removed = await pruneOrphans(io.root, [a.id]);
    expect(removed).toBe(1);
    expect(await readNoteEmbeddings(io.root, a.id)).not.toBeNull();
  });
});
