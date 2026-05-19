import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "fake-indexeddb/auto";
import { makeFakeRoot } from "../../../test/fakeFs";
import {
  clearVaultHandle,
  loadVaultHandle,
  persistVaultHandle,
} from "../vault-handle-store";

describe("vault-handle-store", () => {
  beforeEach(async () => {
    await clearVaultHandle();
  });

  it("persists and reloads the vault directory handle", async () => {
    const root = makeFakeRoot();
    await persistVaultHandle(root);
    const loaded = await loadVaultHandle();
    // fake-indexeddb clones on put/get; the real API keeps the same handle.
    expect(loaded).toEqual(root);
  });

  it("returns null when nothing was stored", async () => {
    expect(await loadVaultHandle()).toBeNull();
  });

  it("clearVaultHandle removes the stored handle", async () => {
    await persistVaultHandle(makeFakeRoot());
    await clearVaultHandle();
    expect(await loadVaultHandle()).toBeNull();
  });
});

describe("vault-handle-store without IndexedDB", () => {
  const original = globalThis.indexedDB;

  beforeEach(() => {
    // @ts-expect-error — simulate environments without IndexedDB (e.g. some test runners)
    delete globalThis.indexedDB;
  });

  afterEach(() => {
    globalThis.indexedDB = original;
  });

  it("no-ops persist/clear and load returns null", async () => {
    const root = makeFakeRoot();
    await expect(persistVaultHandle(root)).resolves.toBeUndefined();
    await expect(loadVaultHandle()).resolves.toBeNull();
    await expect(clearVaultHandle()).resolves.toBeUndefined();
  });
});
