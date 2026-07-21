import { tokenizeSearchText } from "./normalize";

/**
 * A small inverted index, built in memory over whatever documents the caller
 * already holds. It exists because dense retrieval alone is a known-bad fit
 * for the queries this app actually gets: one Spanish noun typed into a
 * palette. A single word carries almost no sentence structure for a
 * paraphrase model to work with, but it is exactly what an inverted index is
 * good at. The two signals are fused in `rank.ts` rather than one replacing
 * the other.
 *
 * Scoring is BM25's shape without its length normalisation: term frequency
 * saturates, rare terms weigh more, and the title counts as a stronger field
 * than the body. Full BM25 would need per-document lengths and an average we
 * would have to keep in sync; for a personal vault the extra term buys
 * nothing measurable.
 */

export interface LexicalDocument {
  id: string;
  title: string;
  body: string;
}

export interface LexicalMatch {
  id: string;
  score: number;
  /** True when at least one query term was found in the document's title. */
  inTitle: boolean;
}

/** A title is a deliberate label; body prose is not. Weight it accordingly. */
const TITLE_WEIGHT = 3;
/** BM25 `k1`: how quickly repeated occurrences stop adding value. */
const TF_SATURATION = 1.2;
/**
 * Palette queries are typed one letter at a time, so "pesca" has to find
 * "pescado" before the user finishes the word. Prefix hits count for less
 * than exact ones, and short fragments are ignored — two letters match half
 * the vault and rank nothing.
 */
const PREFIX_WEIGHT = 0.5;
const PREFIX_MIN_LENGTH = 3;

interface Posting {
  /** Weighted term frequency across all fields. */
  tf: number;
  inTitle: boolean;
}

export interface LexicalIndex {
  readonly documentCount: number;
  readonly postings: ReadonlyMap<string, ReadonlyMap<string, Posting>>;
  /**
   * Every term in `postings`, sorted, so prefix expansion is a binary search
   * for the block of matches instead of a scan of the whole vocabulary.
   */
  readonly sortedTerms: readonly string[];
}

/**
 * Feed documents one at a time and materialise the index once at the end.
 *
 * Streaming search reads every note off disk anyway (ADR-004); building the
 * index incrementally in that same pass avoids first collecting every note's
 * title and body into a `LexicalDocument[]` only to walk it again — one fewer
 * copy of the corpus in memory, one fewer pass.
 */
export interface LexicalIndexBuilder {
  add(doc: LexicalDocument): void;
  build(): LexicalIndex;
}

export function createLexicalIndexBuilder(): LexicalIndexBuilder {
  const postings = new Map<string, Map<string, Posting>>();
  let documentCount = 0;

  const addField = (
    docId: string,
    text: string,
    weight: number,
    isTitle: boolean,
  ) => {
    for (const term of tokenizeSearchText(text)) {
      let byDoc = postings.get(term);
      if (!byDoc) {
        byDoc = new Map();
        postings.set(term, byDoc);
      }
      const existing = byDoc.get(docId);
      if (existing) {
        existing.tf += weight;
        existing.inTitle ||= isTitle;
      } else {
        byDoc.set(docId, { tf: weight, inTitle: isTitle });
      }
    }
  };

  return {
    add(doc) {
      documentCount++;
      addField(doc.id, doc.title, TITLE_WEIGHT, true);
      addField(doc.id, doc.body, 1, false);
    },
    build() {
      const sortedTerms = [...postings.keys()].sort();
      return { documentCount, postings, sortedTerms };
    },
  };
}

export function buildLexicalIndex(
  documents: Iterable<LexicalDocument>,
): LexicalIndex {
  const builder = createLexicalIndexBuilder();
  for (const doc of documents) builder.add(doc);
  return builder.build();
}

/** Inverse document frequency, BM25 flavour — always positive. */
function idf(documentCount: number, documentFrequency: number): number {
  return Math.log(
    1 +
      (documentCount - documentFrequency + 0.5) / (documentFrequency + 0.5),
  );
}

/** First index in `sorted` whose value is >= `target` (lower bound). */
function lowerBound(sorted: readonly string[], target: string): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid]! < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Terms an indexed query term should score against: itself, plus every term
 * it prefixes. Every string with `term` as a prefix sorts >= `term` and forms
 * one contiguous block, so a binary search to the block's start and a walk
 * until the prefix stops matching replaces scanning the whole vocabulary —
 * O(log V + matches) rather than O(V) on every keystroke.
 */
function expand(
  index: LexicalIndex,
  term: string,
): Array<{ term: string; weight: number }> {
  const out: Array<{ term: string; weight: number }> = [];
  if (index.postings.has(term)) out.push({ term, weight: 1 });
  if (term.length < PREFIX_MIN_LENGTH) return out;
  const { sortedTerms } = index;
  for (let i = lowerBound(sortedTerms, term); i < sortedTerms.length; i++) {
    const candidate = sortedTerms[i]!;
    if (!candidate.startsWith(term)) break;
    if (candidate !== term) out.push({ term: candidate, weight: PREFIX_WEIGHT });
  }
  return out;
}

/** Documents matching any query term, best-first. Non-matching docs are absent. */
export function searchLexicalIndex(
  index: LexicalIndex,
  query: string,
  options: { limit?: number } = {},
): LexicalMatch[] {
  const terms = [...new Set(tokenizeSearchText(query))];
  if (terms.length === 0 || index.documentCount === 0) return [];

  interface Accumulator {
    score: number;
    inTitle: boolean;
    /** idf mass of the distinct query terms this document matched. */
    coverage: number;
  }
  const scores = new Map<string, Accumulator>();
  let queryMass = 0;

  for (const term of terms) {
    let termIdf = 0;
    const matchedDocs = new Set<string>();

    for (const expanded of expand(index, term)) {
      const byDoc = index.postings.get(expanded.term);
      if (!byDoc) continue;
      const termWeight = idf(index.documentCount, byDoc.size);
      termIdf = Math.max(termIdf, termWeight);
      const weight = termWeight * expanded.weight;
      for (const [docId, posting] of byDoc) {
        const contribution =
          weight * (posting.tf / (posting.tf + TF_SATURATION));
        const current = scores.get(docId);
        if (current) {
          current.score += contribution;
          current.inTitle ||= posting.inTitle;
        } else {
          scores.set(docId, {
            score: contribution,
            inTitle: posting.inTitle,
            coverage: 0,
          });
        }
        matchedDocs.add(docId);
      }
    }

    // A term nothing matched still weighs on the denominator, or a query whose
    // rare half hits nothing would look fully covered by its common half.
    queryMass += termIdf > 0 ? termIdf : idf(index.documentCount, 1);
    for (const docId of matchedDocs) scores.get(docId)!.coverage += termIdf;
  }

  const matches: LexicalMatch[] = [];
  for (const [id, value] of scores) {
    // Documents carrying more of the query win. Weighted by idf rather than by
    // term count, so missing "de" costs almost nothing while missing
    // "marruecos" costs most of the score.
    const coverage = queryMass > 0 ? value.coverage / queryMass : 1;
    matches.push({ id, score: value.score * coverage, inTitle: value.inTitle });
  }
  matches.sort((a, b) => b.score - a.score);
  return options.limit === undefined ? matches : matches.slice(0, options.limit);
}
