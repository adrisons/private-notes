import type { Note, NoteId } from "../../domain";
import type { VaultSession } from "../vault-session";
import type { OpenNoteState } from "../view-models";

export interface DuplicateNoteResult {
  state: OpenNoteState;
  note: Note;
}

/** Clone a note and return the new editor state. */
export async function duplicateNote(
  session: VaultSession,
  id: NoteId,
): Promise<DuplicateNoteResult | null> {
  return session.duplicateNote(id);
}
