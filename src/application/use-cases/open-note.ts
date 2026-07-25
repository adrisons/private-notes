import type { Note, NoteId } from "../../domain";
import type { VaultSession } from "../vault-session";
import { guardVaultIO } from "../errors";

/** Load a note from the vault. */
export async function openNote(
  session: VaultSession,
  id: NoteId,
): Promise<Note | null> {
  return guardVaultIO(
    {
      operation: "open-note",
      module: "application/use-cases/open-note.ts",
      trace: "openNote → VaultSession.openNote → FsNoteRepository.read",
      fixHint:
        "Verify the note file exists under notes/ and index.json is consistent; run reconcileVault on open.",
      details: { noteId: id },
    },
    "Could not open this note.",
    "The note file may be missing or unreadable. Try refreshing the folder.",
    () => session.openNote(id),
  );
}
