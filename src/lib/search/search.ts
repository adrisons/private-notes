import { iterateNoteEmbeddings } from "./index-fs";
import { dot, type Embedder } from "./embedder";

export interface SearchHit {
  noteId: string;
  filePath: string;
  chunkIdx: number;
  /** Cosine similarity in [-1, 1] (typically 0..1 for normalized embeddings). */
  score: number;
  /** Excerpt drawn directly from the indexed chunk text. */
  snippet: string;
  offset: number;
  length: number;
}

export interface SearchOptions {
  topK?: number;
  /** Hard floor on similarity; lower-scoring hits are dropped. */
  minScore?: number;
  /** Cap how many hits per note end up in the final list. */
  maxPerNote?: number;
}

/**
 * Streaming top-K cosine search. We never load all vectors into one big array
 * — we iterate per-note files and maintain a small heap-like list.
 */
export async function searchSemantic(
  root: FileSystemDirectoryHandle,
  query: string,
  embedder: Embedder,
  options: SearchOptions = {},
): Promise<SearchHit[]> {
  const topK = options.topK ?? 10;
  const minScore = options.minScore ?? 0;
  const maxPerNote = options.maxPerNote ?? 3;
  const [qVec] = await embedder.embed([query]);
  if (!qVec) return [];

  const hits: SearchHit[] = [];

  for await (const rec of iterateNoteEmbeddings(root)) {
    if (
      rec.modelId !== embedder.id ||
      rec.dimensions !== embedder.dimensions
    ) {
      // Skip stale records that survived a model change. `reindex` will pick
      // them up; in the meantime we refuse to score across models.
      continue;
    }
    // Per-note pool, then merge into the global list.
    const notePool: SearchHit[] = [];
    for (const c of rec.chunks) {
      const s = dot(qVec, c.embedding);
      if (s < minScore) continue;
      notePool.push({
        noteId: rec.noteId,
        filePath: rec.filePath,
        chunkIdx: c.idx,
        score: s,
        snippet: c.text,
        offset: c.offset,
        length: c.length,
      });
    }
    notePool.sort((a, b) => b.score - a.score);
    hits.push(...notePool.slice(0, maxPerNote));
  }

  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, topK);
}
