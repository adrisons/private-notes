import {
  VaultDataError,
  isNumber,
  isObject,
  isString,
} from "../validate";
import type { NoteIndex, NoteRecord } from "./types";

function isNoteRecord(v: unknown): v is NoteRecord {
  return (
    isObject(v) &&
    isString(v.id) &&
    isString(v.title) &&
    isString(v.path) &&
    isString(v.createdAt) &&
    isString(v.updatedAt)
  );
}

/**
 * Validate parsed `.private-notes/index.json`. Throws `VaultDataError` on any
 * structural problem so a corrupt index fails loudly at read time instead of
 * surfacing as a mysterious error deep in the note CRUD paths.
 */
export function parseNoteIndex(raw: unknown, file: string): NoteIndex {
  if (!isObject(raw)) {
    throw new VaultDataError("index is not a JSON object", file);
  }
  if (!isNumber(raw.version)) {
    throw new VaultDataError("index is missing a numeric version", file);
  }
  if (!Array.isArray(raw.notes)) {
    throw new VaultDataError("index.notes is not an array", file);
  }
  raw.notes.forEach((note, i) => {
    if (!isNoteRecord(note)) {
      throw new VaultDataError(`index.notes[${i}] is not a valid record`, file);
    }
  });
  return raw as unknown as NoteIndex;
}
