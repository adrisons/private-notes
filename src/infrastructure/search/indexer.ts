import { readText } from "../fs/handle";
import { parseNote } from "../../domain/note/frontmatter";
import { sha256Hex } from "../attachments/hash";
import {
  clearSemanticIndex,
  deleteNoteEmbeddings,
  iterateNoteEmbeddings,
  readNoteEmbeddings,
  readSemanticManifest,
  writeNoteEmbeddings,
  writeSemanticManifest,
} from "./index-fs";
import { chunkText } from "./chunk";
import { toPassageInput, type Embedder } from "./embedder";
import {
  SEMANTIC_SCHEMA_VERSION,
  TITLE_CHUNK_IDX,
  type ChunkRecord,
  type NoteEmbeddings,
} from "./types";
import type { NoteRecord } from "../fs/schema";

export interface IndexerOptions {
  /** Batch size for the embedder. Larger = fewer worker round-trips. */
  batchSize?: number;
  /** Progress callback. `total` may grow as work is discovered. */
  onProgress?: (progress: { done: number; total: number }) => void;
}

/**
 * The title is part of what gets embedded, so renaming a note has to
 * invalidate its vectors just like editing it does.
 */
async function contentFingerprint(title: string, body: string): Promise<string> {
  return sha256Hex(new TextEncoder().encode(`${title}\n\n${body}`));
}

/**
 * Returns true when the embeddings file is missing, was written for a
 * different model/schema, or points at a stale `contentHash`.
 */
async function needsReindex(
  root: FileSystemDirectoryHandle,
  note: NoteRecord,
  embedder: Embedder,
  body: string,
): Promise<{ stale: true; hash: string } | { stale: false }> {
  const existing = await readNoteEmbeddings(root, note.id);
  const hash = await contentFingerprint(note.title, body);
  if (!existing) return { stale: true, hash };
  if (existing.schemaVersion !== SEMANTIC_SCHEMA_VERSION) {
    return { stale: true, hash };
  }
  if (
    existing.modelId !== embedder.id ||
    existing.dimensions !== embedder.dimensions
  ) {
    return { stale: true, hash };
  }
  if (existing.contentHash !== hash) return { stale: true, hash };
  return { stale: false };
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
  notes: NoteRecord[],
  embedder: Embedder,
  options: IndexerOptions = {},
): Promise<{ embedded: number; skipped: number }> {
  await ensureSemanticManifest(root, embedder);
  const batchSize = options.batchSize ?? 16;
  const progress = options.onProgress ?? (() => {});

  // First pass: identify stale notes; skip ones still valid.
  type Work = { note: NoteRecord; body: string; hash: string };
  const work: Work[] = [];
  let skipped = 0;
  for (const note of notes) {
    const text = await readText(root, note.path);
    const body = parseNote(text).body;
    const status = await needsReindex(root, note, embedder, body);
    if (status.stale) {
      work.push({ note, body, hash: status.hash });
    } else {
      skipped++;
    }
  }

  let done = 0;
  const total = work.length;
  progress({ done, total });

  for (const item of work) {
    const plan = planChunks(item.note.title, item.body, embedder);
    if (plan.length === 0) {
      // Empty note: persist an empty embeddings record so we do not retry.
      await writeNoteEmbeddings(root, {
        noteId: item.note.id,
        filePath: item.note.path,
        contentHash: item.hash,
        modelId: embedder.id,
        dimensions: embedder.dimensions,
        schemaVersion: SEMANTIC_SCHEMA_VERSION,
        updatedAt: new Date().toISOString(),
        chunks: [],
      });
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
      filePath: item.note.path,
      contentHash: item.hash,
      modelId: embedder.id,
      dimensions: embedder.dimensions,
      schemaVersion: SEMANTIC_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      chunks: plan.map((c, j) => ({ ...c.record, embedding: vectors[j]! })),
    };
    await writeNoteEmbeddings(root, record);
    done++;
    progress({ done, total });
  }

  // Garbage-collect embeddings for notes that no longer exist.
  const liveIds = new Set(notes.map((n) => n.id));
  // We do not iterate aggressively here — callers can call `pruneOrphans`
  // separately to keep `reindex` predictable.
  void liveIds;

  return { embedded: total, skipped };
}

/** Remove `.semantic-index/notes/*.json` entries that reference deleted notes. */
export async function pruneOrphans(
  root: FileSystemDirectoryHandle,
  liveIds: Iterable<string>,
): Promise<number> {
  const live = new Set(liveIds);
  const stale: string[] = [];
  for await (const rec of iterateNoteEmbeddings(root)) {
    if (!live.has(rec.noteId)) stale.push(rec.noteId);
  }
  for (const id of stale) await deleteNoteEmbeddings(root, id);
  return stale.length;
}
