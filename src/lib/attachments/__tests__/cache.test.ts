import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeFakeRoot } from "../../../test/fakeFs";
import { initializeVault } from "../../fs/vault";
import { storeAttachment } from "../storage";
import { AttachmentURLCache } from "../cache";

function fakeFile(name: string, type: string, bytes: number[]) {
  const buf = new Uint8Array(bytes);
  return {
    name,
    type,
    async arrayBuffer() {
      const out = new ArrayBuffer(buf.byteLength);
      new Uint8Array(out).set(buf);
      return out;
    },
  };
}

describe("AttachmentURLCache", () => {
  beforeEach(() => {
    // jsdom may not implement URL.createObjectURL; provide a deterministic stub.
    let n = 0;
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: () => `blob:stub/${++n}`,
      revokeObjectURL: vi.fn(),
    });
  });

  it("resolves an attachment to a blob URL", async () => {
    const root = makeFakeRoot();
    await initializeVault(root);
    const stored = await storeAttachment(
      root,
      "n1",
      fakeFile("a.png", "image/png", [1, 2, 3]),
    );

    const cache = new AttachmentURLCache(root);
    const url = await cache.resolve(stored.path);
    expect(url).toMatch(/^blob:/);
  });

  it("returns the same URL for repeat lookups", async () => {
    const root = makeFakeRoot();
    await initializeVault(root);
    const stored = await storeAttachment(
      root,
      "n1",
      fakeFile("a.png", "image/png", [9, 9]),
    );
    const cache = new AttachmentURLCache(root);
    const a = await cache.resolve(stored.path);
    const b = await cache.resolve(stored.path);
    expect(a).toBe(b);
  });

  it("returns null for missing paths", async () => {
    const root = makeFakeRoot();
    await initializeVault(root);
    const cache = new AttachmentURLCache(root);
    expect(await cache.resolve("attachments/nope/missing.png")).toBeNull();
  });
});
