import type { NoteId } from "../../domain";
import type { ReindexNoteInput } from "../ports/semantic-search";
import type { VaultSession } from "../vault-session";
import { saveNote } from "./save-note";

export interface AutosaveInput {
  id: NoteId;
  title: string;
  body: string;
}

export interface AutosaveCallbacks {
  onSaved: (result: Awaited<ReturnType<typeof saveNote>>) => void | Promise<void>;
  onError: (error: unknown) => void;
  scheduleReindex: (notes: ReindexNoteInput[]) => void;
  embedderReady: boolean;
}

/** Immediate persist — used by debounced autosave and flush. */
export async function autosaveNote(
  session: VaultSession,
  input: AutosaveInput,
  callbacks: AutosaveCallbacks,
): Promise<void> {
  try {
    const result = await saveNote(session, input.id, input.title, input.body);
    await callbacks.onSaved(result);
    if (callbacks.embedderReady) {
      callbacks.scheduleReindex([
        { id: result.note.id, title: result.note.title, body: result.note.body },
      ]);
    }
  } catch (error) {
    callbacks.onError(error);
  }
}
