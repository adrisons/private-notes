import { getFile } from "../fs/handle";

/**
 * Per-vault cache of attachment blob URLs. Browsers cannot load a relative
 * path like `attachments/<noteId>/<hash>.png` on their own — we read the file
 * through the File System Access handle, wrap it in a blob URL, and remember
 * the URL so subsequent renders are free.
 *
 * Call `dispose` when the vault is closed to revoke the URLs and let the
 * browser reclaim the memory.
 */
export class AttachmentURLCache {
  private root: FileSystemDirectoryHandle;
  private cache = new Map<string, string>();
  private inflight = new Map<string, Promise<string | null>>();

  constructor(root: FileSystemDirectoryHandle) {
    this.root = root;
  }

  async resolve(src: string): Promise<string | null> {
    if (this.cache.has(src)) return this.cache.get(src)!;
    const existing = this.inflight.get(src);
    if (existing) return existing;
    const promise = this.load(src).finally(() => this.inflight.delete(src));
    this.inflight.set(src, promise);
    return promise;
  }

  /** Drop the cached entry for a single attachment (e.g. after replacement). */
  invalidate(src: string): void {
    const url = this.cache.get(src);
    if (url) URL.revokeObjectURL(url);
    this.cache.delete(src);
  }

  private async load(src: string): Promise<string | null> {
    try {
      const handle = await getFile(this.root, src);
      const blob = await handle.getFile();
      const url = URL.createObjectURL(blob);
      this.cache.set(src, url);
      return url;
    } catch {
      return null;
    }
  }

  dispose(): void {
    for (const url of this.cache.values()) URL.revokeObjectURL(url);
    this.cache.clear();
    this.inflight.clear();
  }
}
