import type { NoteSummary } from "../note/note-summary";

/** Pure helpers over the open vault's note summaries (index is a derivable cache). */
export function sortSummariesByRecency(
  summaries: NoteSummary[],
): NoteSummary[] {
  return [...summaries].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Most recently touched note, or null when the vault has no notes. */
export function pickMostRecent(
  summaries: NoteSummary[],
): NoteSummary | null {
  const sorted = sortSummariesByRecency(summaries);
  return sorted[0] ?? null;
}
