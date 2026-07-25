import { iterateNoteEmbeddings } from "./index-fs";
import { dot, toQueryInput, type Embedder } from "./embedder";
import type { ChunkRecord, NoteEmbeddings } from "./types";
import {
  createLexicalIndexBuilder,
  refreshLexicalTerms,
  removeLexicalDocument,
  searchLexicalIndex,
  upsertLexicalDocument,
  type LexicalDocument,
  type LexicalIndex,
} from "../../domain/search/lexical-index";
import { applyRelativeCutoff, fuseRankings } from "../../domain/search/rank";
import type { MatchKind } from "../../domain/search/rank";
import { foldSearchText, tokenizeSearchText } from "../../domain/search/normalize";

export interface SearchHit {
  noteId: string;
  filePath: string;
  chunkIdx: number;
  /** Fused relevance in [0, 1] — a rank-based score, not a cosine. */
  score: number;
  /** Excerpt drawn directly from the indexed chunk text. */
  snippet: string;
  offset: number;
  length: number;
  matchKind: MatchKind;
}

export interface SearchOptions {
  topK?: number;
  /** Hard floor on cosine similarity. Defaults to the model's own floor. */
  minScore?: number;
  /**
   * Share of the best cosine score (measured up from `minScore`) a note must
   * reach to stay in the dense candidate set. 0 disables the cutoff.
   */
  relativeCutoff?: number;
}

/** How many literal matches to carry into the fusion. */
const LEXICAL_CANDIDATES = 32;

/**
 * A place for the session to stash the lexical index between queries.
 *
 * The index is a pure function of the note text already streamed off disk, so
 * rebuilding it on every keystroke is O(corpus) of wasted tokenisation — the
 * dominant cost of a query on a large vault. The session (`fs-semantic-search`)
 * owns one of these per vault. Rather than clearing it whenever the on-disk
 * index changes — which made the next keystroke pay a full O(corpus) rebuild,
 * every time after an autosave tick — the session marks just the changed note
 * ids `dirty`, and the next query patches those documents in place (`reindex`,
 * `pruneOrphans`). The index is thus built once and reused across a palette's
 * worth of keystrokes. Dense scoring still streams every record — the query
 * vector is new each time — but that pass no longer re-tokenises the corpus.
 * Omitting the cache falls back to building fresh each call.
 */
export interface LexicalIndexCache {
  current: LexicalIndex | null;
  /**
   * Note ids whose on-disk text changed since `current` was built. The next
   * query reconciles just these into the index, in the dense pass it already
   * makes, instead of forcing a full rebuild.
   */
  dirty?: Set<string>;
}

/** One note's contribution to the two candidate lists. */
interface Candidate {
  record: NoteEmbeddings;
  bestChunk: ChunkRecord;
  bestScore: number;
}

function toLexicalDocument(record: NoteEmbeddings): LexicalDocument {
  const title = record.chunks
    .filter((c) => c.kind === "title")
    .map((c) => c.text)
    .join(" ");
  const body = record.chunks
    .filter((c) => c.kind !== "title")
    .map((c) => c.text)
    .join("\n");
  return { id: record.noteId, title, body };
}

/**
 * Prefer an excerpt that actually contains what the user typed. A note pulled
 * in by the lexical side and shown with an unrelated first paragraph reads as
 * a bad result even when it is the right note.
 */
function pickSnippet(candidate: Candidate, terms: readonly string[]): ChunkRecord {
  if (terms.length === 0) return candidate.bestChunk;
  for (const chunk of candidate.record.chunks) {
    const folded = foldSearchText(chunk.text);
    if (terms.some((term) => folded.includes(term))) return chunk;
  }
  return candidate.bestChunk;
}

/**
 * Hybrid retrieval: dense vectors and a literal term index, fused by rank.
 *
 * Dense-only retrieval is a known-bad fit for the queries this app receives —
 * a single Spanish noun typed into a palette has almost no sentence structure
 * for a paraphrase model to work with, and the model happily returns eight
 * mediocre neighbours. The inverted index has the opposite failure mode, so
 * the two are fused by Reciprocal Rank Fusion, which needs no calibration
 * between a cosine and a BM25 weight (ADR-010).
 *
 * Returns at most one hit per note: the palette shows one row per note, and
 * ranking notes rather than chunks is what makes a single merged list
 * possible downstream.
 */
export async function searchSemantic(
  root: FileSystemDirectoryHandle,
  query: string,
  embedder: Embedder,
  options: SearchOptions = {},
  cache?: LexicalIndexCache,
): Promise<SearchHit[]> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return [];
  const topK = options.topK ?? 10;
  const minScore = options.minScore ?? embedder.minScore ?? 0;
  const relativeCutoff = options.relativeCutoff ?? 0;
  const [qVec] = await embedder.embed([toQueryInput(embedder, trimmed)]);
  if (!qVec) return [];

  const candidates = new Map<string, Candidate>();

  // Reuse the cached lexical index when the session has one; otherwise build it
  // in this same streaming pass so the corpus is tokenised once, not per query.
  // When only a handful of notes are dirty (the autosave case), patch those
  // documents in place instead. A change set that rivals the corpus — a full
  // reindex — is cheaper to rebuild than to patch note by note, so past a
  // quarter of the vault we drop the cache and build fresh.
  const dirty = cache?.dirty;
  let cachedLexical = cache?.current ?? null;
  if (cachedLexical && dirty && dirty.size > cachedLexical.documentCount / 4) {
    cachedLexical = null;
  }
  const reconcile =
    cachedLexical !== null && dirty !== undefined && dirty.size > 0;
  const builder = cachedLexical ? null : createLexicalIndexBuilder();

  for await (const rec of iterateNoteEmbeddings(root)) {
    if (rec.modelId !== embedder.id || rec.dimensions !== embedder.dimensions) {
      // Skip stale records that survived a model change. `reindex` will pick
      // them up; in the meantime we refuse to score across models.
      continue;
    }
    if (rec.chunks.length === 0) continue;
    let bestChunk = rec.chunks[0]!;
    let bestScore = -Infinity;
    for (const chunk of rec.chunks) {
      const score = dot(qVec, chunk.embedding);
      if (score > bestScore) {
        bestScore = score;
        bestChunk = chunk;
      }
    }
    candidates.set(rec.noteId, { record: rec, bestChunk, bestScore });
    builder?.add(toLexicalDocument(rec));
    if (reconcile && dirty!.has(rec.noteId)) {
      upsertLexicalDocument(cachedLexical!, toLexicalDocument(rec));
      dirty!.delete(rec.noteId);
    }
  }

  let lexicalIndex: LexicalIndex;
  if (cachedLexical) {
    if (reconcile) {
      // Dirty ids never seen on disk are deletions (or notes emptied to no
      // chunks); drop them, then refresh the vocabulary once for the batch.
      for (const id of dirty!) removeLexicalDocument(cachedLexical, id);
      dirty!.clear();
      refreshLexicalTerms(cachedLexical);
    }
    lexicalIndex = cachedLexical;
  } else {
    lexicalIndex = builder!.build();
    if (cache) {
      cache.current = lexicalIndex;
      cache.dirty?.clear();
    }
  }

  const dense = [...candidates.values()]
    .filter((c) => c.bestScore >= minScore)
    .map((c) => ({ id: c.record.noteId, score: c.bestScore }))
    .sort((a, b) => b.score - a.score);

  // The relative cutoff decides what is worth *showing*, so it is applied
  // after fusion, not to the fusion's input. Removing a weak note from the
  // dense list does not remove it from the results — it still arrives via the
  // lexical side — it only inflates the fused rank of whatever mediocre note
  // survived in both lists. Notes below the cutoff cannot outrank anything
  // above them anyway, so leaving them in the ranking is free.
  const competitive = new Set(
    applyRelativeCutoff(dense, {
      ratio: relativeCutoff,
      floor: minScore,
    }).map((d) => d.id),
  );

  const lexicalMatches = searchLexicalIndex(lexicalIndex, trimmed, {
    limit: LEXICAL_CANDIDATES,
  });
  const lexicalIds = new Set(lexicalMatches.map((m) => m.id));

  const terms = tokenizeSearchText(trimmed);
  const hits: SearchHit[] = [];
  // Lexical first: with two rankings, ties are frequent, and `fuseRankings`
  // resolves them to the ranking given first. A note that literally contains
  // what was typed is the better answer to hand back on a tie.
  for (const fused of fuseRankings([
    lexicalMatches.map((m) => m.id),
    dense.map((d) => d.id),
  ])) {
    const candidate = candidates.get(fused.id);
    if (!candidate) continue;
    // A literal match has earned its place whatever the vectors think.
    if (!lexicalIds.has(fused.id) && !competitive.has(fused.id)) continue;
    const chunk = lexicalIds.has(fused.id)
      ? pickSnippet(candidate, terms)
      : candidate.bestChunk;
    hits.push({
      noteId: candidate.record.noteId,
      filePath: candidate.record.filePath,
      chunkIdx: chunk.idx,
      score: fused.score,
      snippet: chunk.text,
      offset: chunk.offset,
      length: chunk.length,
      matchKind: lexicalIds.has(fused.id) ? "text" : "semantic",
    });
    if (hits.length >= topK) break;
  }
  return hits;
}
