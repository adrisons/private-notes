import type { NoteId } from "./note-id";
import type { NoteSummary } from "./note-summary";

/** Full note entity — business concept, not the on-disk JSON shape. */
export interface Note {
  readonly id: NoteId;
  title: string;
  body: string;
  /** Relative path under the vault root. */
  readonly path: string;
  readonly createdAt: string;
  updatedAt: string;
}

export function noteToSummary(note: Note): NoteSummary {
  return {
    id: note.id,
    title: note.title,
    updatedAt: note.updatedAt,
  };
}
