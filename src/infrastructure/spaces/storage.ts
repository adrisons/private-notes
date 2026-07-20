import { readText, writeText, fileExists } from "../fs/handle";
import { PATHS, SCHEMA_VERSION, type SpacesIndex } from "../fs/schema";
import { parseSpacesIndex } from "../fs/validate";
import { withIndexLock } from "../fs/locks";
import { parseJson } from "../../lib/validate";
import { isReservedSpaceName } from "../../domain";
import { ulid } from "../notes/id";

export function buildEmptySpacesIndex(): SpacesIndex {
  return { version: SCHEMA_VERSION, spaces: [] };
}

async function readSpacesIndex(
  root: FileSystemDirectoryHandle,
): Promise<SpacesIndex> {
  if (!(await fileExists(root, PATHS.spaces))) return buildEmptySpacesIndex();
  const text = await readText(root, PATHS.spaces);
  return parseSpacesIndex(parseJson(text, PATHS.spaces), PATHS.spaces);
}

async function writeSpacesIndex(
  root: FileSystemDirectoryHandle,
  index: SpacesIndex,
): Promise<void> {
  await writeText(root, PATHS.spaces, JSON.stringify(index, null, 2));
}

export async function ensureSpacesFile(
  root: FileSystemDirectoryHandle,
): Promise<void> {
  if (await fileExists(root, PATHS.spaces)) return;
  await writeSpacesIndex(root, buildEmptySpacesIndex());
}

interface SpacesStorageContext {
  root: FileSystemDirectoryHandle;
  newId?: () => string;
}

export async function listSpaceRecords(
  io: SpacesStorageContext,
): Promise<SpacesIndex["spaces"]> {
  const index = await readSpacesIndex(io.root);
  return index.spaces;
}

export interface CreateSpaceInput {
  name: string;
  colorId: string;
  description?: string;
}

export async function createSpaceRecord(
  io: SpacesStorageContext,
  input: CreateSpaceInput,
): Promise<SpacesIndex["spaces"][number]> {
  const name = input.name.trim() || "Untitled";
  if (isReservedSpaceName(name)) {
    throw new Error("General is reserved for the built-in space.");
  }
  const id = (io.newId ?? ulid)();
  const record = {
    id,
    name,
    colorId: input.colorId,
    ...(input.description?.trim()
      ? { description: input.description.trim() }
      : null),
  };
  await withIndexLock(async () => {
    const index = await readSpacesIndex(io.root);
    index.spaces = [...index.spaces, record];
    await writeSpacesIndex(io.root, index);
  });
  return record;
}

export interface UpdateSpaceInput {
  name?: string;
  colorId?: string;
  description?: string;
}

export async function updateSpaceRecord(
  io: SpacesStorageContext,
  id: string,
  patch: UpdateSpaceInput,
): Promise<SpacesIndex["spaces"][number] | null> {
  let updated: SpacesIndex["spaces"][number] | null = null;
  await withIndexLock(async () => {
    const index = await readSpacesIndex(io.root);
    const idx = index.spaces.findIndex((space) => space.id === id);
    if (idx < 0) return;
    const current = index.spaces[idx]!;
    const nextName =
      patch.name !== undefined ? patch.name.trim() || "Untitled" : current.name;
    if (patch.name !== undefined && isReservedSpaceName(nextName)) {
      throw new Error("General is reserved for the built-in space.");
    }
    updated = {
      ...current,
      ...(patch.name !== undefined ? { name: nextName } : null),
      ...(patch.colorId !== undefined ? { colorId: patch.colorId } : null),
      ...(patch.description !== undefined
        ? patch.description.trim()
          ? { description: patch.description.trim() }
          : { description: undefined }
        : null),
    };
    if (updated.description === undefined) delete updated.description;
    index.spaces[idx] = updated;
    await writeSpacesIndex(io.root, index);
  });
  return updated;
}

export async function deleteSpaceRecord(
  io: SpacesStorageContext,
  id: string,
): Promise<boolean> {
  let removed = false;
  await withIndexLock(async () => {
    const index = await readSpacesIndex(io.root);
    const next = index.spaces.filter((space) => space.id !== id);
    if (next.length === index.spaces.length) return;
    index.spaces = next;
    await writeSpacesIndex(io.root, index);
    removed = true;
  });
  return removed;
}
