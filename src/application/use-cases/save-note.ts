import type { Note, NoteId } from "../../domain";
import type { VaultSession } from "../vault-session";
import type { OpenNoteState } from "../view-models";

export interface SaveNoteResult {
  state: OpenNoteState;
  gcAttachments: string[];
  note: Note;
}

/** Persist note edits and invalidate dropped attachment URLs. */
export async function saveNote(
  session: VaultSession,
  id: NoteId,
  title: string,
  body: string,
): Promise<SaveNoteResult> {
  return session.saveNote(id, title, body);
}
