import {
  clearSpaceFromNotes,
  createNote,
  deleteNote,
  duplicateNote,
  listNotes,
  readNote,
  readNoteBody,
  updateNote,
} from "./storage";
import {
  noteFromRecord,
  summaryFromRecord,
} from "./note-mappers";
import {
  mapWithConcurrency,
  VAULT_READ_CONCURRENCY,
} from "../fs/concurrency";
import { noteId, type NoteId, type SpaceId } from "../../domain";
import type {
  CreateNoteInput,
  NoteRepository,
  SaveNoteResult,
  UpdateNoteInput,
} from "../../application/ports/note-repository";
import type { ReindexNoteInput } from "../../application/ports/semantic-search";

export class FsNoteRepository implements NoteRepository {
  private readonly root: FileSystemDirectoryHandle;

  constructor(root: FileSystemDirectoryHandle) {
    this.root = root;
  }

  private io() {
    return { root: this.root };
  }

  async list() {
    const records = await listNotes(this.io());
    return records.map(summaryFromRecord);
  }

  /**
   * Every note with its body, for a full reindex. `listNotes` reads the index
   * once and the bodies come from `readNoteBody`, which takes the record it
   * already has: going through `readNote` per note re-read and re-validated
   * the whole index N times, on the critical path of every vault open.
   */
  async listForReindex(): Promise<ReindexNoteInput[]> {
    const records = await listNotes(this.io());
    return mapWithConcurrency(
      records,
      VAULT_READ_CONCURRENCY,
      async (record) => ({
        id: noteId(record.id),
        title: record.title,
        body: await readNoteBody(this.io(), record),
      }),
    );
  }

  async read(id: NoteId) {
    const result = await readNote(this.io(), id);
    if (!result) return null;
    return noteFromRecord(result.record, result.parsed.body);
  }

  async create(input: CreateNoteInput) {
    const record = await createNote(this.io(), input);
    return noteFromRecord(record, input.body);
  }

  async update(id: NoteId, patch: UpdateNoteInput): Promise<SaveNoteResult> {
    const { gcAttachments, ...record } = await updateNote(this.io(), id, patch);
    const body =
      patch.body ??
      (await readNote(this.io(), id))?.parsed.body ??
      "";
    return { note: noteFromRecord(record, body), gcAttachments };
  }

  async delete(id: NoteId) {
    return deleteNote(this.io(), id);
  }

  async duplicate(id: NoteId) {
    const record = await duplicateNote(this.io(), id);
    if (!record) return null;
    const read = await readNote(this.io(), record.id);
    if (!read) return null;
    return noteFromRecord(read.record, read.parsed.body);
  }

  async clearSpace(spaceId: SpaceId): Promise<NoteId[]> {
    const updated = await clearSpaceFromNotes(this.io(), spaceId);
    return updated.map(noteId);
  }
}
