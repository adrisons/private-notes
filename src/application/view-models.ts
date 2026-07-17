import type { Note, NoteSummary } from "../domain";
import type { SearchHit } from "../lib/search/search";

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

/** Command palette semantic hit — decoupled from indexer internals. */
export interface SearchResultItem {
  noteId: string;
  filePath: string;
  chunkIdx: number;
  score: number;
  snippet: string;
}

/** Reindex progress surfaced in the sidebar. */
export interface ReindexProgress {
  done: number;
  total: number;
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
    filePath: hit.filePath,
    chunkIdx: hit.chunkIdx,
    score: hit.score,
    snippet: hit.snippet,
  };
}

export function toSearchResultItems(hits: SearchHit[]): SearchResultItem[] {
  return hits.map(toSearchResultItem);
}
