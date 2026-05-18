import { readText } from "../fs/handle";
import { parseNote } from "../notes/frontmatter";
import { sha1Hex } from "../attachments/hash";
import {
  clearSemanticIndex,
  deleteNoteEmbeddings,
  readNoteEmbeddings,
  readSemanticManifest,
  writeNoteEmbeddings,
  writeSemanticManifest,
} from "./index-fs";
import { chunkText } from "./chunk";
import type { Embedder } from "./embedder";
import {
  SEMANTIC_SCHEMA_VERSION,
  type NoteEmbeddings,
} from "./types";
import type { NoteRecord } from "../fs/types";

export interface IndexerOptions {
  /** Batch size for the embedder. Larger = fewer worker round-trips. */
  batchSize?: number;
  /** Progress callback. `total` may grow as work is discovered. */
  onProgress?: (progress: { done: number; total: number }) => void;
}

async function bodyHash(body: string): Promise<string> {
  return sha1Hex(new TextEncoder().encode(body));
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
  const hash = await bodyHash(body);
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
    const chunks = chunkText(item.body);
    if (chunks.length === 0) {
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
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize).map((c) => c.text);
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
      chunks: chunks.map((c, j) => ({ ...c, embedding: vectors[j]! })),
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
  const { iterateNoteEmbeddings } = await import("./index-fs");
  const stale: string[] = [];
  for await (const rec of iterateNoteEmbeddings(root)) {
    if (!live.has(rec.noteId)) stale.push(rec.noteId);
  }
  for (const id of stale) await deleteNoteEmbeddings(root, id);
  return stale.length;
}
