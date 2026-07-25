import type { Note, NoteId, SpaceId } from "../../domain";
import type { VaultSession } from "../vault-session";
import { guardVaultIO } from "../errors";

export async function assignNoteSpaces(
  session: VaultSession,
  id: NoteId,
  spaceIds: readonly SpaceId[],
): Promise<Note | null> {
  return guardVaultIO(
    {
      operation: "assign-note-spaces",
      module: "application/use-cases/assign-note-spaces.ts",
      trace:
        "assignNoteSpaces → VaultSession.assignNoteSpaces → FsNoteRepository.update",
      fixHint:
        "Check recordWithSpaceIds and frontmatter serialization in infrastructure/notes/storage.ts.",
      details: { noteId: id, spaceIds },
    },
    "Could not update this note's spaces.",
    "Make sure the notes folder is writable, then try again.",
    () => session.assignNoteSpaces(id, [...spaceIds]),
  );
}
