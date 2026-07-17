export interface VaultHandleStore {
  load(): Promise<FileSystemDirectoryHandle | null>;
  persist(handle: FileSystemDirectoryHandle): Promise<void>;
  clear(): Promise<void>;
}
