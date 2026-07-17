export interface VaultGateway {
  ensurePermission(handle: FileSystemDirectoryHandle): Promise<void>;
  hasPermission(handle: FileSystemDirectoryHandle): Promise<boolean>;
  open(handle: FileSystemDirectoryHandle): Promise<void>;
  reconcile(handle: FileSystemDirectoryHandle): Promise<void>;
}
