import type { NoteId } from "../../domain";
import type { VaultSession } from "../vault-session";
import type { OpenNoteState } from "../view-models";
import { guardVaultIO } from "../errors";

/** Load a note into editor state. */
export async function openNote(
  session: VaultSession,
  id: NoteId,
): Promise<OpenNoteState | null> {
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
