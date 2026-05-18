import { readText, writeText, fileExists } from "../fs/handle";
import { PATHS, type NoteIndex, type NoteRecord } from "../fs/types";
import { buildEmptyIndex } from "../fs/manifest";
import { parseNote, serializeNote, type ParsedNote } from "./frontmatter";
import { buildNotePath } from "./path";
import { ulid } from "./id";

/** Strongly-typed clock + ID source for deterministic tests. */
export interface NoteIO {
  root: FileSystemDirectoryHandle;
  now?: () => Date;
  newId?: () => string;
}

const nowDefault = (): Date => new Date();
const idDefault = (): string => ulid();

async function readIndex(root: FileSystemDirectoryHandle): Promise<NoteIndex> {
  if (!(await fileExists(root, PATHS.index))) return buildEmptyIndex();
  const text = await readText(root, PATHS.index);
  return JSON.parse(text) as NoteIndex;
}

async function writeIndex(
  root: FileSystemDirectoryHandle,
  index: NoteIndex,
): Promise<void> {
  await writeText(root, PATHS.index, JSON.stringify(index, null, 2));
}

export interface CreateInput {
  title: string;
  body: string;
}

export async function createNote(
  io: NoteIO,
  input: CreateInput,
): Promise<NoteRecord> {
  const now = (io.now ?? nowDefault)();
  const id = (io.newId ?? idDefault)();
  const iso = now.toISOString();
  const path = buildNotePath(input.title, id, now);
  const record: NoteRecord = {
    id,
    title: input.title,
    path,
    createdAt: iso,
    updatedAt: iso,
  };
  const text = serializeNote(
    {
      id,
      title: input.title,
      createdAt: iso,
      updatedAt: iso,
    },
    input.body,
  );
  await writeText(io.root, path, text);
  const index = await readIndex(io.root);
  index.notes = [...index.notes, record];
  await writeIndex(io.root, index);
  return record;
}

export async function readNote(
  io: NoteIO,
  id: string,
): Promise<{ record: NoteRecord; parsed: ParsedNote } | null> {
  const index = await readIndex(io.root);
  const record = index.notes.find((n) => n.id === id);
  if (!record) return null;
  const text = await readText(io.root, record.path);
  return { record, parsed: parseNote(text) };
}

export interface UpdateInput {
  title?: string;
  body?: string;
}

export async function updateNote(
  io: NoteIO,
  id: string,
  patch: UpdateInput,
): Promise<NoteRecord> {
  const index = await readIndex(io.root);
  const idx = index.notes.findIndex((n) => n.id === id);
  if (idx < 0) throw new Error(`Note ${id} not found`);
  const current = index.notes[idx]!;
  const existingText = await readText(io.root, current.path);
  const existing = parseNote(existingText);
  const title = patch.title ?? existing.frontmatter.title;
  const body = patch.body ?? existing.body;
  const now = (io.now ?? nowDefault)();
  const iso = now.toISOString();
  const updated: NoteRecord = {
    ...current,
    title,
    updatedAt: iso,
  };
  const newText = serializeNote(
    {
      id: current.id,
      title,
      createdAt: current.createdAt,
      updatedAt: iso,
    },
    body,
  );
  await writeText(io.root, current.path, newText);
  index.notes[idx] = updated;
  await writeIndex(io.root, index);
  return updated;
}

export async function deleteNote(io: NoteIO, id: string): Promise<void> {
  const index = await readIndex(io.root);
  const record = index.notes.find((n) => n.id === id);
  if (!record) return;
  // Remove the index entry first so a half-deleted note is invisible.
  index.notes = index.notes.filter((n) => n.id !== id);
  await writeIndex(io.root, index);
  // Best-effort file removal — the parent directory layout uses notes/YYYY/MM.
  const segments = record.path.split("/");
  const fileName = segments.pop()!;
  let dir = io.root;
  for (const seg of segments) {
    dir = await dir.getDirectoryHandle(seg);
  }
  await dir.removeEntry(fileName);
}

export async function listNotes(io: NoteIO): Promise<NoteRecord[]> {
  const index = await readIndex(io.root);
  return [...index.notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
