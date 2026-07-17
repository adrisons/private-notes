export interface IndexProgress {
  done: number;
  total: number;
}

/** Label shown while notes are being embedded for semantic search. */
export function formatIndexingLabel(progress: IndexProgress | null): string {
  if (!progress || progress.total <= 0) return "Indexing…";
  const pct = Math.min(
    100,
    Math.round((progress.done / progress.total) * 100),
  );
  return `Indexing ${pct}%`;
}

/** Sidebar status line under the search trigger. */
export function formatIndexStatusLabel(
  ready: boolean,
  reindexing: boolean,
  progress: IndexProgress | null,
): string {
  if (!ready) return "Loading model…";
  if (reindexing) return formatIndexingLabel(progress);
  return "All indexed";
}

export function isIndexStatusInteractive(
  ready: boolean,
  reindexing: boolean,
): boolean {
  return ready && !reindexing;
}
