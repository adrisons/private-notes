import type { CustomSpace, Note, NoteId, NoteSummary, SpaceId } from "../domain";
import type { NoteRepository, CreateNoteInput } from "./ports/note-repository";
import type { ReindexNoteInput } from "./ports/semantic-search";
import type { SemanticSearch } from "./ports/semantic-search";
import type {
  CreateSpaceInput,
  SpaceRepository,
  UpdateSpaceInput,
} from "./ports/space-repository";
import type { AttachmentStore } from "./ports/attachment-store";

export interface VaultStartup {
  summaries: NoteSummary[];
  current: Note | null;
}

export interface VaultSessionDeps {
  root: FileSystemDirectoryHandle;
  vaultName?: string;
  notes: NoteRepository;
  spaces: SpaceRepository;
  attachments: AttachmentStore;
  createSemanticSearch: (root: FileSystemDirectoryHandle) => SemanticSearch;
}

/** Session-scoped facade for one open vault folder. */
export class VaultSession {
  readonly vaultName: string;
  private readonly root: FileSystemDirectoryHandle;
  private readonly notes: NoteRepository;
  private readonly spaces: SpaceRepository;
  readonly attachments: AttachmentStore;
  private readonly createSemanticSearchFn: (
    root: FileSystemDirectoryHandle,
  ) => SemanticSearch;

  private constructor(deps: VaultSessionDeps) {
    this.root = deps.root;
    this.vaultName = deps.vaultName ?? deps.root.name;
    this.notes = deps.notes;
    this.spaces = deps.spaces;
    this.attachments = deps.attachments;
    this.createSemanticSearchFn = deps.createSemanticSearch;
  }

  static create(deps: VaultSessionDeps): VaultSession {
    return new VaultSession(deps);
  }

  createSemanticSearch(): SemanticSearch {
    return this.createSemanticSearchFn(this.root);
  }

  listSummaries(): Promise<NoteSummary[]> {
    return this.notes.list();
  }

  listForReindex(): Promise<ReindexNoteInput[]> {
    return this.notes.listForReindex();
  }

  openNote(id: NoteId): Promise<Note | null> {
    return this.notes.read(id);
  }

  createNote(input: CreateNoteInput = {
    title: "Untitled",
    body: "",
  }): Promise<Note> {
    return this.notes.create(input);
  }

  async saveNote(
    id: NoteId,
    title: string,
    body: string,
  ): Promise<{ note: Note; gcAttachments: string[] }> {
    const { note, gcAttachments } = await this.notes.update(id, { title, body });
    this.attachments.invalidate(gcAttachments);
    return { note, gcAttachments };
  }

  async assignNoteSpaces(id: NoteId, spaceIds: SpaceId[]): Promise<Note | null> {
    const { note } = await this.notes.update(id, { spaceIds });
    return note;
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

  duplicateNote(id: NoteId): Promise<Note | null> {
    return this.notes.duplicate(id);
  }

  async sweepOrphanAttachments(bodies: string[]): Promise<string[]> {
    return this.attachments.sweepUnreferenced(bodies);
  }

  dispose(): void {
    this.attachments.dispose();
  }
}

export type { CreateNoteInput };
