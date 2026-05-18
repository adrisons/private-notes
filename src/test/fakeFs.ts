/**
 * In-memory implementation of `FileSystemDirectoryHandle` and
 * `FileSystemFileHandle` good enough to exercise the parts of the File System
 * Access API the app actually uses (entries, getDirectoryHandle,
 * getFileHandle, createWritable, getFile). Not a faithful spec implementation.
 */

class FakeFile {
  name: string;
  data: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(0));
  constructor(name: string) {
    this.name = name;
  }
}

function toUint8(
  chunk: BufferSource | Blob | string,
): Promise<Uint8Array<ArrayBuffer>> {
  if (typeof chunk === "string") {
    return Promise.resolve(new TextEncoder().encode(chunk));
  }
  if (chunk instanceof Blob) {
    return chunk
      .arrayBuffer()
      .then((b) => new Uint8Array(b as ArrayBuffer));
  }
  if (chunk instanceof ArrayBuffer) {
    return Promise.resolve(new Uint8Array(chunk));
  }
  const view = chunk as ArrayBufferView;
  const copy = new ArrayBuffer(view.byteLength);
  new Uint8Array(copy).set(
    new Uint8Array(view.buffer, view.byteOffset, view.byteLength),
  );
  return Promise.resolve(new Uint8Array(copy));
}

export class FakeFileSystemFileHandle {
  readonly kind = "file" as const;
  private node: FakeFile;
  constructor(node: FakeFile) {
    this.node = node;
  }
  get name(): string {
    return this.node.name;
  }
  async getFile(): Promise<File> {
    const data = this.node.data;
    const name = this.node.name;
    // jsdom's `Blob.text()` is missing in some versions; we patch a minimal
    // File-shaped object whose `text()`/`arrayBuffer()` always work.
    const file = {
      name,
      size: data.byteLength,
      type: "application/octet-stream",
      lastModified: 0,
      async text() {
        return new TextDecoder().decode(data);
      },
      async arrayBuffer() {
        const out = new ArrayBuffer(data.byteLength);
        new Uint8Array(out).set(data);
        return out;
      },
      slice() {
        throw new Error("slice() not implemented in fake");
      },
      stream() {
        throw new Error("stream() not implemented in fake");
      },
    };
    return file as unknown as File;
  }
  async createWritable(): Promise<{
    write: (chunk: BufferSource | Blob | string) => Promise<void>;
    close: () => Promise<void>;
  }> {
    const node = this.node;
    let buffer: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(0));
    return {
      async write(chunk) {
        buffer = await toUint8(chunk);
      },
      async close() {
        node.data = buffer;
      },
    };
  }
}

interface DirEntry {
  files: Map<string, FakeFile>;
  dirs: Map<string, DirEntry>;
}

function emptyDir(): DirEntry {
  return { files: new Map(), dirs: new Map() };
}

export class FakeFileSystemDirectoryHandle {
  readonly kind = "directory" as const;
  name: string;
  private entry: DirEntry;

  constructor(name: string = "root", entry: DirEntry = emptyDir()) {
    this.name = name;
    this.entry = entry;
  }

  async getDirectoryHandle(
    name: string,
    options: { create?: boolean } = {},
  ): Promise<FakeFileSystemDirectoryHandle> {
    let child = this.entry.dirs.get(name);
    if (!child) {
      if (!options.create) {
        throw new DOMException(`Directory ${name} not found`, "NotFoundError");
      }
      child = emptyDir();
      this.entry.dirs.set(name, child);
    }
    return new FakeFileSystemDirectoryHandle(name, child);
  }

  async getFileHandle(
    name: string,
    options: { create?: boolean } = {},
  ): Promise<FakeFileSystemFileHandle> {
    let file = this.entry.files.get(name);
    if (!file) {
      if (!options.create) {
        throw new DOMException(`File ${name} not found`, "NotFoundError");
      }
      file = new FakeFile(name);
      this.entry.files.set(name, file);
    }
    return new FakeFileSystemFileHandle(file);
  }

  async removeEntry(name: string): Promise<void> {
    if (!this.entry.files.delete(name)) this.entry.dirs.delete(name);
  }

  async *entries(): AsyncGenerator<
    [string, FakeFileSystemDirectoryHandle | FakeFileSystemFileHandle]
  > {
    for (const [name, file] of this.entry.files)
      yield [name, new FakeFileSystemFileHandle(file)];
    for (const [name, dir] of this.entry.dirs)
      yield [name, new FakeFileSystemDirectoryHandle(name, dir)];
  }
}

/** Build a fresh root suitable for passing to `vault.ts` helpers. */
export function makeFakeRoot(): FileSystemDirectoryHandle {
  return new FakeFileSystemDirectoryHandle() as unknown as FileSystemDirectoryHandle;
}
