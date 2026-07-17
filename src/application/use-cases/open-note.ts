import type { NoteId } from "../../domain";
import type { VaultSession } from "../vault-session";
import type { OpenNoteState } from "../view-models";

/** Load a note into editor state. */
export async function openNote(
  session: VaultSession,
  id: NoteId,
): Promise<OpenNoteState | null> {
  return session.openNote(id);
}
