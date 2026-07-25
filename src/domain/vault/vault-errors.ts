/** Why a folder cannot be opened as a private-notes vault. */
export type VaultIncompatibleCode =
  | "newer-app-version"
  | "not-a-vault"
  | "corrupt-manifest";

/** Thrown when inspect/open refuses a folder before I/O proceeds. */
export class VaultIncompatibleError extends Error {
  readonly code: VaultIncompatibleCode;

  constructor(code: VaultIncompatibleCode, reason: string) {
    super(reason);
    this.name = "VaultIncompatibleError";
    this.code = code;
  }
}

/** Thrown when a critical vault file fails validation. */
export class VaultDataError extends Error {
  /** The vault-relative file that failed, for actionable messages. */
  readonly file?: string;

  constructor(message: string, file?: string) {
    super(file ? `${file}: ${message}` : message);
    this.name = "VaultDataError";
    this.file = file;
  }
}

/** Thrown when a note id is missing from the vault index. */
export class NoteNotFoundError extends Error {
  readonly noteId: string;

  constructor(noteId: string) {
    super(`Note ${noteId} not found`);
    this.name = "NoteNotFoundError";
    this.noteId = noteId;
  }
}
