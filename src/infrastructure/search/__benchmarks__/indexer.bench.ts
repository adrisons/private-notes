/**
 * Reindex scan benchmark.
 *
 * `reindex` first reads, parses and SHA-256-hashes *every* note serially to
 * decide which are stale, then re-embeds the stale ones in batches. These
 * benches measure the repeatable, model-independent part — the up-to-date
 * (no-op) reindex pass that runs on every vault open — as the corpus grows.
 * The cold embedding cost is dominated by the real ONNX model and is measured
 * manually in the E2E runbook (docs/testing.md), not here.
 *
 * Run with `pnpm bench` (not part of `pnpm test`).
 */
import { bench, describe } from "vitest";
import { buildFakeVault, SCALES } from "../../../test/loadgen";
import { reindex } from "../indexer";

// withEmbeddings: index already matches every note, so reindex reads + hashes
// all notes and skips them — the pure scan cost. Prebuilt up front because
// Vitest's benchmark mode does not run suite-level `beforeAll`.
const corpora = await Promise.all(
  SCALES.map((notes) =>
    buildFakeVault({ notes, chunksPerNote: 4, withEmbeddings: true }),
  ),
);

corpora.forEach((corpus, i) => {
  describe(`reindex (no-op scan) · ${SCALES[i]} notes`, () => {
    bench("scan", async () => {
      await reindex(corpus.root, corpus.records, corpus.embedder);
    });
  });
});
