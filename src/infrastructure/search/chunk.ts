/**
 * Word-based chunker. Splitting by tokens would require the tokenizer in this
 * file — keeping it word-based lets the chunker stay synchronous and
 * dependency-free.
 *
 * ~120 words per chunk with ~24 overlap. The earlier 200/32 turned a whole
 * recipe into one vector averaging ingredients, method and notes, so no part
 * of it was strongly about anything; 120 is short enough that a paragraph
 * keeps its own subject and still comfortably inside the model's window
 * (ADR-010).
 */

export interface Chunk {
  idx: number;
  text: string;
  offset: number;
  length: number;
}

export interface ChunkOptions {
  /** Approximate words per chunk. */
  size?: number;
  /** Word overlap between consecutive chunks. */
  overlap?: number;
}

/** Match runs of non-whitespace, capturing their starting offset. */
function tokens(text: string): Array<{ word: string; offset: number }> {
  const out: Array<{ word: string; offset: number }> = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({ word: m[0], offset: m.index });
  }
  return out;
}

export function chunkText(body: string, options: ChunkOptions = {}): Chunk[] {
  const size = options.size ?? 120;
  const overlap = options.overlap ?? 24;
  if (size <= overlap) {
    throw new Error("Chunk size must be greater than overlap");
  }
  const words = tokens(body);
  if (words.length === 0) return [];

  const step = size - overlap;
  const out: Chunk[] = [];
  let idx = 0;
  for (let start = 0; start < words.length; start += step) {
    const slice = words.slice(start, start + size);
    if (slice.length === 0) break;
    const first = slice[0]!;
    const last = slice[slice.length - 1]!;
    const offset = first.offset;
    const length = last.offset + last.word.length - first.offset;
    out.push({
      idx,
      text: body.slice(offset, offset + length),
      offset,
      length,
    });
    idx++;
    if (start + size >= words.length) break;
  }
  return out;
}
