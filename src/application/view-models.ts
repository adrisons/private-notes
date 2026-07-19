import type { Note, NoteSummary } from "../domain";
import type { SearchHit } from "./ports/search-hit";

/** Sidebar / list row — no persistence fields. */
export interface NoteListItem {
  id: string;
  title: string;
  updatedAt: string;
}

/** Editor chrome + body for the open note. */
export interface OpenNoteState {
  id: string;
  title: string;
  body: string;
  savedAt: string | null;
}

/** Command palette semantic hit — one row per note. */
export interface SearchResultItem {
  noteId: string;
  score: number;
}

/** Reindex progress surfaced in the sidebar. */
export interface ReindexProgress {
  done: number;
  total: number;
}

/** Label shown while notes are being embedded for semantic search. */
export function formatIndexingLabel(progress: ReindexProgress | null): string {
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
  progress: ReindexProgress | null,
  indexError = false,
): string {
  if (!ready) return "Loading model…";
  if (reindexing) return formatIndexingLabel(progress);
  if (indexError) return "Index error — tap to retry";
  return "All indexed";
}

export function isIndexStatusInteractive(
  ready: boolean,
  reindexing: boolean,
  indexError = false,
): boolean {
  return (ready && !reindexing) || indexError;
}

export function toNoteListItem(summary: NoteSummary): NoteListItem {
  return {
    id: summary.id,
    title: summary.title,
    updatedAt: summary.updatedAt,
  };
}

export function toNoteListItems(summaries: NoteSummary[]): NoteListItem[] {
  return summaries.map(toNoteListItem);
}

export function toOpenNoteState(note: Note, savedAt: string | null): OpenNoteState {
  return {
    id: note.id,
    title: note.title,
    body: note.body,
    savedAt,
  };
}

export function toSearchResultItem(hit: SearchHit): SearchResultItem {
  return {
    noteId: hit.noteId,
    score: hit.score,
  };
}

export function toSearchResultItems(hits: SearchHit[]): SearchResultItem[] {
  return hits.map(toSearchResultItem);
}

/** Keep the best-scoring hit per note while preserving global search order. */
export function dedupeSearchResultsByNote(
  hits: SearchResultItem[],
): SearchResultItem[] {
  const seen = new Set<string>();
  return hits.filter((hit) => {
    if (seen.has(hit.noteId)) return false;
    seen.add(hit.noteId);
    return true;
  });
}
