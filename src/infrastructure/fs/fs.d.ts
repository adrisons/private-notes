// Extra typings for File System Access API features not yet in lib.dom.
// `entries()`, `keys()`, `values()` and async iteration are shipped in Chromium
// but absent from the bundled DOM lib in some TS versions.

declare global {
  interface FileSystemDirectoryHandle {
    queryPermission(descriptor: {
      mode: "read" | "readwrite";
    }): Promise<PermissionState>;
    requestPermission(descriptor: {
      mode: "read" | "readwrite";
    }): Promise<PermissionState>;
    entries(): AsyncIterableIterator<
      [string, FileSystemFileHandle | FileSystemDirectoryHandle]
    >;
    keys(): AsyncIterableIterator<string>;
    values(): AsyncIterableIterator<
      FileSystemFileHandle | FileSystemDirectoryHandle
    >;
    [Symbol.asyncIterator](): AsyncIterableIterator<
      [string, FileSystemFileHandle | FileSystemDirectoryHandle]
    >;
  }
}

export {};
