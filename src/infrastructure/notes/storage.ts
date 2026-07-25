import { readText, writeText, fileExists } from "../fs/handle";
import { PATHS, type NoteIndex, type NoteRecord } from "../fs/schema";
import { buildEmptyIndex } from "../fs/manifest";
import { parseNoteIndex } from "../fs/validate";
import { withIndexLock } from "../fs/locks";
import { parseJson } from "../../lib/validate";
import {
  deleteOrphanAttachments,
  sweepOrphanAttachments,
} from "../attachments/gc";
import { extractAttachmentPaths } from "../attachments/paths";
import {
  addRefsForBody,
  dropNoteRefs,
  syncRefsForBodyChange,
} from "../attachments/refs";
import {
  GENERAL_SPACE_ID,
  NoteNotFoundError,
  parseNote,
  parseSpaceIds,
  serializeNote,
  serializeSpaceIds,
  type NoteFrontmatter,
  type ParsedNote,
  type SpaceId,
} from "../../domain";
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

function spaceIdsFromSources(
  record?: NoteRecord,
  parsed?: NoteFrontmatter,
): SpaceId[] {
  return parseSpaceIds(record?.spaceIds ?? parsed?.spaceIds);
}

function frontmatterFromRecord(
  record: NoteRecord,
  _parsed: NoteFrontmatter | undefined,
  spaceIds: SpaceId[],
): NoteFrontmatter {
  const serialized = serializeSpaceIds(spaceIds);
  return {
    id: record.id,
    title: record.title,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    ...(serialized ? { spaceIds: serialized } : null),
  };
}

function recordWithSpaceIds(
  record: NoteRecord,
  spaceIds: SpaceId[],
): NoteRecord {
  const serialized = serializeSpaceIds(spaceIds);
  const next: NoteRecord = { ...record };
  if (serialized) next.spaceIds = serialized;
  else delete next.spaceIds;
  return next;
}

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

/**
 * Body of a note whose index record the caller already holds.
 *
 * `readNote` resolves the record itself, and resolving it costs a full read,
 * parse and validation of `index.json`. That is fine for one note and
 * quadratic for a vault walk, so anything iterating every note reads the index
 * once and comes here.
 */
export async function readNoteBody(
  io: NoteStorageContext,
  record: NoteRecord,
): Promise<string> {
  return parseNote(await readText(io.root, record.path)).body;
}

export interface UpdateInput {
  title?: string;
  body?: string;
  spaceIds?: SpaceId[];
}

export async function updateNote(
  io: NoteStorageContext,
  id: string,
  patch: UpdateInput,
): Promise<NoteRecord & { gcAttachments: string[] }> {
  const index = await readIndex(io.root);
  const idx = index.notes.findIndex((n) => n.id === id);
  if (idx < 0) throw new NoteNotFoundError(id);
  const current = index.notes[idx]!;
  const existingText = await readText(io.root, current.path);
  const existing = parseNote(existingText);
  const title = patch.title ?? existing.frontmatter.title;
  const body = patch.body ?? existing.body;
  const spaceIds =
    patch.spaceIds ?? spaceIdsFromSources(current, existing.frontmatter);
  const now = (io.now ?? nowDefault)();
  const iso = now.toISOString();
  const updated = recordWithSpaceIds(
    { ...current, title, updatedAt: iso },
    spaceIds,
  );
  const newText = serializeNote(
    frontmatterFromRecord(updated, existing.frontmatter, spaceIds),
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
  const sourceSpaceIds = spaceIdsFromSources(
    source.record,
    source.parsed.frontmatter,
  );
  if (sourceSpaceIds.length > 0) {
    return updateNote(io, copy.id, { spaceIds: sourceSpaceIds });
  }
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

  // Drop the note file and attachment refs before touching the index. If
  // removal fails, the index row stays and delete can be retried; removing the
  // index first left orphan .md files that reconcile re-added on the next open.
  const segments = record.path.split("/");
  const fileName = segments.pop()!;
  let dir = io.root;
  for (const seg of segments) {
    dir = await dir.getDirectoryHandle(seg);
  }
  await dir.removeEntry(fileName);

  const gcAttachments = await dropNoteRefs(io.root, id, attachmentPaths);
  await deleteOrphanAttachments(io.root, gcAttachments);

  await mutateIndex(io.root, (fresh) => {
    fresh.notes = fresh.notes.filter((n) => n.id !== id);
  });

  // Blobs whose refs were cleared during a prior body edit are absent from
  // this note's current markdown — sweep against the remaining corpus.
  const remaining = await listNotes(io);
  const liveBodies: string[] = [];
  for (const live of remaining) {
    liveBodies.push(parseNote(await readText(io.root, live.path)).body);
  }
  await sweepOrphanAttachments(io.root, liveBodies);

  return gcAttachments;
}

export async function listNotes(io: NoteStorageContext): Promise<NoteRecord[]> {
  const index = await readIndex(io.root);
  return [...index.notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Remove a space id from every note that references it. */
export async function clearSpaceFromNotes(
  io: NoteStorageContext,
  targetSpaceId: SpaceId,
): Promise<string[]> {
  if (targetSpaceId === GENERAL_SPACE_ID) return [];
  const index = await readIndex(io.root);
  const affected = index.notes.filter((note) => {
    const ids = spaceIdsFromSources(note);
    return ids.includes(targetSpaceId);
  });
  if (affected.length === 0) return [];

  const updatedIds: string[] = [];
  for (const record of affected) {
    const existingText = await readText(io.root, record.path);
    const existing = parseNote(existingText);
    const nextSpaceIds = spaceIdsFromSources(record, existing.frontmatter).filter(
      (id) => id !== targetSpaceId,
    );
    const updated = recordWithSpaceIds(
      { ...record, updatedAt: (io.now ?? nowDefault)().toISOString() },
      nextSpaceIds,
    );
    await writeText(
      io.root,
      record.path,
      serializeNote(
        frontmatterFromRecord(updated, existing.frontmatter, nextSpaceIds),
        existing.body,
      ),
    );
    updatedIds.push(record.id);
  }

  await mutateIndex(io.root, (fresh) => {
    fresh.notes = fresh.notes.map((note) => {
      const ids = spaceIdsFromSources(note);
      if (!ids.includes(targetSpaceId)) return note;
      return recordWithSpaceIds(
        note,
        ids.filter((id) => id !== targetSpaceId),
      );
    });
  });
  return updatedIds;
}
