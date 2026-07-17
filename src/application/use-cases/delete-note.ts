import type { NoteId } from "../../domain";
import type { VaultSession } from "../vault-session";

/** Remove a note and return attachment paths eligible for GC. */
export async function deleteNote(
  session: VaultSession,
  id: NoteId,
): Promise<string[]> {
  return session.deleteNote(id);
}
