import { foldSearchText, tokenizeSearchText } from "./normalize";
import { scoreDateProximity, type DateQuery } from "../../lib/parse-date-query";

/**
 * Ranking policy. Everything here is pure: given signals, produce one ordered
 * list. The rule it exists to enforce is that there is exactly *one* list —
 * concatenating "semantic results" and "title results" is what put a note
 * titled *Tiradito de pescado* below eight weak cosine matches for the query
 * "pescado".
 */

export type MatchKind =
  /** The query matched the note's title. */
  | "title"
  /** The query named a space the note is filed under. */
  | "space"
  /** A literal term match in the note body. */
  | "text"
  /** Vector similarity only. */
  | "semantic"
  /** Ranked by how close its creation date is to a parsed date query. */
  | "date"
  /** Not a match at all — the recency list shown for an empty query. */
  | "recent";

/**
 * Reciprocal Rank Fusion constant. 60 is the value from the original TREC
 * work and the one every implementation uses; it flattens the head of each
 * list just enough that a rank-1 hit cannot single-handedly win a fusion.
 */
const RRF_K = 60;

/**
 * Fuse rankings that live on incomparable scales — a cosine similarity and a
 * BM25 weight cannot be added or averaged meaningfully, but their *positions*
 * can. Scores come back normalised to [0, 1] so callers can add bonuses in
 * known units.
 */
/**
 * With only two rankings, exact ties are common — swapping two documents
 * between positions 1 and 2 of both lists produces identical sums. Ties
 * resolve to the ranking passed **first**, so callers order the argument by
 * which signal should win an argument. That is a guarantee, not an accident
 * of `Map` iteration: `searchSemantic` relies on it to prefer a literal match
 * over a vector one, which is the more explainable of the two.
 */
export function fuseRankings(
  rankings: ReadonlyArray<readonly string[]>,
  k: number = RRF_K,
): Array<{ id: string; score: number }> {
  const totals = new Map<string, number>();
  for (const ranking of rankings) {
    ranking.forEach((id, index) => {
      totals.set(id, (totals.get(id) ?? 0) + 1 / (k + index + 1));
    });
  }
  if (totals.size === 0) return [];
  const max = Math.max(...totals.values());
  const fused = [...totals].map(([id, score]) => ({ id, score: score / max }));
  fused.sort((a, b) => b.score - a.score);
  return fused;
}

/**
 * Drop hits that are not competitive with the best one. The ratio is measured
 * from `floor`, not from zero, because a model's scores do not start at zero:
 * E5-style models compress everything into roughly 0.7–0.9, so "60% of the
 * top score" would keep the entire vault. Measured from the floor, the same
 * 60% is a real discriminator.
 */
export const DEFAULT_RELATIVE_CUTOFF = 0.6;

export function applyRelativeCutoff<T extends { score: number }>(
  items: readonly T[],
  options: { ratio: number; floor?: number },
): T[] {
  if (items.length === 0 || options.ratio <= 0) return [...items];
  const floor = options.floor ?? 0;
  const top = Math.max(...items.map((item) => item.score));
  const headroom = top - floor;
  if (headroom <= 0) return [...items];
  const threshold = floor + options.ratio * headroom;
  return items.filter((item) => item.score >= threshold);
}

/**
 * Bonuses in the same units as a normalised content score ([0, 1]), so an
 * exact title match at 1.2 cannot be outranked by any cosine — a note called
 * exactly what you typed is the answer, whatever the vectors think. The tiers
 * are exclusive; the space bonus stacks on top of whichever one fires.
 */
export const RELEVANCE_BONUS = {
  exactTitle: 1.2,
  titleStartsWith: 0.8,
  titleContains: 0.5,
  titleTerms: 0.35,
  /** The query is entirely a space name — "africa", "viajes". */
  spaceName: 0.2,
  /** A space name explains only part of the query — "receta vegetariana". */
  spaceTerm: 0.1,
} as const;

function collapse(text: string): string {
  return foldSearchText(text).replace(/\s+/g, " ").trim();
}

export function titleBonus(query: string, title: string): number {
  const q = collapse(query);
  const t = collapse(title);
  if (q.length === 0 || t.length === 0) return 0;
  if (t === q) return RELEVANCE_BONUS.exactTitle;
  if (t.startsWith(q)) return RELEVANCE_BONUS.titleStartsWith;
  if (t.includes(q)) return RELEVANCE_BONUS.titleContains;
  const titleTerms = new Set(tokenizeSearchText(title));
  const queryTerms = tokenizeSearchText(query);
  if (
    queryTerms.length > 0 &&
    queryTerms.every((term) => titleTerms.has(term))
  ) {
    return RELEVANCE_BONUS.titleTerms;
  }
  return 0;
}

export interface SpaceSignal {
  bonus: number;
  /**
   * True when every query term is a space name. The query is then purely a
   * concept — "africa" — and the space alone is reason enough to show a note.
   */
  whole: boolean;
}

/**
 * How much the spaces a note is filed under explain the query.
 *
 * This is what makes concept search work without asking anything of the
 * embedding model: "africa" finds Moroccan recipes, an Egyptian trip and an
 * offsite in Marrakech because the user filed all of them under *África* —
 * not because a model knows where Marrakech is. It is deterministic, it is
 * visible in the palette as a chip, and it degrades honestly: notes nobody
 * filed are not found by concept, and no model quality changes that.
 *
 * Term-by-term rather than whole-query, because the useful shape is mixed:
 * "receta vegetariana" is one term naming a space and one term selecting
 * within it. A partial match only reorders notes that already match on
 * content — otherwise every recipe in the vault would surface for the word
 * "receta" alone.
 */
export function spaceSignal(
  query: string,
  spaceNames: readonly string[] = [],
): SpaceSignal {
  const none = { bonus: 0, whole: false };
  const terms = new Set(tokenizeSearchText(query));
  if (terms.size === 0 || spaceNames.length === 0) return none;
  const spaceTerms = new Set(spaceNames.flatMap(tokenizeSearchText));
  let matched = 0;
  for (const term of terms) if (spaceTerms.has(term)) matched++;
  if (matched === 0) return none;
  const whole = matched === terms.size;
  return {
    bonus: whole ? RELEVANCE_BONUS.spaceName : RELEVANCE_BONUS.spaceTerm,
    whole,
  };
}

/** A note as the ranker sees it — whatever the caller already has in memory. */
export interface RankableNote {
  id: string;
  title: string;
  /** UTC ISO creation timestamp, needed only when a date query is fused in. */
  createdAt?: string;
  spaceNames?: readonly string[];
}

/**
 * Weight of the date-proximity signal in a *mixed* query, in the same [0, 1]
 * units as a content score. Held below the title bonuses on purpose: in a
 * mixed query content decides *which* notes are answers and proximity only
 * reorders comparable ones, so a note the user is clearly asking for by name
 * cannot be pushed down by a closer-but-irrelevant note's timestamp.
 */
const DATE_PROXIMITY_WEIGHT = 0.5;

/** Content relevance from the index, best-first, one or more entries per note. */
export interface ContentHit {
  noteId: string;
  /** Normalised to [0, 1] by the retrieval stage. */
  score: number;
  matchKind: MatchKind;
}

export interface RankedNote {
  noteId: string;
  score: number;
  matchKind: MatchKind;
}

/**
 * The single merged ranking. Content relevance comes from the index (which
 * knows bodies), title and space signals come from the caller's in-memory
 * note list (which is authoritative and current even while the index is still
 * building) — so a title match surfaces on the first keystroke of a fresh
 * vault, before a single vector exists.
 */
export function rankNotes(options: {
  query: string;
  content: readonly ContentHit[];
  notes: readonly RankableNote[];
  /** Parsed date expression, fused as a third signal (ADR-011). */
  dateQuery?: DateQuery | null;
  limit?: number;
}): RankedNote[] {
  const query = options.query.trim();
  const dateQuery = options.dateQuery ?? null;

  // Pure date ("agosto 2025"): no text to embed, so rank the whole in-memory
  // note list by creation-date proximity. This is the instant, index-free
  // path — it needs neither the embedder nor a disk read and works before a
  // single vector exists.
  if (dateQuery && query.length === 0) {
    const ranked = options.notes.map((note) => ({
      noteId: note.id,
      score: note.createdAt ? scoreDateProximity(note.createdAt, dateQuery) : 0,
      matchKind: "date" as MatchKind,
    }));
    // Stable sort keeps the caller's order (recency) among equal proximities.
    ranked.sort((a, b) => b.score - a.score);
    return options.limit === undefined ? ranked : ranked.slice(0, options.limit);
  }

  if (query.length === 0) return [];

  interface Bonus {
    title: number;
    space: SpaceSignal;
  }
  const bonuses = new Map<string, Bonus>();
  for (const note of options.notes) {
    const title = titleBonus(query, note.title);
    const space = spaceSignal(query, note.spaceNames);
    if (title > 0 || space.bonus > 0) bonuses.set(note.id, { title, space });
  }

  const total = (bonus: Bonus | undefined) =>
    bonus ? bonus.title + bonus.space.bonus : 0;

  const kindFor = (bonus: Bonus | undefined, fallback: MatchKind): MatchKind => {
    if (!bonus) return fallback;
    if (bonus.title > 0) return "title";
    return bonus.space.bonus > 0 ? "space" : fallback;
  };

  const ranked: RankedNote[] = [];
  const seen = new Set<string>();
  for (const hit of options.content) {
    if (seen.has(hit.noteId)) continue;
    seen.add(hit.noteId);
    const bonus = bonuses.get(hit.noteId);
    ranked.push({
      noteId: hit.noteId,
      score: hit.score + total(bonus),
      matchKind: kindFor(bonus, hit.matchKind),
    });
  }
  for (const note of options.notes) {
    if (seen.has(note.id)) continue;
    const bonus = bonuses.get(note.id);
    // A note the index did not return is worth showing on a title match or a
    // pure concept query, and only then. A space that explains half the query
    // reorders results; it does not conjure the whole space into the list.
    if (!bonus || (bonus.title === 0 && !bonus.space.whole)) continue;
    seen.add(note.id);
    ranked.push({
      noteId: note.id,
      score: total(bonus),
      matchKind: kindFor(bonus, "title"),
    });
  }

  // Mixed query ("pescado agosto 2025"): content already chose *which* notes;
  // add proximity so date decides the order among comparable matches. It is
  // only added to notes the content stage already surfaced — a date must not
  // conjure a note into the list, nor filter a strong content match out.
  if (dateQuery) {
    const createdAt = new Map(
      options.notes.map((note) => [note.id, note.createdAt]),
    );
    for (const item of ranked) {
      const iso = createdAt.get(item.noteId);
      if (iso) item.score += DATE_PROXIMITY_WEIGHT * scoreDateProximity(iso, dateQuery);
    }
  }

  // Stable sort: ties keep the order the caller supplied, which is content
  // relevance first and then the note list's own order (recency).
  ranked.sort((a, b) => b.score - a.score);
  return options.limit === undefined ? ranked : ranked.slice(0, options.limit);
}
