import { describe, expect, it } from "vitest";
import {
  hydrateNoteEmbeddings,
  packEmbeddingVectors,
  storedNoteFromRecord,
} from "../embedding-vectors";
import { SEMANTIC_SCHEMA_VERSION } from "../types";

describe("embedding-vectors", () => {
  it("round-trips vectors through the sidecar blob", () => {
    const record = {
      noteId: "n1",
      filePath: "notes/a.md",
      contentHash: "hash",
      modelId: "fake",
      dimensions: 4,
      schemaVersion: SEMANTIC_SCHEMA_VERSION,
      updatedAt: "2026-05-17T10:00:00Z",
      chunks: [
        {
          idx: 0,
          kind: "body" as const,
          text: "one",
          offset: 0,
          length: 3,
          embedding: new Float32Array([1, 0, 0, 0]),
        },
        {
          idx: 1,
          kind: "body" as const,
          text: "two",
          offset: 0,
          length: 3,
          embedding: new Float32Array([0, 1, 0, 0]),
        },
      ],
    };
    const stored = storedNoteFromRecord(record);
    const packed = packEmbeddingVectors(record.chunks, record.dimensions);
    const hydrated = hydrateNoteEmbeddings(stored, packed.buffer);
    expect(hydrated?.chunks[0]?.embedding).toEqual(record.chunks[0]!.embedding);
    expect(hydrated?.chunks[1]?.embedding).toEqual(record.chunks[1]!.embedding);
  });
});
