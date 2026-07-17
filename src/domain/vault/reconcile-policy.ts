/** Minimal record shape for index reconciliation — no persistence coupling. */
export interface ReconcileRecord {
  id: string;
  title: string;
  path: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReconcileDiff {
  added: number;
  removed: number;
}

/** Stable sort for comparing index snapshots. */
export function sortRecordsById(
  records: ReconcileRecord[],
): ReconcileRecord[] {
  return [...records].sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Dedupe by id (a crash mid-rename can leave two files sharing an id);
 * keep the most recently updated record.
 */
export function dedupeRecordsById(
  records: ReconcileRecord[],
): ReconcileRecord[] {
  const byId = new Map<string, ReconcileRecord>();
  for (const record of records) {
    const existing = byId.get(record.id);
    if (!existing || record.updatedAt > existing.updatedAt) {
      byId.set(record.id, record);
    }
  }
  return [...byId.values()];
}

export function computeReconcileDiff(
  priorIds: Set<string>,
  nextIds: Set<string>,
): ReconcileDiff {
  const added = [...nextIds].filter((id) => !priorIds.has(id)).length;
  const removed = [...priorIds].filter((id) => !nextIds.has(id)).length;
  return { added, removed };
}

export function indexSnapshotChanged(
  priorUsable: boolean,
  prior: ReconcileRecord[],
  next: ReconcileRecord[],
): boolean {
  if (!priorUsable) return true;
  return (
    JSON.stringify(sortRecordsById(prior)) !==
    JSON.stringify(sortRecordsById(next))
  );
}
