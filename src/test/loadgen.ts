/**
 * Synthetic corpus generator for performance / load benchmarks.
 *
 * Builds vaults of arbitrary size inside an in-memory
 * `FileSystemDirectoryHandle` (the `fakeFs` double) so the indexer, semantic
 * search and reconcile hot paths can be measured as the note corpus grows.
 *
 * This is bench/test infrastructure only — it must never be imported by app
 * code. It reuses the real vault helpers (`initializeVault`, `serializeNote`,
 * `buildNotePath`, `chunkText`, `writeNoteEmbeddings`) so generated vaults are
 * byte-compatible with what the application reads.
 */
import { makeFakeRoot } from "./fakeFs";
import { initializeVault } from "../infrastructure/fs/vault";
import { writeText } from "../infrastructure/fs/handle";
import { PATHS, type NoteIndex, type NoteRecord } from "../infrastructure/fs/schema";
import { buildEmptyIndex } from "../infrastructure/fs/manifest";
import { buildNotePath } from "../infrastructure/notes/path";
import { serializeNote } from "../domain/note/frontmatter";
import { sha256Hex } from "../infrastructure/attachments/hash";
import { chunkText } from "../infrastructure/search/chunk";
import {
  writeNoteEmbeddings,
  writeSemanticManifest,
} from "../infrastructure/search/index-fs";
import { FakeEmbedder, type Embedder } from "../infrastructure/search/embedder";
import {
  SEMANTIC_SCHEMA_VERSION,
  type NoteEmbeddings,
} from "../infrastructure/search/types";

/** Deterministic PRNG (mulberry32) so corpora are byte-for-byte repeatable. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A small multilingual-ish vocabulary. The embedding quality is irrelevant for
// scaling benchmarks; we only need realistic token counts and lexical variety.
const WORDS =
  "note idea project meeting plan search index vector query chunk memory disk vault semantic model embedding token cache latency bottleneck performance data growth scale user document folder markdown title body tag space attachment image render editor keyboard shortcut palette recent draft archive review release feature bug fix refactor test benchmark report baseline budget regression proyecto reunión idea nota búsqueda índice rendimiento crecimiento datos".split(
    " ",
  );

/** Roughly one chunk == `size - overlap` words (see chunk.ts defaults). */
const WORDS_PER_CHUNK = 168;

function generateBody(rng: () => number, targetChunks: number): string {
  const wordCount = Math.max(1, targetChunks) * WORDS_PER_CHUNK;
  const out: string[] = [];
  for (let i = 0; i < wordCount; i++) {
    out.push(WORDS[Math.floor(rng() * WORDS.length)]!);
    // Sprinkle sentence/paragraph breaks so the text is not one giant line.
    if (i > 0 && i % 12 === 0) out.push(".\n");
  }
  return out.join(" ");
}

export interface CorpusOptions {
  /** Number of notes to generate. */
  notes: number;
  /** Approximate chunks per note (controls note body length). Default 4. */
  chunksPerNote?: number;
  /** Embedder used to pre-populate the semantic index. Default `FakeEmbedder`. */
  embedder?: Embedder;
  /**
   * When true (default), pre-populate `.semantic-index/` so search benchmarks
   * have vectors to score. Set false to benchmark a cold full reindex.
   */
  withEmbeddings?: boolean;
  /** Seed for deterministic content. Default 1. */
  seed?: number;
}

export interface Corpus {
  root: FileSystemDirectoryHandle;
  records: NoteRecord[];
  embedder: Embedder;
  /** Total chunks across every note (the semantic-search scan size). */
  totalChunks: number;
}

/**
 * Build an in-memory vault seeded with `notes` synthetic notes (and, by
 * default, their embeddings). Returns the fake root plus the note records and
 * some size metadata for reporting.
 */
export async function buildFakeVault(options: CorpusOptions): Promise<Corpus> {
  const chunksPerNote = options.chunksPerNote ?? 4;
  const embedder = options.embedder ?? new FakeEmbedder();
  const withEmbeddings = options.withEmbeddings ?? true;
  const rng = mulberry32(options.seed ?? 1);

  const root = makeFakeRoot();
  const createdAt = new Date("2026-01-01T00:00:00.000Z");
  await initializeVault(root, createdAt);

  const iso = createdAt.toISOString();
  const records: NoteRecord[] = [];
  const bodies: string[] = [];

  for (let i = 0; i < options.notes; i++) {
    const id = `note-${i.toString().padStart(6, "0")}`;
    const title = `Note ${i} ${WORDS[Math.floor(rng() * WORDS.length)]}`;
    const body = generateBody(rng, chunksPerNote);
    const path = buildNotePath(title, id, createdAt);
    const record: NoteRecord = {
      id,
      title,
      path,
      createdAt: iso,
      updatedAt: iso,
    };
    await writeText(root, path, serializeNote({ id, title, createdAt: iso, updatedAt: iso }, body));
    records.push(record);
    bodies.push(body);
  }

  // Write the note index in a single pass (createNote would rewrite it per note).
  const index: NoteIndex = { ...buildEmptyIndex(), notes: records };
  await writeText(root, PATHS.index, JSON.stringify(index, null, 2));

  let totalChunks = 0;
  if (withEmbeddings) {
    await writeSemanticManifest(root, {
      schemaVersion: SEMANTIC_SCHEMA_VERSION,
      modelId: embedder.id,
      dimensions: embedder.dimensions,
    });
    for (let i = 0; i < records.length; i++) {
      const record = records[i]!;
      const body = bodies[i]!;
      const chunks = chunkText(body);
      const vectors = await embedder.embed(chunks.map((c) => c.text));
      const contentHash = await sha256Hex(new TextEncoder().encode(body));
      const embeddings: NoteEmbeddings = {
        noteId: record.id,
        filePath: record.path,
        contentHash,
        modelId: embedder.id,
        dimensions: embedder.dimensions,
        schemaVersion: SEMANTIC_SCHEMA_VERSION,
        updatedAt: iso,
        chunks: chunks.map((c, j) => ({ ...c, embedding: vectors[j]! })),
      };
      await writeNoteEmbeddings(root, embeddings);
      totalChunks += chunks.length;
    }
  }

  return { root, records, embedder, totalChunks };
}

/** Standard corpus sizes used across the benchmark suite. */
export const SCALES = [100, 1_000, 5_000, 10_000] as const;
