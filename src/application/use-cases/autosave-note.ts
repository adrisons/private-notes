import type { NoteId } from "../../domain";
import type { ReindexNoteInput } from "../ports/semantic-search";
import type { VaultSession } from "../vault-session";
import { noteToReindexInput } from "../mappers/reindex";
import { saveNote, type SaveNoteResult } from "./save-note";

export interface AutosaveInput {
  id: NoteId;
  title: string;
  body: string;
}

export interface AutosaveCallbacks {
  onSaved: (result: SaveNoteResult) => void | Promise<void>;
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
      callbacks.scheduleReindex([noteToReindexInput(result.note)]);
    }
  } catch (error) {
    callbacks.onError(error);
  }
}
