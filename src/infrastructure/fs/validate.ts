import {
  VaultDataError,
  isNumber,
  isObject,
  isString,
} from "../../lib/validate";
import { isSpaceColorId } from "../../domain/space/space-color";
import type { NoteIndex, NoteRecord, SpacesIndex, SpaceRecord } from "../fs/schema";

function isNoteRecord(v: unknown): v is NoteRecord {
  if (
    !isObject(v) ||
    !isString(v.id) ||
    !isString(v.title) ||
    !isString(v.path) ||
    !isString(v.createdAt) ||
    !isString(v.updatedAt)
  ) {
    return false;
  }
  if (v.spaceIds !== undefined && !isString(v.spaceIds)) return false;
  return true;
}

function isSpaceRecord(v: unknown): v is SpaceRecord {
  if (
    !isObject(v) ||
    !isString(v.id) ||
    !isString(v.name) ||
    !isString(v.colorId) ||
    !isSpaceColorId(v.colorId) ||
    !isString(v.createdAt) ||
    !isString(v.updatedAt)
  ) {
    return false;
  }
  if (v.description !== undefined && !isString(v.description)) return false;
  return true;
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
  (raw.notes as unknown[]).forEach((note, i) => {
    if (!isNoteRecord(note)) {
      throw new VaultDataError(`index.notes[${i}] is not a valid record`, file);
    }
  });
  return raw as unknown as NoteIndex;
}

export function parseSpacesIndex(raw: unknown, file: string): SpacesIndex {
  if (!isObject(raw)) {
    throw new VaultDataError("spaces is not a JSON object", file);
  }
  if (!isNumber(raw.version)) {
    throw new VaultDataError("spaces is missing a numeric version", file);
  }
  if (!Array.isArray(raw.spaces)) {
    throw new VaultDataError("spaces.spaces is not an array", file);
  }
  (raw.spaces as unknown[]).forEach((space, i) => {
    if (!isSpaceRecord(space)) {
      throw new VaultDataError(`spaces.spaces[${i}] is not a valid record`, file);
    }
  });
  return raw as unknown as SpacesIndex;
}
