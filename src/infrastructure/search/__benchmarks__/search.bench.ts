/**
 * Semantic-search scaling benchmark — the app's #1 client-side bottleneck.
 *
 * `searchSemantic` streams *every* note's embedding file and scores each chunk
 * on the main thread (O(total chunks) per query, no ANN index, no cross-query
 * cache). These benches measure how query latency grows with the corpus so
 * performance work can be guided by numbers.
 *
 * Run with `pnpm bench` (not part of `pnpm test`).
 */
import { bench, describe } from "vitest";
import { buildFakeVault, SCALES } from "../../../test/loadgen";
import { searchSemantic } from "../search";
import { dot } from "../embedder";

// One query reused across scales so only the corpus size varies.
const QUERY = "project meeting plan performance";

// Prebuild corpora up front: Vitest's benchmark mode does not run suite-level
// `beforeAll`, so top-level await is the reliable way to prepare fixtures.
const corpora = await Promise.all(
  SCALES.map((notes) => buildFakeVault({ notes, chunksPerNote: 4 })),
);

corpora.forEach((corpus, i) => {
  describe(`searchSemantic · ${SCALES[i]} notes`, () => {
    bench("query", async () => {
      await searchSemantic(corpus.root, QUERY, corpus.embedder, {
        topK: 8,
        minScore: 0.15,
        relativeCutoff: 0.6,
      });
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
