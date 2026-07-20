/**
 * Chunking throughput benchmark.
 *
 * `chunkText` runs synchronously on the main thread every time a note is
 * (re)indexed. These benches measure its cost as note length grows, so autosave
 * + reindex-on-edit stays responsive for large documents.
 *
 * Run with `pnpm bench` (not part of `pnpm test`).
 */
import { bench, describe } from "vitest";
import { chunkText } from "../chunk";

function bodyOfWords(words: number): string {
  const out: string[] = [];
  for (let i = 0; i < words; i++) out.push(`word${i % 500}`);
  return out.join(" ");
}

for (const words of [500, 5_000, 50_000]) {
  const body = bodyOfWords(words);
  describe(`chunkText · ${words} words`, () => {
    bench("chunk", () => {
      chunkText(body);
    });
  });
}
