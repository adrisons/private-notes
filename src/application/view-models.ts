import type { Note, NoteSummary, SpaceColorId, SpaceId } from "../domain";
import {
  GENERAL_SPACE,
  GENERAL_SPACE_DESCRIPTION,
  GENERAL_SPACE_ID,
  isGeneralSpaceId,
  type CustomSpace,
} from "../domain";
import type { SearchHit } from "./ports/search-hit";

/**
 * Presentation vocabulary for spaces. Screens and primitives read space
 * concepts from here so they never reach into `src/domain` themselves
 * (AGENTS §5.1).
 */
export {
  addSpaceId,
  FALLBACK_SPACE_NAME,
  GENERAL_SPACE_DESCRIPTION,
  GENERAL_SPACE_ID,
  isGeneralSpaceId,
  isReservedSpaceName,
  noteBelongsToSpace,
  removeSpaceId,
  RESERVED_SPACE_NAME_MESSAGE,
  SPACE_COLOR_IDS,
  type SpaceColorId,
  type SpaceDraft,
  type SpaceId,
  type SpacePatch,
} from "../domain";

export interface SpaceChipDisplay {
  id: SpaceId;
  name: string;
  colorId: SpaceColorId | null;
}

/** Sidebar / list row — no persistence fields. */
export interface NoteListItem {
  id: string;
  title: string;
  updatedAt: string;
  spaceIds: SpaceId[];
}

/** Editor chrome + body for the open note. */
export interface OpenNoteState {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  savedAt: string | null;
  spaceIds: SpaceId[];
}

/** Space card in the spaces overview. */
export interface SpaceListItem {
  id: SpaceId;
  name: string;
  colorId: SpaceColorId | null;
  description: string | null;
  noteCount: number;
  createdAt?: string;
  updatedAt?: string;
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
    spaceIds: summary.spaceIds,
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
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    savedAt,
    spaceIds: note.spaceIds,
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

export function buildSpaceListItems(
  customSpaces: CustomSpace[],
  notes: NoteListItem[],
): SpaceListItem[] {
  const counts = new Map<SpaceId, number>();
  for (const note of notes) {
    if (note.spaceIds.length === 0) {
      counts.set(
        GENERAL_SPACE_ID,
        (counts.get(GENERAL_SPACE_ID) ?? 0) + 1,
      );
    } else {
      for (const id of note.spaceIds) {
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
  }

  const general: SpaceListItem = {
    id: GENERAL_SPACE_ID,
    name: GENERAL_SPACE.name,
    colorId: null,
    description: GENERAL_SPACE_DESCRIPTION,
    noteCount: counts.get(GENERAL_SPACE_ID) ?? 0,
  };

  const custom = customSpaces.map((space) => ({
    id: space.id,
    name: space.name,
    colorId: space.colorId,
    description: space.description ?? null,
    noteCount: counts.get(space.id) ?? 0,
    createdAt: space.createdAt,
    updatedAt: space.updatedAt,
  }));

  return [general, ...custom];
}

const generalChip: SpaceChipDisplay = {
  id: GENERAL_SPACE_ID,
  name: GENERAL_SPACE.name,
  colorId: null,
};

/**
 * A note can carry an id no longer present in `spaces.json` — an external
 * editor wrote it, or a delete was interrupted. Show the raw id on a neutral
 * chip rather than mislabelling it "General", which would hide the dangling
 * reference behind a legitimate-looking name.
 */
export function resolveSpaceDisplay(
  spaceId: SpaceId,
  spaces: SpaceListItem[],
): SpaceChipDisplay {
  const match = spaces.find((space) => space.id === spaceId);
  if (match) {
    return { id: match.id, name: match.name, colorId: match.colorId };
  }
  return { id: spaceId, name: spaceId, colorId: null };
}

export function resolveNoteSpaceChips(
  spaceIds: SpaceId[],
  spaces: SpaceListItem[],
  options?: { omitGeneral?: boolean },
): SpaceChipDisplay[] {
  const chips =
    spaceIds.length === 0
      ? [generalChip]
      : spaceIds.map((id) => resolveSpaceDisplay(id, spaces));
  if (options?.omitGeneral) {
    return chips.filter((chip) => !isGeneralSpaceId(chip.id));
  }
  return chips;
}
