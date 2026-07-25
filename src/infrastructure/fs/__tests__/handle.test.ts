import { describe, it, expect } from "vitest";
import { makeFakeRoot } from "../../../test/fakeFs";
import {
  fileExists,
  getFile,
  isEffectivelyEmpty,
  isSafeRelativePath,
  readText,
  writeBytes,
  writeText,
} from "../handle";

describe("handle", () => {
  it("round-trips text on a nested path", async () => {
    const root = makeFakeRoot();
    const path = "notes/2026/01/foo.md";
    await writeText(root, path, "# Hello");
    expect(await readText(root, path)).toBe("# Hello");
  });

  it("round-trips bytes", async () => {
    const root = makeFakeRoot();
    const data = new Uint8Array([1, 2, 3, 4]);
    await writeBytes(root, "attachments/blob.bin", data);
    const file = await getFile(root, "attachments/blob.bin");
    const buf = await file.getFile().then((f) => f.arrayBuffer());
    const read = new Uint8Array(buf);
    expect(read).toEqual(data);
  });

  it("fileExists returns false for missing files", async () => {
    const root = makeFakeRoot();
    expect(await fileExists(root, "missing.txt")).toBe(false);
  });

  it("isEffectivelyEmpty ignores .DS_Store", async () => {
    const root = makeFakeRoot();
    await writeText(root, ".DS_Store", "");
    expect(await isEffectivelyEmpty(root)).toBe(true);
  });

  it("isEffectivelyEmpty returns false when a real file exists", async () => {
    const root = makeFakeRoot();
    await writeText(root, "note.md", "x");
    expect(await isEffectivelyEmpty(root)).toBe(false);
  });

  it("getFile throws on an empty path", async () => {
    const root = makeFakeRoot();
    await expect(getFile(root, "")).rejects.toThrow("Empty path");
  });
});

describe("isSafeRelativePath", () => {
  it("accepts normal vault-relative paths", () => {
    expect(isSafeRelativePath("notes/2026/05/a-01HX.md")).toBe(true);
    expect(isSafeRelativePath("attachments/abc123.png")).toBe(true);
  });

  it("rejects traversal, absolute, and empty segments", () => {
    expect(isSafeRelativePath("")).toBe(false);
    expect(isSafeRelativePath("attachments/../notes/evil.md")).toBe(false);
    expect(isSafeRelativePath("notes/./foo.md")).toBe(false);
    expect(isSafeRelativePath("/etc/passwd")).toBe(false);
    expect(isSafeRelativePath("notes//foo.md")).toBe(false);
    expect(isSafeRelativePath("notes\\foo.md")).toBe(false);
  });
});
