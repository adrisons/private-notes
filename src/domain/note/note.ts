import type { NoteRecord } from "../../lib/fs/types";
import type { NoteId } from "./note-id";
import { noteId } from "./note-id";
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

export function noteFromRecord(record: NoteRecord, body: string): Note {
  return {
    id: noteId(record.id),
    title: record.title,
    body,
    path: record.path,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function noteToRecord(note: Note): NoteRecord {
  return {
    id: note.id,
    title: note.title,
    path: note.path,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}

export function noteToSummary(note: Note): NoteSummary {
  return {
    id: note.id,
    title: note.title,
    updatedAt: note.updatedAt,
  };
}

export function summaryFromRecord(record: NoteRecord): NoteSummary {
  return {
    id: noteId(record.id),
    title: record.title,
    updatedAt: record.updatedAt,
  };
}
