import { readText, writeText, fileExists } from "../fs/handle";
import { PATHS, SCHEMA_VERSION, type SpacesIndex } from "../fs/schema";
import { parseSpacesIndex } from "../fs/validate";
import { withIndexLock } from "../fs/locks";
import { parseJson } from "../../lib/validate";
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
  now?: () => Date;
}

const nowDefault = () => new Date();

export async function listSpaceRecords(
  io: SpacesStorageContext,
): Promise<SpacesIndex["spaces"]> {
  const index = await readSpacesIndex(io.root);
  return index.spaces;
}

/**
 * Attributes arrive already normalized and validated by the domain (see the
 * `create-space` use-case) — this layer only mints the id and writes.
 */
export interface CreateSpaceRecordInput {
  name: string;
  colorId: string;
  description?: string;
}

export async function createSpaceRecord(
  io: SpacesStorageContext,
  input: CreateSpaceRecordInput,
): Promise<SpacesIndex["spaces"][number]> {
  const id = (io.newId ?? ulid)();
  const iso = (io.now ?? nowDefault)().toISOString();
  const record = {
    id,
    name: input.name,
    colorId: input.colorId,
    createdAt: iso,
    updatedAt: iso,
    ...(input.description ? { description: input.description } : null),
  };
  await withIndexLock(async () => {
    const index = await readSpacesIndex(io.root);
    index.spaces = [...index.spaces, record];
    await writeSpacesIndex(io.root, index);
  });
  return record;
}

/** `description: null` clears the field; omitting the key leaves it untouched. */
export interface UpdateSpaceRecordInput {
  name?: string;
  colorId?: string;
  description?: string | null;
}

export async function updateSpaceRecord(
  io: SpacesStorageContext,
  id: string,
  patch: UpdateSpaceRecordInput,
): Promise<SpacesIndex["spaces"][number] | null> {
  let updated: SpacesIndex["spaces"][number] | null = null;
  await withIndexLock(async () => {
    const index = await readSpacesIndex(io.root);
    const idx = index.spaces.findIndex((space) => space.id === id);
    if (idx < 0) return;
    const current = index.spaces[idx]!;
    const next = {
      ...current,
      ...(patch.name !== undefined ? { name: patch.name } : null),
      ...(patch.colorId !== undefined ? { colorId: patch.colorId } : null),
      updatedAt: (io.now ?? nowDefault)().toISOString(),
    };
    if (patch.description !== undefined) {
      if (patch.description === null) delete next.description;
      else next.description = patch.description;
    }
    updated = next;
    index.spaces[idx] = next;
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
