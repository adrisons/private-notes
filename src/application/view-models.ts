import type { Note, NoteSummary, SpaceColorId, SpaceId } from "../domain";
import {
  GENERAL_SPACE,
  GENERAL_SPACE_DESCRIPTION,
  GENERAL_SPACE_ID,
  isGeneralSpaceId,
  rankNotes,
  sortSummariesByRecency,
  type CustomSpace,
  type MatchKind,
} from "../domain";
import type { SearchHit } from "./ports/search-hit";

export type { MatchKind };

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
  isDuplicateSpaceName,
  isReservedSpaceName,
  noteBelongsToSpace,
  removeSpaceId,
  RESERVED_SPACE_NAME_MESSAGE,
  DUPLICATE_SPACE_NAME_MESSAGE,
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
  /**
   * Set while a note is opened optimistically: the header renders from the
   * in-memory summary and the body is still loading from disk. The editor waits
   * on it, and autosave holds off so the placeholder body is never persisted.
   */
  bodyPending?: boolean;
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

/** Command palette content hit — one row per note. */
export type SearchResultItem = SearchHit;

/** Default recent-note cap for an empty palette query. */
export const COMMAND_PALETTE_RECENT_LIMIT = 8;

export function sortNoteListItemsByRecency(items: NoteListItem[]): NoteListItem[] {
  return sortSummariesByRecency(items as NoteSummary[]) as NoteListItem[];
}
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

/** Coarse index state for screen-reader announcements (no per-percent updates). */
export function formatIndexStatusCoarseLabel(
  ready: boolean,
  reindexing: boolean,
  indexError = false,
): string {
  if (!ready) return "Loading model…";
  if (reindexing) return "Indexing notes";
  if (indexError) return "Index error — tap to retry";
  return "All indexed";
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

/** One search result row, already merged and ordered. */
export interface RankedResultItem {
  noteId: string;
  score: number;
  matchKind: MatchKind;
}

/**
 * The palette's single ranked list.
 *
 * The index knows bodies; the caller knows titles, spaces and what is on
 * screen right now. Both halves have to meet before anything is ordered —
 * ranking them separately and concatenating the two lists is what buried a
 * note titled *Tiradito de pescado* under eight weak cosine matches for the
 * query "pescado".
 */
export function rankSearchResults(input: {
  query: string;
  hits: SearchResultItem[];
  notes: NoteListItem[];
  spaces: SpaceListItem[];
  limit?: number;
}): RankedResultItem[] {
  return rankNotes({
    query: input.query,
    content: input.hits,
    notes: input.notes.map((note) => ({
      id: note.id,
      title: note.title,
      spaceNames: note.spaceIds.map(
        (id) => resolveSpaceDisplay(id, input.spaces).name,
      ),
    })),
    limit: input.limit,
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
