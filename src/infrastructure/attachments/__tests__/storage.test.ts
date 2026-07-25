import { describe, it, expect } from "vitest";
import { makeFakeRoot } from "../../../test/fakeFs";
import { initializeVault } from "../../fs/vault";
import { fileExists } from "../../fs/handle";
import {
  AttachmentRejectedError,
  storeAttachment,
} from "../storage";
import { MAX_ATTACHMENT_BYTES } from "../image-policy";

function fakeFile(name: string, type: string, bytes: number[]): {
  name: string;
  type: string;
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
} {
  const buf = new Uint8Array(bytes);
  return {
    name,
    type,
    size: buf.byteLength,
    async arrayBuffer() {
      // Copy into a fresh ArrayBuffer so the caller cannot mutate ours.
      const out = new ArrayBuffer(buf.byteLength);
      new Uint8Array(out).set(buf);
      return out;
    },
  };
}

describe("storeAttachment", () => {
  it("writes the file under attachments/<sha256>.<ext>", async () => {
    const root = makeFakeRoot();
    await initializeVault(root);
    const result = await storeAttachment(
      root,
      fakeFile("cat.png", "image/png", [1, 2, 3]),
    );
    expect(result.path).toMatch(/^attachments\/[0-9a-f]{64}\.png$/);
    expect(await fileExists(root, result.path)).toBe(true);
  });

  it("is content-addressed: the same bytes produce the same path", async () => {
    const root = makeFakeRoot();
    await initializeVault(root);
    const a = await storeAttachment(
      root,
      fakeFile("a.png", "image/png", [1, 2, 3]),
    );
    const b = await storeAttachment(
      root,
      fakeFile("b.png", "image/png", [1, 2, 3]),
    );
    expect(a.path).toBe(b.path);
  });

  it("deduplicates globally across separate store calls", async () => {
    const root = makeFakeRoot();
    await initializeVault(root);
    const a = await storeAttachment(
      root,
      fakeFile("a.png", "image/png", [4, 5, 6]),
    );
    await storeAttachment(root, fakeFile("b.png", "image/png", [4, 5, 6]));
    const attachmentsDir = await root.getDirectoryHandle("attachments");
    let count = 0;
    for await (const entry of attachmentsDir.entries()) {
      void entry;
      count++;
    }
    expect(count).toBe(1);
    expect(a.path).toMatch(/^attachments\/[0-9a-f]{64}\.png$/);
  });

  it("rejects unsupported MIME types even when the name looks like an image", async () => {
    const root = makeFakeRoot();
    await initializeVault(root);
    await expect(
      storeAttachment(root, fakeFile("payload.svg", "image/svg+xml", [1, 2, 3])),
    ).rejects.toBeInstanceOf(AttachmentRejectedError);
  });

  it("derives the extension from MIME, not the original file name", async () => {
    const root = makeFakeRoot();
    await initializeVault(root);
    const result = await storeAttachment(
      root,
      fakeFile("evil.html", "image/png", [1, 2, 3]),
    );
    expect(result.path).toMatch(/\.png$/);
    expect(result.path).not.toMatch(/\.html$/);
  });

  it("rejects files larger than the size cap", async () => {
    const root = makeFakeRoot();
    await initializeVault(root);
    const oversized = {
      name: "big.png",
      type: "image/png",
      size: MAX_ATTACHMENT_BYTES + 1,
      async arrayBuffer() {
        return new ArrayBuffer(MAX_ATTACHMENT_BYTES + 1);
      },
    };
    await expect(storeAttachment(root, oversized)).rejects.toMatchObject({
      message: "This image is too large.",
    });
  });
});
