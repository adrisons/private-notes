import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { makeFakeRootWithPermissions } from "../../../test/fakeFs";
import { isFileSystemAccessSupported, pickFolder } from "../picker";

describe("picker", () => {
  let showDirectoryPicker: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    showDirectoryPicker = vi.fn();
    vi.stubGlobal("showDirectoryPicker", showDirectoryPicker);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("isFileSystemAccessSupported is true when showDirectoryPicker exists", () => {
    expect(isFileSystemAccessSupported()).toBe(true);
  });

  it("isFileSystemAccessSupported is false when showDirectoryPicker is missing", () => {
    vi.unstubAllGlobals();
    expect(isFileSystemAccessSupported()).toBe(false);
  });

  describe("pickFolder", () => {
    it("returns the picked directory handle", async () => {
      const root = makeFakeRootWithPermissions();
      showDirectoryPicker.mockResolvedValue(root);
      await expect(pickFolder()).resolves.toBe(root);
    });

    it("returns null when the user cancels", async () => {
      showDirectoryPicker.mockRejectedValue(
        new DOMException("The user aborted a request.", "AbortError"),
      );
      await expect(pickFolder()).resolves.toBeNull();
    });

    it("throws when the API is unsupported", async () => {
      vi.unstubAllGlobals();
      await expect(pickFolder()).rejects.toThrow(
        "File System Access API is not supported in this browser.",
      );
    });

    it("forwards id and startIn to showDirectoryPicker", async () => {
      const root = makeFakeRootWithPermissions();
      showDirectoryPicker.mockResolvedValue(root);
      await pickFolder({ id: "test-vault", startIn: "desktop" });
      expect(showDirectoryPicker).toHaveBeenCalledWith({
        id: "test-vault",
        mode: "readwrite",
        startIn: "desktop",
      });
    });
  });
});
