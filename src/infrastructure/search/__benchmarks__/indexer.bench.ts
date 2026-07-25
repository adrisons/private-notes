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
import { writeContentHashes } from "../index-fs";

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
  corpora.map((corpus) => reindex(corpus.root, corpus.reindexNotes, corpus.embedder)),
);

// NOTE: this harness understates the real win. The fake FS keeps files in
// memory (no I/O latency) and FakeEmbedder is 32-dim, so the vectors files are
// ~12x smaller than production's 384-dim and cheap to parse. The delta below is
// only the JSON-parse cost skipped; in the browser over OPFS with 384-dim
// vectors it is a real read of the whole vectors corpus, avoided on every
// reload (and again in pruneOrphans, which this bench does not cover).
corpora.forEach((corpus, i) => {
  describe(`reindex (no-op scan) · ${SCALES[i]} notes`, () => {
    // Empty the hint file first so every note falls back to reading and parsing
    // its vectors — the pre-ADR-011 behaviour. The reset is one write, dwarfed
    // by the scan it precedes.
    bench("cold (reads every vectors file)", async () => {
      await writeContentHashes(corpus.root, {});
      await reindex(corpus.root, corpus.reindexNotes, corpus.embedder);
    });

    bench("warm (hint-backed, skips vectors)", async () => {
      await reindex(corpus.root, corpus.reindexNotes, corpus.embedder);
    });
  });
});
