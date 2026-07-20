import type { Note, NoteId, NoteSummary, SpaceId } from "../../domain";
import type { NoteRecord } from "./note-record";

export interface CreateNoteInput {
  title: string;
  body: string;
}

export interface UpdateNoteInput {
  title?: string;
  body?: string;
  spaceIds?: SpaceId[];
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
  /** Detach a space from every note that carries it; returns the notes changed. */
  clearSpace(spaceId: SpaceId): Promise<NoteId[]>;
}
