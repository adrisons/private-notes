import { describe, it, expect } from "vitest";
import { makeFakeRoot } from "../../../test/fakeFs";
import { initializeVault } from "../../fs/vault";
import { fileExists } from "../../fs/handle";
import { storeAttachment } from "../storage";

function fakeFile(name: string, type: string, bytes: number[]): {
  name: string;
  type: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
} {
  const buf = new Uint8Array(bytes);
  return {
    name,
    type,
    async arrayBuffer() {
      // Copy into a fresh ArrayBuffer so the caller cannot mutate ours.
      const out = new ArrayBuffer(buf.byteLength);
      new Uint8Array(out).set(buf);
      return out;
    },
  };
}

describe("storeAttachment", () => {
  it("writes the file under attachments/<noteId>/<sha1>.<ext>", async () => {
    const root = makeFakeRoot();
    await initializeVault(root);
    const result = await storeAttachment(
      root,
      "01HX",
      fakeFile("cat.png", "image/png", [1, 2, 3]),
    );
    expect(result.path).toMatch(/^attachments\/01HX\/[0-9a-f]{40}\.png$/);
    expect(await fileExists(root, result.path)).toBe(true);
  });

  it("is content-addressed: the same bytes produce the same path", async () => {
    const root = makeFakeRoot();
    await initializeVault(root);
    const a = await storeAttachment(
      root,
      "n",
      fakeFile("a.png", "image/png", [1, 2, 3]),
    );
    const b = await storeAttachment(
      root,
      "n",
      fakeFile("b.png", "image/png", [1, 2, 3]),
    );
    expect(a.path).toBe(b.path);
  });
});
