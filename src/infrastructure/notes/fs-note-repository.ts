import {
  createNote,
  deleteNote,
  duplicateNote,
  listNotes,
  readNote,
  updateNote,
} from "../../lib/notes/storage";
import {
  noteFromRecord,
  summaryFromRecord,
  type NoteId,
} from "../../domain";
import type {
  CreateNoteInput,
  NoteRepository,
  SaveNoteResult,
  UpdateNoteInput,
} from "../../application/ports/note-repository";

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

  async listRecords() {
    return listNotes(this.io());
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
}
