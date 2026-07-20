import type { Note, NoteId } from "../../domain";
import type { VaultSession } from "../vault-session";
import type { OpenNoteState } from "../view-models";
import { guardVaultIO } from "../errors";

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
  return guardVaultIO(
    {
      operation: "save-note",
      module: "application/use-cases/save-note.ts",
      trace: "saveNote → VaultSession.saveNote → FsNoteRepository.update",
      fixHint:
        "Check FsNoteRepository.update, withIndexLock, and syncRefsForBodyChange in infrastructure/notes/storage.ts.",
      details: { noteId: id },
    },
    "Could not save your note.",
    "Check that the folder is still accessible, then keep editing — we'll retry on the next change.",
    () => session.saveNote(id, title, body),
  );
}
