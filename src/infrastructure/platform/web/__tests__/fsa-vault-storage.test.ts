import { describe, it, expect, vi, beforeEach } from "vitest";
import * as handle from "../../../fs/handle";
import { FsaVaultStorage } from "../fsa-vault-storage";

// The adapter's only job is to bind one root handle and forward each port
// method to the matching `fs/handle` helper. The helpers' behaviour is already
// covered in `fs/__tests__/handle.test.ts`, so here we assert the wiring
// (right function, bound root, forwarded args, passthrough result) instead of
// re-exercising real I/O.
vi.mock("../../../fs/handle", () => ({
  readText: vi.fn().mockResolvedValue("text"),
  writeText: vi.fn().mockResolvedValue(undefined),
  writeBytes: vi.fn().mockResolvedValue(undefined),
  fileExists: vi.fn().mockResolvedValue(true),
  removeFile: vi.fn().mockResolvedValue(undefined),
  listFilesRecursive: vi.fn().mockResolvedValue(["notes/a.md"]),
  isEffectivelyEmpty: vi.fn().mockResolvedValue(false),
}));

const root = { name: "vault" } as unknown as FileSystemDirectoryHandle;

describe("FsaVaultStorage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("delegates each method to fs/handle with the bound root", async () => {
    const storage = new FsaVaultStorage(root);
    const bytes = new Uint8Array([1, 2, 3]);

    expect(await storage.readText("a.md")).toBe("text");
    expect(handle.readText).toHaveBeenCalledWith(root, "a.md");

    await storage.writeText("a.md", "hi");
    expect(handle.writeText).toHaveBeenCalledWith(root, "a.md", "hi");

    await storage.writeBytes("b.bin", bytes);
    expect(handle.writeBytes).toHaveBeenCalledWith(root, "b.bin", bytes);

    expect(await storage.fileExists("a.md")).toBe(true);
    expect(handle.fileExists).toHaveBeenCalledWith(root, "a.md");

    await storage.removeFile("a.md");
    expect(handle.removeFile).toHaveBeenCalledWith(root, "a.md");

    expect(await storage.listFilesRecursive("notes")).toEqual(["notes/a.md"]);
    expect(handle.listFilesRecursive).toHaveBeenCalledWith(root, "notes");

    expect(await storage.isEffectivelyEmpty()).toBe(false);
    expect(handle.isEffectivelyEmpty).toHaveBeenCalledWith(root);
  });
});
