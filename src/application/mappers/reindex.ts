import type { Note } from "../../domain";
import type { ReindexNoteInput } from "../ports/semantic-search";

export function noteToReindexInput(note: Note): ReindexNoteInput {
  return {
    id: note.id,
    title: note.title,
    body: note.body,
  };
}
