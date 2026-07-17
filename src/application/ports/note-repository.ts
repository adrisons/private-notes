import type { Note, NoteId, NoteSummary } from "../../domain";
import type { NoteRecord } from "./note-record";

export interface CreateNoteInput {
  title: string;
  body: string;
}

export interface UpdateNoteInput {
  title?: string;
  body?: string;
}

export interface SaveNoteResult {
  note: Note;
  gcAttachments: string[];
}

export interface NoteRepository {
  list(): Promise<NoteSummary[]>;
  listRecords(): Promise<NoteRecord[]>;
  read(id: NoteId): Promise<Note | null>;
  create(input: CreateNoteInput): Promise<Note>;
  update(id: NoteId, patch: UpdateNoteInput): Promise<SaveNoteResult>;
  delete(id: NoteId): Promise<string[]>;
  duplicate(id: NoteId): Promise<Note | null>;
}
