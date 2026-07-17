import type { NoteRecord } from "../ports/note-record";
import type { Embedder } from "../ports/embedder";
import type { SemanticSearch } from "../ports/semantic-search";
import type { VaultSession } from "../vault-session";
import type { ReindexProgress } from "../view-models";
import { registerBackgroundError } from "../errors";

export interface RunFullReindexOptions {
  onProgress?: (progress: ReindexProgress) => void;
}

/** Full vault reindex after embedder is ready. */
export async function runFullReindex(
  session: VaultSession,
  search: SemanticSearch,
  embedder: Embedder,
  options: RunFullReindexOptions = {},
): Promise<void> {
  try {
    const live = await session.listNoteRecords();
    await search.pruneOrphans(live.map((n) => n.id));
    await search.reindex(live, embedder, { onProgress: options.onProgress });
  } catch (err) {
    registerBackgroundError("reindex", err);
  }
}

/** Incremental reindex for notes changed since last embed. */
export function scheduleReindex(
  _session: VaultSession,
  search: SemanticSearch,
  embedder: Embedder,
  records: NoteRecord[],
): void {
  if (records.length === 0) return;
  void search.reindex(records, embedder).catch((err) => {
    registerBackgroundError("reindex", err);
  });
}
