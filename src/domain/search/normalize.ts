/**
 * Text folding for search. Spanish is typed without accents at least as often
 * as with them ("limon", "japon", "reunion"), so a comparison that keeps them
 * apart is wrong by default rather than merely strict.
 *
 * Folding also strips the tilde from `ñ`, which collapses `año`/`ano`. That is
 * the standard trade-off for diacritic-insensitive search: query and document
 * are folded with the same function, so the pair still matches, and the only
 * cost is a rare collision between two unrelated words.
 */

const DIACRITICS = /\p{Diacritic}/gu;
const WORD = /[\p{L}\p{N}]+/gu;

/** Lowercase, accent-free form used for every substring comparison. */
export function foldSearchText(text: string): string {
  return text.normalize("NFD").replace(DIACRITICS, "").toLowerCase();
}

/**
 * Shortest stem we are willing to produce. Spanish is full of four-letter
 * words whose final vowel is part of the root, not an ending: trimming `casa`
 * to `cas` would merge it with `caso`, and `masa` with `mas`. Above this
 * length the ending is nearly always inflection.
 */
const MIN_STEM_LENGTH = 4;

/**
 * Collapse Spanish inflection so that a query and a note agree about a word.
 *
 * Notes are written in natural language: a recipe says "plato vegetarian**o**"
 * and the query is "receta vegetarian**a**"; a note is filed under "Viaje**s**"
 * and the query is "viaje". Without this, those are simply different words and
 * neither matches — a gap that only shows up once the fixture corpus is
 * written in real Spanish rather than in matching keywords.
 *
 * This is number and gender only — the endings that carry no meaning for
 * search. It is *not* a stemmer: `trimestral` and `trimestre` stay apart,
 * because merging derivations needs a real Snowball-class algorithm and its
 * false merges. Applied identically at index and query time, so the index on
 * disk is unaffected (it stores prose, not terms).
 */
export function foldInflection(term: string): string {
  let stem = term;
  if (stem.endsWith("es") && stem.length - 2 >= MIN_STEM_LENGTH) {
    stem = stem.slice(0, -2);
  } else if (stem.endsWith("s") && stem.length - 1 >= MIN_STEM_LENGTH) {
    stem = stem.slice(0, -1);
  }
  const last = stem[stem.length - 1];
  if (
    (last === "a" || last === "o" || last === "e") &&
    stem.length - 1 >= MIN_STEM_LENGTH
  ) {
    stem = stem.slice(0, -1);
  }
  return stem;
}

/** Words as the index sees them: folded, punctuation dropped, digits kept. */
export function tokenizeSearchText(text: string): string[] {
  const words = foldSearchText(text).match(WORD) ?? [];
  return words.map(foldInflection);
}
