import {
  noteId,
  noteToSummary,
  parseSpaceIds,
  serializeSpaceIds,
  type Note,
  type NoteId,
} from "../../domain";
import type { NoteRecord } from "../fs/schema";

export function noteFromRecord(record: NoteRecord, body: string): Note {
  return {
    id: noteId(record.id),
    title: record.title,
    body,
    path: record.path,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    spaceIds: parseSpaceIds(record.spaceIds),
  };
}

export function noteToRecord(note: Note): NoteRecord {
  const record: NoteRecord = {
    id: note.id,
    title: note.title,
    path: note.path,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
  const serialized = serializeSpaceIds(note.spaceIds);
  if (serialized) record.spaceIds = serialized;
  return record;
}

export function summaryFromRecord(record: NoteRecord) {
  return {
    id: noteId(record.id),
    title: record.title,
    updatedAt: record.updatedAt,
    spaceIds: parseSpaceIds(record.spaceIds),
  };
}

export { noteToSummary };

export function recordFromNote(note: Note): NoteRecord {
  return noteToRecord(note);
}

export function summaryFromNote(note: Note) {
  return noteToSummary(note);
}

export function noteIdFromRecord(record: NoteRecord): NoteId {
  return record.id as NoteId;
}
