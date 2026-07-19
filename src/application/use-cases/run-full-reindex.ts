import type { NoteRecord } from "../ports/note-record";
import type { Embedder } from "../ports/embedder";
import type { SemanticSearch } from "../ports/semantic-search";
import type { VaultSession } from "../vault-session";
import type { ReindexProgress } from "../view-models";
import { registerBackgroundError, type BackgroundTaskError } from "../errors";

export interface RunFullReindexOptions {
  onProgress?: (progress: ReindexProgress) => void;
  onBackgroundError?: (error: BackgroundTaskError) => void;
}

const REINDEX_DEBUG = {
  operation: "run-full-reindex",
  module: "application/use-cases/run-full-reindex.ts",
  trace:
    "runFullReindex → session.listNoteRecords → search.pruneOrphans/reindex",
  fixHint:
    "Inspect fs-semantic-search.ts reindex and the embedder worker; retry via IndexStatus.onReindex.",
} as const;

/** Full vault reindex after embedder is ready. Returns a background error if indexing failed. */
export async function runFullReindex(
  session: VaultSession,
  search: SemanticSearch,
  embedder: Embedder,
  options: RunFullReindexOptions = {},
): Promise<BackgroundTaskError | null> {
  try {
    const live = await session.listNoteRecords();
    await search.pruneOrphans(live.map((n) => n.id));
    await search.reindex(live, embedder, { onProgress: options.onProgress });
    return null;
  } catch (err) {
    const error = registerBackgroundError("reindex", err, REINDEX_DEBUG);
    options.onBackgroundError?.(error);
    return error;
  }
}

/** Incremental reindex for notes changed since last embed. */
export function scheduleReindex(
  _session: VaultSession,
  search: SemanticSearch,
  embedder: Embedder,
  records: NoteRecord[],
  onBackgroundError?: (error: BackgroundTaskError) => void,
): void {
  if (records.length === 0) return;
  void search.reindex(records, embedder).catch((err) => {
    const error = registerBackgroundError("reindex", err, {
      ...REINDEX_DEBUG,
      operation: "schedule-reindex",
      trace: "scheduleReindex → search.reindex (incremental)",
      details: { noteIds: records.map((r) => r.id) },
    });
    onBackgroundError?.(error);
  });
}
