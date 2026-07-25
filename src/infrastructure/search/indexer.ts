import { readText } from "../fs/handle";
import { PATHS } from "../fs/schema";
import { parseNoteIndex } from "../fs/validate";
import { parseJson } from "../../lib/validate";
import { sha256Hex } from "../attachments/hash";
import type { ReindexNoteInput } from "../../application/ports/semantic-search";
import {
  clearSemanticIndex,
  deleteNoteEmbeddings,
  hasNoteEmbeddings,
  listNoteEmbeddingIds,
  readContentHashes,
  readNoteEmbeddings,
  readSemanticManifest,
  writeContentHashes,
  writeNoteEmbeddings,
  writeSemanticManifest,
} from "./index-fs";
import { chunkText } from "./chunk";
import { toPassageInput, type Embedder } from "./embedder";
import {
  SEMANTIC_SCHEMA_VERSION,
  TITLE_CHUNK_IDX,
  type ChunkRecord,
  type ContentHashIndex,
  type NoteEmbeddings,
} from "./types";

export interface IndexerOptions {
  /** Batch size for the embedder. Larger = fewer worker round-trips. */
  batchSize?: number;
  /** Progress callback. `total` may grow as work is discovered. */
  onProgress?: (progress: { done: number; total: number }) => void;
}

/**
 * Workers to run the staleness scan with. Each note still needs a vectors-file
 * read when the content-hash hint cannot settle the question, and those checks
 * are independent between notes.
 */
const STALENESS_SCAN_CONCURRENCY = 12;

async function loadNotePaths(
  root: FileSystemDirectoryHandle,
): Promise<Map<string, string>> {
  try {
    const text = await readText(root, PATHS.index);
    const index = parseNoteIndex(parseJson(text, PATHS.index), PATHS.index);
    return new Map(index.notes.map((note) => [note.id, note.path]));
  } catch {
    return new Map();
  }
}

/**
 * Map with a fixed pool of workers pulling from a shared cursor, preserving
 * input order in the result so the embedding pass and progress stay
 * deterministic.
 */
async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const worker = async (): Promise<void> => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index]!, index);
    }
  };
  const size = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: size }, () => worker()));
  return results;
}

/**
 * The title is part of what gets embedded, so renaming a note has to
 * invalidate its vectors just like editing it does.
 */
async function contentFingerprint(title: string, body: string): Promise<string> {
  return sha256Hex(new TextEncoder().encode(`${title}\n\n${body}`));
}

/**
 * Reads the note's vectors file and returns true when it is missing, was
 * written for a different model/schema, or points at a stale `contentHash`.
 *
 * This is the precise, authoritative check. `reindex` only reaches for it when
 * the cheap content-hash hint could not settle the question — so on a steady
 * reload of an unchanged vault it is not called at all (ADR-011).
 */
async function needsReindex(
  root: FileSystemDirectoryHandle,
  noteId: string,
  embedder: Embedder,
  hash: string,
): Promise<boolean> {
  const existing = await readNoteEmbeddings(root, noteId);
  if (!existing) return true;
  if (existing.schemaVersion !== SEMANTIC_SCHEMA_VERSION) return true;
  if (
    existing.modelId !== embedder.id ||
    existing.dimensions !== embedder.dimensions
  ) {
    return true;
  }
  return existing.contentHash !== hash;
}

interface PlannedChunk {
  record: Omit<ChunkRecord, "embedding">;
  /** Exactly what goes to the model — never the same string as `record.text`. */
  input: string;
}

/**
 * Decide what to embed for one note.
 *
 * The title used to be invisible to search: it lives in frontmatter, and
 * `parseNote` strips frontmatter before chunking, so a note called "Tiradito
 * de pescado" could not be found by the word *pescado* unless the recipe
 * happened to repeat it. Two things fix that, and they fix different halves:
 *
 * - a **title-only vector**, so a title match scores on its own instead of
 *   being averaged into two hundred words of method;
 * - the **title prefixed onto every body chunk**, so a chunk about marinating
 *   still knows what dish it belongs to.
 */
function planChunks(
  rawTitle: string,
  body: string,
  embedder: Embedder,
): PlannedChunk[] {
  const title = rawTitle.trim();
  const planned: PlannedChunk[] = [];
  if (title.length > 0) {
    planned.push({
      record: {
        idx: TITLE_CHUNK_IDX,
        kind: "title",
        text: title,
        offset: 0,
        length: 0,
      },
      input: toPassageInput(embedder, title),
    });
  }
  for (const chunk of chunkText(body)) {
    planned.push({
      record: { ...chunk, kind: "body" },
      input: toPassageInput(
        embedder,
        title.length > 0 ? `${title}\n\n${chunk.text}` : chunk.text,
      ),
    });
  }
  return planned;
}

/**
 * Make sure the semantic-index manifest matches the active embedder. If it
 * does not, the whole index is dropped — embeddings from different models
 * must never be mixed (the brief is firm on this).
 */
export async function ensureSemanticManifest(
  root: FileSystemDirectoryHandle,
  embedder: Embedder,
): Promise<void> {
  const current = await readSemanticManifest(root);
  if (
    current &&
    current.schemaVersion === SEMANTIC_SCHEMA_VERSION &&
    current.modelId === embedder.id &&
    current.dimensions === embedder.dimensions
  ) {
    return;
  }
  await clearSemanticIndex(root);
  await writeSemanticManifest(root, {
    schemaVersion: SEMANTIC_SCHEMA_VERSION,
    modelId: embedder.id,
    dimensions: embedder.dimensions,
  });
}

/**
 * Bring the index up to date for the given notes. New / changed / model-
 * mismatched notes get re-embedded in batches; unchanged notes are skipped.
 */
export async function reindex(
  root: FileSystemDirectoryHandle,
  notes: ReindexNoteInput[],
  embedder: Embedder,
  options: IndexerOptions = {},
): Promise<{ embedded: number; skipped: number }> {
  await ensureSemanticManifest(root, embedder);
  const batchSize = options.batchSize ?? 16;
  const progress = options.onProgress ?? (() => {});
  const notePaths = await loadNotePaths(root);

  // Scan-time hints: `noteId → contentHash` we last embedded. They let the
  // up-to-date check skip a note without opening its (large) vectors file,
  // which is the cost that dominates a no-op reindex on reload. A hint is
  // trusted only when it matches a freshly computed hash *and* the vectors
  // file still exists, so a stale or partially-synced hint costs at most a
  // redundant re-embed, never a wrong skip (ADR-011).
  const hints = await readContentHashes(root);
  const nextHints: ContentHashIndex = {};

  // First pass: identify stale notes; skip ones still valid. The per-note check
  // is I/O-bound and independent between notes, so it runs with bounded
  // concurrency; the results are folded back in input order below.
  type Work = { note: ReindexNoteInput; hash: string };
  type Scan =
    | { note: ReindexNoteInput; hash: string; stale: false }
    | { note: ReindexNoteInput; hash: string; stale: true };

  const scans = await mapWithConcurrency(
    notes,
    STALENESS_SCAN_CONCURRENCY,
    async (note): Promise<Scan> => {
      const hash = await contentFingerprint(note.title, note.body);
      if (hints[note.id] === hash && (await hasNoteEmbeddings(root, note.id))) {
        // Fast path: body unchanged and its vectors are on disk. Never opens the
        // vectors file. This is what makes a reload scan cheap.
        return { note, hash, stale: false };
      }
      // Hint missing, stale, or the vectors file vanished — verify precisely.
      // Also the first run after upgrade, when no hint file exists yet: this
      // pass re-populates the hints so subsequent scans take the fast path.
      if (await needsReindex(root, note.id, embedder, hash)) {
        return { note, hash, stale: true };
      }
      return { note, hash, stale: false };
    },
  );

  const work: Work[] = [];
  let skipped = 0;
  for (const scan of scans) {
    if (scan.stale) {
      work.push({ note: scan.note, hash: scan.hash });
    } else {
      nextHints[scan.note.id] = scan.hash;
      skipped++;
    }
  }

  let done = 0;
  const total = work.length;
  progress({ done, total });

  for (const item of work) {
    const filePath = notePaths.get(item.note.id) ?? "";
    const plan = planChunks(item.note.title, item.note.body, embedder);
    if (plan.length === 0) {
      // Empty note: persist an empty embeddings record so we do not retry.
      await writeNoteEmbeddings(root, {
        noteId: item.note.id,
        filePath,
        contentHash: item.hash,
        modelId: embedder.id,
        dimensions: embedder.dimensions,
        schemaVersion: SEMANTIC_SCHEMA_VERSION,
        updatedAt: new Date().toISOString(),
        chunks: [],
      });
      nextHints[item.note.id] = item.hash;
      done++;
      progress({ done, total });
      continue;
    }

    const vectors: number[][] = [];
    for (let i = 0; i < plan.length; i += batchSize) {
      const batch = plan.slice(i, i + batchSize).map((c) => c.input);
      const out = await embedder.embed(batch);
      vectors.push(...out);
    }

    const record: NoteEmbeddings = {
      noteId: item.note.id,
      filePath,
      contentHash: item.hash,
      modelId: embedder.id,
      dimensions: embedder.dimensions,
      schemaVersion: SEMANTIC_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      chunks: plan.map((c, j) => ({
        ...c.record,
        embedding: new Float32Array(vectors[j]!),
      })),
    };
    await writeNoteEmbeddings(root, record);
    nextHints[item.note.id] = item.hash;
    done++;
    progress({ done, total });
  }

  // Persist the hints last. The per-note vectors files are the source of truth
  // and are already written, so losing this write only costs a slower next
  // scan. Built from the live `notes` only, so a note that disappeared drops
  // out of the map here without a separate cleanup pass.
  await writeContentHashes(root, nextHints);

  return { embedded: total, skipped };
}

/** Remove `.semantic-index/notes/*.json` entries that reference deleted notes. */
export async function pruneOrphans(
  root: FileSystemDirectoryHandle,
  liveIds: Iterable<string>,
): Promise<number> {
  const live = new Set(liveIds);
  // Orphans are found from directory *names* — the filename is the note id, so
  // this never opens or parses a vectors file. Reload runs this before every
  // reindex, so parsing them all here would undo the reindex fast path.
  const stale = (await listNoteEmbeddingIds(root)).filter((id) => !live.has(id));
  for (const id of stale) await deleteNoteEmbeddings(root, id);

  // Keep the hint map in step with what is actually on disk.
  if (stale.length > 0) {
    const hints = await readContentHashes(root);
    let changed = false;
    for (const id of stale) {
      if (id in hints) {
        delete hints[id];
        changed = true;
      }
    }
    if (changed) await writeContentHashes(root, hints);
  }
  return stale.length;
}
