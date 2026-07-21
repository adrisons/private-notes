import { describe, it, expect } from "vitest";
import { parseNoteEmbeddings, parseSemanticManifest } from "../validate";

const validManifest = {
  schemaVersion: 1,
  modelId: "Xenova/paraphrase-multilingual-MiniLM-L12-v2",
  dimensions: 3,
};

const validEmbeddings = {
  noteId: "01HX",
  filePath: "notes/2026/05/a-01HX.md",
  contentHash: "abc",
  modelId: "Xenova/paraphrase-multilingual-MiniLM-L12-v2",
  dimensions: 3,
  schemaVersion: 1,
  updatedAt: "2026-05-17T10:00:00.000Z",
  chunks: [
    {
      idx: 0,
      kind: "body",
      text: "hi",
      offset: 0,
      length: 2,
      embedding: [0.1, 0.2, 0.3],
    },
  ],
};

describe("parseSemanticManifest", () => {
  it("accepts a well-formed manifest", () => {
    expect(parseSemanticManifest(validManifest)).toEqual(validManifest);
  });

  it("returns null on malformed input instead of throwing", () => {
    expect(parseSemanticManifest(null)).toBeNull();
    expect(parseSemanticManifest({ schemaVersion: 1 })).toBeNull();
    expect(
      parseSemanticManifest({ ...validManifest, dimensions: "3" }),
    ).toBeNull();
  });
});

describe("parseNoteEmbeddings", () => {
  it("accepts a well-formed embeddings file", () => {
    expect(parseNoteEmbeddings(validEmbeddings)?.noteId).toBe("01HX");
  });

  it("returns null when a required field is missing", () => {
    const broken: Record<string, unknown> = { ...validEmbeddings };
    delete broken.contentHash;
    expect(parseNoteEmbeddings(broken)).toBeNull();
  });

  it("returns null when an embedding length disagrees with dimensions", () => {
    const mismatched = {
      ...validEmbeddings,
      chunks: [{ ...validEmbeddings.chunks[0], embedding: [0.1, 0.2] }],
    };
    expect(parseNoteEmbeddings(mismatched)).toBeNull();
  });

  it("returns null when a chunk embedding holds non-numbers", () => {
    const bad = {
      ...validEmbeddings,
      chunks: [{ ...validEmbeddings.chunks[0], embedding: [0.1, "x", 0.3] }],
    };
    expect(parseNoteEmbeddings(bad)).toBeNull();
  });

  it("rejects a chunk written before chunk kinds existed", () => {
    const legacy: Record<string, unknown> = { ...validEmbeddings.chunks[0] };
    delete legacy.kind;
    expect(
      parseNoteEmbeddings({ ...validEmbeddings, chunks: [legacy] }),
    ).toBeNull();
  });
});
