import type { Note } from "../../domain";
import type { NoteRecord } from "../ports/note-record";

export function noteToReindexRecord(note: Note): NoteRecord {
  return {
    id: note.id,
    title: note.title,
    path: note.path,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}
