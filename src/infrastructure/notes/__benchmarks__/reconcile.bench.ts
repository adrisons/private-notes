/**
 * Vault reconcile benchmark.
 *
 * `reconcileVault` reads the note index, lists every `.md` file recursively and
 * re-parses each one to detect drift. It runs on vault open, so its cost sets a
 * floor on startup time as the corpus grows. The generated vault's on-disk
 * index already matches the note files, so no rewrite happens — this measures
 * the repeatable scan cost.
 *
 * Run with `pnpm bench` (not part of `pnpm test`).
 */
import { bench, describe } from "vitest";
import { buildFakeVault, SCALES } from "../../../test/loadgen";
import { reconcileVault } from "../reconcile";

// Embeddings are irrelevant to reconcile; skip them to build faster. Prebuilt
// up front because Vitest's benchmark mode does not run suite-level `beforeAll`.
const corpora = await Promise.all(
  SCALES.map((notes) =>
    buildFakeVault({ notes, chunksPerNote: 2, withEmbeddings: false }),
  ),
);

corpora.forEach((corpus, i) => {
  describe(`reconcileVault · ${SCALES[i]} notes`, () => {
    bench("reconcile", async () => {
      await reconcileVault(corpus.root);
    });
  });
});
