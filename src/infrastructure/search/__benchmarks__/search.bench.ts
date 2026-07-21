/**
 * Semantic-search scaling benchmark — the app's #1 client-side bottleneck.
 *
 * `searchSemantic` streams *every* note's embedding file and scores each chunk
 * on the main thread (O(total chunks) per query, no ANN index). Two costs are
 * separated here:
 *
 * - **cold** — no lexical cache, so the inverted index is rebuilt from the
 *   whole corpus. This is the first keystroke after a vault opens or reindexes.
 * - **warm** — a session-scoped lexical cache is reused (ADR-010), so only
 *   dense scoring runs. This is every subsequent keystroke in the palette, and
 *   the case that dominates real use.
 *
 * Run with `pnpm bench` (not part of `pnpm test`).
 */
import { bench, describe } from "vitest";
import { buildFakeVault, SCALES } from "../../../test/loadgen";
import { searchSemantic, type LexicalIndexCache } from "../search";
import { dot } from "../embedder";

// One query reused across scales so only the corpus size varies.
const QUERY = "project meeting plan performance";
const OPTIONS = { topK: 8, minScore: 0.15, relativeCutoff: 0.6 } as const;

// Prebuild corpora up front: Vitest's benchmark mode does not run suite-level
// `beforeAll`, so top-level await is the reliable way to prepare fixtures.
const corpora = await Promise.all(
  SCALES.map((notes) => buildFakeVault({ notes, chunksPerNote: 4 })),
);

corpora.forEach((corpus, i) => {
  describe(`searchSemantic · ${SCALES[i]} notes`, () => {
    bench("cold (rebuild lexical index)", async () => {
      await searchSemantic(corpus.root, QUERY, corpus.embedder, OPTIONS);
    });

    // A cache primed once, then reused — the palette's steady state.
    const warm: LexicalIndexCache = { current: null };
    bench("warm (cached lexical index)", async () => {
      await searchSemantic(corpus.root, QUERY, corpus.embedder, OPTIONS, warm);
    });
  });
});

describe("dot product · scoring kernel", () => {
  const DIM = 384; // production embedding dimensionality (MiniLM-L12).
  const a = Array.from({ length: DIM }, (_, i) => Math.sin(i));
  // 10k chunks ~ a mid-size vault worth of vectors scored in one query.
  const vectors = Array.from({ length: 10_000 }, (_, n) =>
    Array.from({ length: DIM }, (_, i) => Math.cos(i + n)),
  );

  bench("score 10k chunks", () => {
    let acc = 0;
    for (const v of vectors) acc += dot(a, v);
    if (acc === Infinity) throw new Error("unreachable");
  });
});
