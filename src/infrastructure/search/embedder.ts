import type { Embedder } from "../../application/ports/embedder";

export type { Embedder };

/** L2-normalize in place. Vectors of length 0 are returned as zero vectors. */
export function l2NormalizeInPlace(v: number[]): number[] {
  let sum = 0;
  for (const x of v) sum += x * x;
  if (sum === 0) return v;
  const norm = Math.sqrt(sum);
  for (let i = 0; i < v.length; i++) v[i] = v[i]! / norm;
  return v;
}

/** Cosine similarity for unit vectors == dot product. */
export function dot(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let s = 0;
  for (let i = 0; i < n; i++) s += a[i]! * b[i]!;
  return s;
}

/**
 * A deterministic hashing embedder: bag-of-words projected to a fixed
 * `dimensions`-sized vector by feature hashing. It captures rough lexical
 * overlap and is enough to drive integration tests against the indexer. Not
 * for production search quality.
 */
export class FakeEmbedder implements Embedder {
  readonly id: string;
  readonly dimensions: number;
  constructor(id = "fake-hash-32", dimensions = 32) {
    this.id = id;
    this.dimensions = dimensions;
  }
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.embedOne(t));
  }
  private embedOne(text: string): number[] {
    const out = new Array(this.dimensions).fill(0);
    const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
    for (const w of words) {
      const h = djb2(w) >>> 0;
      const bucket = h % this.dimensions;
      const sign = (h & 1) === 0 ? 1 : -1;
      out[bucket] += sign;
    }
    return l2NormalizeInPlace(out);
  }
}

function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return h;
}
