import type { Note } from "../../domain";
import type { VaultSession } from "../vault-session";
import type { CreateNoteInput } from "../ports/note-repository";
import { guardVaultIO } from "../errors";

export async function createNote(
  session: VaultSession,
  input: CreateNoteInput = { title: "Untitled", body: "" },
): Promise<Note> {
  return guardVaultIO(
    {
      operation: "create-note",
      module: "application/use-cases/create-note.ts",
      trace: "createNote → VaultSession.createNote → FsNoteRepository.create",
      fixHint:
        "Check FsNoteRepository.create and withIndexLock in infrastructure/notes/storage.ts.",
    },
    "Could not create a new note.",
    "Make sure the notes folder is writable, then try again.",
    () => session.createNote(input),
  );
}
