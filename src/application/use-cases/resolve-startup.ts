import {
  noteId,
  pickMostRecent,
  WELCOME_NOTE_BODY,
  WELCOME_NOTE_TITLE,
  type NoteId,
  type NoteSummary,
} from "../../domain";
import type { VaultSession, VaultStartup } from "../vault-session";
import type { OpenNoteState } from "../view-models";
import { createNote } from "./create-note";

function summaryFromState(state: OpenNoteState): NoteSummary {
  return {
    id: noteId(state.id),
    title: state.title,
    updatedAt: state.savedAt ?? new Date().toISOString(),
  };
}

/** Seed welcome note or open the most recently edited note. */
export async function resolveVaultStartup(
  session: VaultSession,
): Promise<VaultStartup> {
  let summaries = await session.listSummaries();

  if (summaries.length === 0) {
    const current = await createNote(session, {
      title: WELCOME_NOTE_TITLE,
      body: WELCOME_NOTE_BODY,
    });
    summaries = [summaryFromState(current)];
    return { summaries, current };
  }

  const target = pickMostRecent(summaries);
  if (!target) return { summaries, current: null };

  const current = await session.openNote(target.id as NoteId);
  return { summaries, current };
}
