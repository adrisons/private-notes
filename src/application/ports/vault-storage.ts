/**
 * Backend-agnostic file I/O over an open vault (ADR-013). Paths are POSIX-style
 * relative paths within the vault root ("notes/2026/foo.md"); implementations
 * translate them to whatever the underlying store uses.
 *
 * This port deliberately exposes no browser or native types so that
 * application logic never learns which backend (File System Access, OPFS, …) is
 * underneath. The web adapter is `FsaVaultStorage` in
 * `infrastructure/platform/web/`.
 */
export interface VaultStorage {
  readText(path: string): Promise<string>;
  writeText(path: string, text: string): Promise<void>;
  writeBytes(path: string, data: ArrayBuffer | Uint8Array | Blob): Promise<void>;
  fileExists(path: string): Promise<boolean>;
  removeFile(path: string): Promise<void>;
  /**
   * Every file under `dirPath` (POSIX-relative, no trailing slash). Empty array
   * when the directory is absent. Order is backend-defined; callers that need
   * determinism must sort.
   */
  listFilesRecursive(dirPath: string): Promise<string[]>;
  /** True when the root has no entries other than backend noise (e.g. `.DS_Store`). */
  isEffectivelyEmpty(): Promise<boolean>;
}

/**
 * Opaque reference to an open vault handed to the presentation layer. It
 * carries only what the UI needs — a stable id and a human label — never the
 * backend handle itself.
 */
export interface VaultRef {
  readonly id: string;
  readonly displayName: string;
}
