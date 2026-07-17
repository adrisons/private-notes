import { initializeVault } from "../infrastructure/fs/vault";
import { makeFakeRootWithPermissions } from "./fakeFs";

export interface TestVaultIo {
  root: FileSystemDirectoryHandle;
  now: () => Date;
  newId: () => string;
}

/** Initialized vault with deterministic ids for note CRUD tests. */
export async function setupTestVault(
  at = "2026-05-17T10:00:00.000Z",
): Promise<TestVaultIo> {
  const root = makeFakeRootWithPermissions();
  await initializeVault(root, new Date(at));
  let seq = 0;
  return {
    root,
    now: () => new Date(at),
    newId: () => `01HXXX${String(seq++).padStart(20, "0")}`,
  };
}

/** Minimal File stub for attachment upload tests. */
export function fakeFile(name: string, type: string, bytes: number[]): File {
  const buf = new Uint8Array(bytes);
  return {
    name,
    type,
    async arrayBuffer() {
      const out = new ArrayBuffer(buf.byteLength);
      new Uint8Array(out).set(buf);
      return out;
    },
  } as unknown as File;
}
