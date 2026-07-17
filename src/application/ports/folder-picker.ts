export interface FolderPicker {
  pick(): Promise<FileSystemDirectoryHandle | null>;
}
