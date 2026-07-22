import type { VaultStorage } from "../../../application/ports/vault-storage";
import {
  fileExists,
  isEffectivelyEmpty,
  listFilesRecursive,
  readText,
  removeFile,
  writeBytes,
  writeText,
} from "../../fs/handle";

/**
 * Web backend for {@link VaultStorage} (ADR-013): binds one
 * `FileSystemDirectoryHandle` and forwards to the thin FSA helpers in
 * `infrastructure/fs/handle.ts`. This is the only place above `fs/handle.ts`
 * that a browser handle is held; everything else talks to the port.
 */
export class FsaVaultStorage implements VaultStorage {
  private readonly root: FileSystemDirectoryHandle;

  constructor(root: FileSystemDirectoryHandle) {
    this.root = root;
  }

  readText(path: string): Promise<string> {
    return readText(this.root, path);
  }

  writeText(path: string, text: string): Promise<void> {
    return writeText(this.root, path, text);
  }

  writeBytes(path: string, data: ArrayBuffer | Uint8Array | Blob): Promise<void> {
    // The DOM lib types `writeBytes` with a narrower Uint8Array<ArrayBuffer>;
    // the runtime accepts any of the three FileSystemWriteChunkType values.
    return writeBytes(
      this.root,
      path,
      data as Parameters<typeof writeBytes>[2],
    );
  }

  fileExists(path: string): Promise<boolean> {
    return fileExists(this.root, path);
  }

  removeFile(path: string): Promise<void> {
    return removeFile(this.root, path);
  }

  listFilesRecursive(dirPath: string): Promise<string[]> {
    return listFilesRecursive(this.root, dirPath);
  }

  isEffectivelyEmpty(): Promise<boolean> {
    return isEffectivelyEmpty(this.root);
  }
}

/** Convenience factory mirroring the other composition helpers. */
export function createFsaVaultStorage(
  root: FileSystemDirectoryHandle,
): VaultStorage {
  return new FsaVaultStorage(root);
}
