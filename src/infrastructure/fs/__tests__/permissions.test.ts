import { describe, it, expect, vi } from "vitest";
import {
  ensureReadWritePermission,
  hasReadWritePermission,
} from "../permissions";

function mockHandle(
  query: PermissionState,
  request?: PermissionState,
): FileSystemDirectoryHandle {
  return {
    queryPermission: vi.fn().mockResolvedValue(query),
    requestPermission: vi
      .fn()
      .mockResolvedValue(request ?? query),
  } as unknown as FileSystemDirectoryHandle;
}

describe("ensureReadWritePermission", () => {
  it("does not request when permission is already granted", async () => {
    const root = mockHandle("granted");
    await ensureReadWritePermission(root);
    expect(root.queryPermission).toHaveBeenCalledWith({ mode: "readwrite" });
    expect(root.requestPermission).not.toHaveBeenCalled();
  });

  it("requests permission when not yet granted", async () => {
    const root = mockHandle("prompt", "granted");
    await ensureReadWritePermission(root);
    expect(root.requestPermission).toHaveBeenCalledWith({ mode: "readwrite" });
  });

  it("throws when permission is denied", async () => {
    const root = mockHandle("prompt", "denied");
    await expect(ensureReadWritePermission(root)).rejects.toThrow(
      "Folder permission was not granted.",
    );
  });
});

describe("hasReadWritePermission", () => {
  it("returns true only when query reports granted", async () => {
    await expect(hasReadWritePermission(mockHandle("granted"))).resolves.toBe(
      true,
    );
    await expect(hasReadWritePermission(mockHandle("prompt"))).resolves.toBe(
      false,
    );
    await expect(hasReadWritePermission(mockHandle("denied"))).resolves.toBe(
      false,
    );
  });
});
