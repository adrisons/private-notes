import type { Note, NoteId } from "../domain";
import { noteToSummary, pickMostRecent } from "../domain";
import type { NoteRepository, CreateNoteInput } from "./ports/note-repository";
import type { AttachmentStore } from "./ports/attachment-store";
import type { OpenNoteState } from "./view-models";
import { toOpenNoteState } from "./view-models";
import { WELCOME_NOTE_BODY, WELCOME_NOTE_TITLE } from "../lib/notes/welcome-note";
import type { NoteSummary } from "../domain";

export interface VaultStartup {
  summaries: NoteSummary[];
  current: OpenNoteState | null;
}

export interface VaultSessionDeps {
  root: FileSystemDirectoryHandle;
  notes: NoteRepository;
  attachments: AttachmentStore;
}

/** Session-scoped facade for one open vault folder. */
export class VaultSession {
  readonly root: FileSystemDirectoryHandle;
  private readonly notes: NoteRepository;
  readonly attachments: AttachmentStore;

  private constructor(deps: VaultSessionDeps) {
    this.root = deps.root;
    this.notes = deps.notes;
    this.attachments = deps.attachments;
  }

  static create(deps: VaultSessionDeps): VaultSession {
    return new VaultSession(deps);
  }

  listSummaries(): Promise<NoteSummary[]> {
    return this.notes.list();
  }

  listNoteRecords() {
    return this.notes.listRecords();
  }

  /** Seed welcome note or open the most recently edited note. */
  async resolveStartup(): Promise<VaultStartup> {
    let summaries = await this.notes.list();

    if (summaries.length === 0) {
      const note = await this.notes.create({
        title: WELCOME_NOTE_TITLE,
        body: WELCOME_NOTE_BODY,
      });
      summaries = [noteToSummary(note)];
      return {
        summaries,
        current: toOpenNoteState(note, note.updatedAt),
      };
    }

    const target = pickMostRecent(summaries);
    if (!target) return { summaries, current: null };

    const note = await this.notes.read(target.id);
    if (!note) return { summaries, current: null };

    return {
      summaries,
      current: toOpenNoteState(note, note.updatedAt),
    };
  }

  async openNote(id: NoteId): Promise<OpenNoteState | null> {
    const note = await this.notes.read(id);
    if (!note) return null;
    return toOpenNoteState(note, note.updatedAt);
  }

  async createNote(input: CreateNoteInput = {
    title: "Untitled",
    body: "",
  }): Promise<OpenNoteState> {
    const note = await this.notes.create(input);
    return toOpenNoteState(note, note.updatedAt);
  }

  async saveNote(
    id: NoteId,
    title: string,
    body: string,
  ): Promise<{ state: OpenNoteState; gcAttachments: string[]; note: Note }> {
    const { note, gcAttachments } = await this.notes.update(id, { title, body });
    this.attachments.invalidate(gcAttachments);
    return {
      state: toOpenNoteState(note, note.updatedAt),
      gcAttachments,
      note,
    };
  }

  async deleteNote(id: NoteId): Promise<string[]> {
    const gcAttachments = await this.notes.delete(id);
    this.attachments.invalidate(gcAttachments);
    return gcAttachments;
  }

  async duplicateNote(
    id: NoteId,
  ): Promise<{ state: OpenNoteState; note: Note } | null> {
    const note = await this.notes.duplicate(id);
    if (!note) return null;
    return {
      state: toOpenNoteState(note, note.updatedAt),
      note,
    };
  }

  dispose(): void {
    this.attachments.dispose();
  }
}

export type { CreateNoteInput };
