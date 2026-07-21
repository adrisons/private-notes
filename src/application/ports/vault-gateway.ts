export interface VaultRepairAssessment {
  eligible: boolean;
  noteCount: number;
}

export interface VaultRepairResult {
  noteCount: number;
  spaceCount: number;
  skipped: string[];
}

export interface VaultGateway {
  ensurePermission(handle: FileSystemDirectoryHandle): Promise<void>;
  hasPermission(handle: FileSystemDirectoryHandle): Promise<boolean>;
  open(handle: FileSystemDirectoryHandle): Promise<void>;
  reconcile(handle: FileSystemDirectoryHandle): Promise<void>;
  assessRepair(handle: FileSystemDirectoryHandle): Promise<VaultRepairAssessment>;
  repair(handle: FileSystemDirectoryHandle): Promise<VaultRepairResult>;
}
