import { describe, it, expect, vi, beforeEach } from "vitest";
import { fileExists } from "../../../infrastructure/fs/handle";
import { fakeFile, setupTestVault } from "../../../test/vaultFixtures";
import { FsAttachmentStore } from "../fs-attachment-store";

describe("FsAttachmentStore", () => {
  beforeEach(() => {
    let n = 0;
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: () => `blob:stub/${++n}`,
      revokeObjectURL: vi.fn(),
    });
  });

  it("stores a file and resolves a blob URL", async () => {
    const io = await setupTestVault();
    const store = new FsAttachmentStore(io.root);

    const { path } = await store.store(fakeFile("a.png", "image/png", [9, 9, 9]));
    expect(path).toMatch(/^attachments\/[0-9a-f]{64}\.png$/);
    expect(await fileExists(io.root, path)).toBe(true);

    const url = await store.resolve(path);
    expect(url).toMatch(/^blob:/);

    store.dispose();
  });
});
