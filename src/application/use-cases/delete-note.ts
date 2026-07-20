import type { NoteId } from "../../domain";
import type { VaultSession } from "../vault-session";
import { guardVaultIO } from "../errors";

/** Remove a note and return attachment paths eligible for GC. */
export async function deleteNote(
  session: VaultSession,
  id: NoteId,
): Promise<string[]> {
  return guardVaultIO(
    {
      operation: "delete-note",
      module: "application/use-cases/delete-note.ts",
      trace: "deleteNote → VaultSession.deleteNote → FsNoteRepository.delete",
      fixHint:
        "Check FsNoteRepository.delete and attachment ref cleanup in infrastructure/notes/storage.ts.",
      details: { noteId: id },
    },
    "Could not delete this note.",
    "Make sure the notes folder is writable, then try again.",
    () => session.deleteNote(id),
  );
}
