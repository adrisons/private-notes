import type {
  ChunkRecord,
  NoteEmbeddings,
  StoredChunkRecord,
  StoredNoteEmbeddings,
} from "./types";

/** Pack chunk embeddings into one little-endian Float32 sidecar blob. */
export function packEmbeddingVectors(
  chunks: ReadonlyArray<{ embedding: ArrayLike<number> }>,
  dimensions: number,
): Uint8Array<ArrayBuffer> {
  const byteLength = chunks.length * dimensions * 4;
  const bytes = new Uint8Array(byteLength);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < chunks.length; i++) {
    const embedding = chunks[i]!.embedding;
    const base = i * dimensions * 4;
    for (let d = 0; d < dimensions; d++) {
      view.setFloat32(base + d * 4, embedding[d] ?? 0, true);
    }
  }
  return bytes;
}

export function storedChunksFromRecord(
  chunks: ReadonlyArray<Pick<ChunkRecord, "idx" | "kind" | "text" | "offset" | "length">>,
  dimensions: number,
): StoredChunkRecord[] {
  return chunks.map((chunk, index) => ({
    idx: chunk.idx,
    kind: chunk.kind,
    text: chunk.text,
    offset: chunk.offset,
    length: chunk.length,
    embeddingOffset: index * dimensions * 4,
  }));
}

export function storedNoteFromRecord(
  data: NoteEmbeddings,
): StoredNoteEmbeddings {
  return {
    noteId: data.noteId,
    filePath: data.filePath,
    contentHash: data.contentHash,
    modelId: data.modelId,
    dimensions: data.dimensions,
    schemaVersion: data.schemaVersion,
    updatedAt: data.updatedAt,
    chunks: storedChunksFromRecord(data.chunks, data.dimensions),
  };
}

/** Attach Float32Array views from a sidecar blob; `null` when offsets disagree. */
export function hydrateNoteEmbeddings(
  stored: StoredNoteEmbeddings,
  vectors: ArrayBuffer,
): NoteEmbeddings | null {
  const { dimensions } = stored;
  const vectorBytes = dimensions * 4;
  const chunks: ChunkRecord[] = [];

  for (let i = 0; i < stored.chunks.length; i++) {
    const meta = stored.chunks[i]!;
    const expectedOffset = i * vectorBytes;
    if (meta.embeddingOffset !== expectedOffset) return null;
    const end = meta.embeddingOffset + vectorBytes;
    if (end > vectors.byteLength) return null;
    chunks.push({
      idx: meta.idx,
      kind: meta.kind,
      text: meta.text,
      offset: meta.offset,
      length: meta.length,
      embedding: new Float32Array(
        vectors,
        meta.embeddingOffset,
        dimensions,
      ),
    });
  }

  return { ...stored, chunks };
}
