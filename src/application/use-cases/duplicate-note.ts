import type { Note, NoteId } from "../../domain";
import type { VaultSession } from "../vault-session";
import { guardVaultIO } from "../errors";

/** Clone a note and return the new domain entity. */
export async function duplicateNote(
  session: VaultSession,
  id: NoteId,
): Promise<Note | null> {
  return guardVaultIO(
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
