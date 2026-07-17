import { describe, it, expect } from "vitest";
import { makeFakeRoot } from "../../../test/fakeFs";
import { initializeVault } from "../../fs/vault";
import {
  clearSemanticIndex,
  deleteNoteEmbeddings,
  iterateNoteEmbeddings,
  isCurrentSchema,
  readNoteEmbeddings,
  readSemanticManifest,
  writeNoteEmbeddings,
  writeSemanticManifest,
} from "../index-fs";
import {
  SEMANTIC_SCHEMA_VERSION,
  type NoteEmbeddings,
} from "../types";

function sampleEmbeddings(noteId = "note-1"): NoteEmbeddings {
  return {
    noteId,
    filePath: `notes/2026/01/${noteId}.md`,
    contentHash: "abc",
    modelId: "fake",
    dimensions: 32,
    schemaVersion: SEMANTIC_SCHEMA_VERSION,
    updatedAt: "2026-05-17T10:00:00Z",
    chunks: [
      {
        idx: 0,
        text: "hello world",
        offset: 0,
        length: 11,
        embedding: new Array(32).fill(0.1),
      },
    ],
  };
}

async function setup() {
  const root = makeFakeRoot();
  await initializeVault(root);
  return root;
}

describe("index-fs", () => {
  it("readSemanticManifest returns null when absent", async () => {
    const root = await setup();
    expect(await readSemanticManifest(root)).toBeNull();
  });

  it("round-trips the semantic manifest", async () => {
    const root = await setup();
    const manifest = {
      schemaVersion: SEMANTIC_SCHEMA_VERSION,
      modelId: "fake",
      dimensions: 32,
    };
    await writeSemanticManifest(root, manifest);
    expect(await readSemanticManifest(root)).toEqual(manifest);
  });

  it("round-trips per-note embeddings", async () => {
    const root = await setup();
    const data = sampleEmbeddings();
    await writeNoteEmbeddings(root, data);
    expect(await readNoteEmbeddings(root, data.noteId)).toEqual(data);
  });

  it("deleteNoteEmbeddings is idempotent", async () => {
    const root = await setup();
    const data = sampleEmbeddings();
    await writeNoteEmbeddings(root, data);
    await deleteNoteEmbeddings(root, data.noteId);
    expect(await readNoteEmbeddings(root, data.noteId)).toBeNull();
    await expect(deleteNoteEmbeddings(root, data.noteId)).resolves.toBeUndefined();
  });

  it("iterateNoteEmbeddings yields json files and skips non-json entries", async () => {
    const root = await setup();
    await writeNoteEmbeddings(root, sampleEmbeddings("a"));
    await writeNoteEmbeddings(root, sampleEmbeddings("b"));
    const { writeText } = await import("../../fs/handle");
    await writeText(root, ".semantic-index/notes/readme.txt", "skip");

    const ids: string[] = [];
    for await (const rec of iterateNoteEmbeddings(root)) ids.push(rec.noteId);
    expect(ids.sort()).toEqual(["a", "b"]);
  });

  it("iterateNoteEmbeddings is empty when the notes directory is missing", async () => {
    const root = makeFakeRoot();
    const results: NoteEmbeddings[] = [];
    for await (const rec of iterateNoteEmbeddings(root)) results.push(rec);
    expect(results).toEqual([]);
  });

  it("clearSemanticIndex removes all embedding files", async () => {
    const root = await setup();
    await writeNoteEmbeddings(root, sampleEmbeddings("x"));
    await writeNoteEmbeddings(root, sampleEmbeddings("y"));
    await clearSemanticIndex(root);
    const remaining: string[] = [];
    for await (const rec of iterateNoteEmbeddings(root)) remaining.push(rec.noteId);
    expect(remaining).toEqual([]);
  });

  it("clearSemanticIndex is a no-op when the notes directory is missing", async () => {
    const root = makeFakeRoot();
    await expect(clearSemanticIndex(root)).resolves.toBeUndefined();
  });

  it("isCurrentSchema matches SEMANTIC_SCHEMA_VERSION only", () => {
    expect(isCurrentSchema(SEMANTIC_SCHEMA_VERSION)).toBe(true);
    expect(isCurrentSchema(SEMANTIC_SCHEMA_VERSION + 1)).toBe(false);
  });
});
