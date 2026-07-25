import {
  noteId,
  parseSpaceIds,
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

export function summaryFromRecord(record: NoteRecord): NoteSummary {
  return {
    id: noteId(record.id),
    title: record.title,
    updatedAt: record.updatedAt,
    spaceIds: parseSpaceIds(record.spaceIds),
  };
}
