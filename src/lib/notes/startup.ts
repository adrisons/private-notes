import type { NoteRecord } from "../fs/types";
import { createNote, listNotes, readNote, type NoteIO } from "./storage";
import { WELCOME_NOTE_BODY, WELCOME_NOTE_TITLE } from "./welcome-note";

export interface InitialNote {
  record: NoteRecord;
  title: string;
  body: string;
  savedAt: string;
}

export interface VaultStartup {
  notes: NoteRecord[];
  current: InitialNote | null;
}

/** Seed a welcome note or open the most recently edited note on vault open. */
export async function resolveVaultStartup(io: NoteIO): Promise<VaultStartup> {
  let notes = await listNotes(io);

  if (notes.length === 0) {
    const record = await createNote(io, {
      title: WELCOME_NOTE_TITLE,
      body: WELCOME_NOTE_BODY,
    });
    notes = [record];
    return {
      notes,
      current: {
        record,
        title: WELCOME_NOTE_TITLE,
        body: WELCOME_NOTE_BODY,
        savedAt: record.updatedAt,
      },
    };
  }

  const mostRecent = notes[0]!;
  const read = await readNote(io, mostRecent.id);
  if (!read) return { notes, current: null };

  return {
    notes,
    current: {
      record: read.record,
      title: read.parsed.frontmatter.title,
      body: read.parsed.body,
      savedAt: read.record.updatedAt,
    },
  };
}
