import { describe, it, expect } from "vitest";
import { makeFakeRoot } from "../../../test/fakeFs";
import {
  inspectFolder,
  initializeVault,
  openOrInitialize,
} from "../vault";
import { readText, writeText } from "../handle";
import { PATHS } from "../types";

describe("inspectFolder", () => {
  it("returns empty for a fresh folder", async () => {
    const root = makeFakeRoot();
    expect((await inspectFolder(root)).kind).toBe("empty");
  });

  it("returns incompatible when the folder has unrelated files", async () => {
    const root = makeFakeRoot();
    await writeText(root, "random.txt", "hi");
    const result = await inspectFolder(root);
    expect(result.kind).toBe("incompatible");
  });

  it("returns compatible after initialization", async () => {
    const root = makeFakeRoot();
    await initializeVault(root);
    const result = await inspectFolder(root);
    expect(result.kind).toBe("compatible");
  });

  it("rejects a manifest with the wrong app signature", async () => {
    const root = makeFakeRoot();
    await writeText(
      root,
      PATHS.manifest,
      JSON.stringify({ app: "other", version: 1, createdAt: "now" }),
    );
    const result = await inspectFolder(root);
    expect(result.kind).toBe("incompatible");
  });
});

describe("openOrInitialize", () => {
  it("initializes an empty folder and writes manifest + index", async () => {
    const root = makeFakeRoot();
    const { initialized } = await openOrInitialize(root);
    expect(initialized).toBe(true);
    const manifestText = await readText(root, PATHS.manifest);
    expect(JSON.parse(manifestText).app).toBe("private-notes-llm");
    const indexText = await readText(root, PATHS.index);
    expect(JSON.parse(indexText).notes).toEqual([]);
  });

  it("does not re-initialize an existing vault", async () => {
    const root = makeFakeRoot();
    await initializeVault(root, new Date("2020-01-01T00:00:00Z"));
    const { initialized, manifest } = await openOrInitialize(root);
    expect(initialized).toBe(false);
    expect(manifest.createdAt).toBe("2020-01-01T00:00:00.000Z");
  });

  it("throws on incompatible folders", async () => {
    const root = makeFakeRoot();
    await writeText(root, "stray.txt", "x");
    await expect(openOrInitialize(root)).rejects.toThrow();
  });
});
