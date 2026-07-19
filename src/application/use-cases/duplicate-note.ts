import type { Note, NoteId } from "../../domain";
import type { VaultSession } from "../vault-session";
import type { OpenNoteState } from "../view-models";
import { guardNoteIO } from "../errors";

export interface DuplicateNoteResult {
  state: OpenNoteState;
  note: Note;
}

/** Clone a note and return the new editor state. */
export async function duplicateNote(
  session: VaultSession,
  id: NoteId,
): Promise<DuplicateNoteResult | null> {
  return guardNoteIO(
    {
      operation: "duplicate-note",
      module: "application/use-cases/duplicate-note.ts",
      trace: "duplicateNote → VaultSession.duplicateNote → FsNoteRepository.duplicate",
      fixHint:
        "Check FsNoteRepository.duplicate and addRefsForBody in infrastructure/attachments/refs.ts.",
      details: { noteId: id },
    },
    "Could not duplicate this note.",
    "Make sure the notes folder is writable, then try again.",
    () => session.duplicateNote(id),
  );
}
