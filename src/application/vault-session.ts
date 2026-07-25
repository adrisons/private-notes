import type { CustomSpace, Note, NoteId, NoteSummary, SpaceId } from "../domain";
import type { NoteRepository, CreateNoteInput } from "./ports/note-repository";
import type { ReindexNoteInput } from "./ports/semantic-search";
import type {
  CreateSpaceInput,
  SpaceRepository,
  UpdateSpaceInput,
} from "./ports/space-repository";
import type { AttachmentStore } from "./ports/attachment-store";
import type { OpenNoteState } from "./view-models";
import { toOpenNoteState } from "./view-models";
import { resolveVaultStartup } from "./use-cases/resolve-startup";

export interface VaultStartup {
  summaries: NoteSummary[];
  current: OpenNoteState | null;
}

export interface VaultSessionDeps {
  root: FileSystemDirectoryHandle;
  notes: NoteRepository;
  spaces: SpaceRepository;
  attachments: AttachmentStore;
}

/** Session-scoped facade for one open vault folder. */
export class VaultSession {
  readonly root: FileSystemDirectoryHandle;
  private readonly notes: NoteRepository;
  private readonly spaces: SpaceRepository;
  readonly attachments: AttachmentStore;

  private constructor(deps: VaultSessionDeps) {
    this.root = deps.root;
    this.notes = deps.notes;
    this.spaces = deps.spaces;
    this.attachments = deps.attachments;
  }

  static create(deps: VaultSessionDeps): VaultSession {
    return new VaultSession(deps);
  }

  listSummaries(): Promise<NoteSummary[]> {
    return this.notes.list();
  }

  listForReindex(): Promise<ReindexNoteInput[]> {
    return this.notes.listForReindex();
  }

  resolveStartup(): Promise<VaultStartup> {
    return resolveVaultStartup(this);
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

  async assignNoteSpaces(
    id: NoteId,
    spaceIds: SpaceId[],
  ): Promise<OpenNoteState | null> {
    const { note } = await this.notes.update(id, { spaceIds });
    return toOpenNoteState(note, note.updatedAt);
  }

  listSpaces(): Promise<CustomSpace[]> {
    return this.spaces.list();
  }

  createSpace(input: CreateSpaceInput): Promise<CustomSpace> {
    return this.spaces.create(input);
  }

  updateSpace(
    id: SpaceId,
    patch: UpdateSpaceInput,
  ): Promise<CustomSpace | null> {
    return this.spaces.update(id, patch);
  }

  deleteSpace(id: SpaceId): Promise<boolean> {
    return this.spaces.delete(id);
  }

  /** Note-side half of deleting a space; orchestrated by the delete-space use-case. */
  clearSpaceFromNotes(id: SpaceId): Promise<NoteId[]> {
    return this.notes.clearSpace(id);
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
