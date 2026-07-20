import {
  noteId,
  parseSpaceIds,
  serializeSpaceIds,
  type Note,
  type NoteSummary,
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

export function summaryFromRecord(record: NoteRecord): NoteSummary {
  return {
    id: noteId(record.id),
    title: record.title,
    updatedAt: record.updatedAt,
    spaceIds: parseSpaceIds(record.spaceIds),
  };
}
