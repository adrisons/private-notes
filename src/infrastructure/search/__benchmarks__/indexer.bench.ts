/**
 * Reindex scan benchmark — the cost paid on every vault open / page reload.
 *
 * `reindex` reads and SHA-256-hashes every note to decide which are stale.
 * Before ADR-011 it also opened and JSON-parsed each note's (large) vectors
 * file to compare its `contentHash` — the cost that dominated a no-op scan.
 * Now a `noteId → contentHash` hint file lets an unchanged note be skipped
 * without touching its vectors, so this bench measures the warm reload path:
 * the hint file is present and every note is unchanged.
 *
 * The cold embedding cost is dominated by the real ONNX model and is measured
 * manually in the E2E runbook (docs/testing.md), not here.
 *
 * Run with `pnpm bench` (not part of `pnpm test`).
 */
import { bench, describe } from "vitest";
import { buildFakeVault, SCALES } from "../../../test/loadgen";
import { reindex } from "../indexer";

// withEmbeddings seeds the vectors files but not the hint file (it bypasses
// reindex). Prime each corpus with one reindex so the hint file exists, which
// is the real steady state after the first open. Prebuilt up front because
// Vitest's benchmark mode does not run suite-level `beforeAll`.
const corpora = await Promise.all(
  SCALES.map((notes) =>
    buildFakeVault({ notes, chunksPerNote: 4, withEmbeddings: true }),
  ),
);
await Promise.all(
  corpora.map((corpus) => reindex(corpus.root, corpus.records, corpus.embedder)),
);

corpora.forEach((corpus, i) => {
  describe(`reindex (no-op scan) · ${SCALES[i]} notes`, () => {
    bench("warm rescan (hint-backed)", async () => {
      await reindex(corpus.root, corpus.records, corpus.embedder);
    });
  });
});
