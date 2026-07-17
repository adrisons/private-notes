import type { NoteId } from "../../domain";
import type { NoteRecord } from "../ports/note-record";
import type { VaultSession } from "../vault-session";
import { noteToReindexRecord } from "../mappers/reindex";
import { saveNote, type SaveNoteResult } from "./save-note";

export interface AutosaveInput {
  id: NoteId;
  title: string;
  body: string;
}

export interface AutosaveCallbacks {
  onSaved: (result: SaveNoteResult) => void | Promise<void>;
  scheduleReindex: (records: NoteRecord[]) => void;
  embedderReady: boolean;
}

/** Immediate persist — used by debounced autosave and flush. */
export async function autosaveNote(
  session: VaultSession,
  input: AutosaveInput,
  callbacks: AutosaveCallbacks,
): Promise<void> {
  const result = await saveNote(session, input.id, input.title, input.body);
  await callbacks.onSaved(result);
  if (callbacks.embedderReady) {
    callbacks.scheduleReindex([noteToReindexRecord(result.note)]);
  }
}
