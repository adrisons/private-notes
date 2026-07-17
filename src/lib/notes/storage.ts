import { readText, writeText, fileExists } from "../fs/handle";
import { PATHS, type NoteIndex, type NoteRecord } from "../fs/types";
import { buildEmptyIndex } from "../fs/manifest";
import { parseNoteIndex } from "../fs/validate";
import { withIndexLock } from "../fs/locks";
import { parseJson } from "../validate";
import { deleteOrphanAttachments } from "../attachments/gc";
import { extractAttachmentPaths } from "../attachments/paths";
import {
  addRefsForBody,
  dropNoteRefs,
  syncRefsForBodyChange,
} from "../attachments/refs";
import { parseNote, serializeNote, type ParsedNote } from "./frontmatter";
import { buildNotePath } from "./path";
import { ulid } from "./id";

/** Vault root plus optional test doubles for clock and id generation. */
interface NoteStorageContext {
  root: FileSystemDirectoryHandle;
  now?: () => Date;
  newId?: () => string;
}

const nowDefault = (): Date => new Date();
const idDefault = (): string => ulid();

async function readIndex(root: FileSystemDirectoryHandle): Promise<NoteIndex> {
  if (!(await fileExists(root, PATHS.index))) return buildEmptyIndex();
  const text = await readText(root, PATHS.index);
  return parseNoteIndex(parseJson(text, PATHS.index), PATHS.index);
}

async function writeIndex(
  root: FileSystemDirectoryHandle,
  index: NoteIndex,
): Promise<void> {
  await writeText(root, PATHS.index, JSON.stringify(index, null, 2));
}

/**
 * Read-modify-write the index atomically with respect to other tabs. The index
 * is re-read *inside* the lock so a concurrent tab's change made after our
 * caller's own reads is not clobbered — only the fields our `mutator` touches
 * are overwritten. See src/lib/fs/locks.ts.
 */
async function mutateIndex(
  root: FileSystemDirectoryHandle,
  mutator: (index: NoteIndex) => void,
): Promise<NoteIndex> {
  return withIndexLock(async () => {
    const index = await readIndex(root);
    mutator(index);
    await writeIndex(root, index);
    return index;
  });
}

export interface CreateInput {
  title: string;
  body: string;
}

export async function createNote(
  io: NoteStorageContext,
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
  await mutateIndex(io.root, (index) => {
    index.notes = [...index.notes, record];
  });
  return record;
}

export async function readNote(
  io: NoteStorageContext,
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
  io: NoteStorageContext,
  id: string,
  patch: UpdateInput,
): Promise<NoteRecord & { gcAttachments: string[] }> {
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
  let gcAttachments: string[] = [];
  if (patch.body !== undefined && patch.body !== existing.body) {
    gcAttachments = await syncRefsForBodyChange(
      io.root,
      current.id,
      existing.body,
      body,
    );
    await deleteOrphanAttachments(io.root, gcAttachments);
  }
  await mutateIndex(io.root, (fresh) => {
    const i = fresh.notes.findIndex((n) => n.id === id);
    if (i >= 0) fresh.notes[i] = updated;
  });
  return { ...updated, gcAttachments };
}

export async function duplicateNote(
  io: NoteStorageContext,
  id: string,
): Promise<NoteRecord | null> {
  const source = await readNote(io, id);
  if (!source) return null;
  const title = source.parsed.frontmatter.title;
  const copyTitle = title.trim() ? `${title} (copy)` : "Untitled (copy)";
  const copy = await createNote(io, {
    title: copyTitle,
    body: source.parsed.body,
  });
  await addRefsForBody(io.root, copy.id, source.parsed.body);
  return copy;
}

export async function deleteNote(
  io: NoteStorageContext,
  id: string,
): Promise<string[]> {
  const index = await readIndex(io.root);
  const record = index.notes.find((n) => n.id === id);
  if (!record) return [];

  let attachmentPaths: Set<string> = new Set();
  if (await fileExists(io.root, record.path)) {
    const text = await readText(io.root, record.path);
    attachmentPaths = extractAttachmentPaths(parseNote(text).body);
  }

  // Remove the index entry first so a half-deleted note is invisible.
  await mutateIndex(io.root, (fresh) => {
    fresh.notes = fresh.notes.filter((n) => n.id !== id);
  });
  // Best-effort file removal — the parent directory layout uses notes/YYYY/MM.
  const segments = record.path.split("/");
  const fileName = segments.pop()!;
  let dir = io.root;
  for (const seg of segments) {
    dir = await dir.getDirectoryHandle(seg);
  }
  await dir.removeEntry(fileName);

  const gcAttachments = await dropNoteRefs(io.root, id, attachmentPaths);
  await deleteOrphanAttachments(io.root, gcAttachments);
  return gcAttachments;
}

export async function listNotes(io: NoteStorageContext): Promise<NoteRecord[]> {
  const index = await readIndex(io.root);
  return [...index.notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
