import { describe, it, expect } from "vitest";
import { makeFakeRoot } from "../../../test/fakeFs";
import { writeText } from "../handle";
import { initializeVault } from "../vault";
import { PATHS } from "../schema";
import { serializeNote } from "../../../domain/note/frontmatter";
import {
  assessVaultRepair,
  repairVault,
} from "../repair-vault";

describe("assessVaultRepair", () => {
  it("returns ineligible for an initialized vault", async () => {
    const root = makeFakeRoot();
    await initializeVault(root);
    expect(await assessVaultRepair(root)).toEqual({
      eligible: false,
      noteCount: 0,
    });
  });

  it("returns ineligible when notes/ is missing or empty", async () => {
    const root = makeFakeRoot();
    expect(await assessVaultRepair(root)).toEqual({
      eligible: false,
      noteCount: 0,
    });
  });

  it("returns eligible when note files exist without metadata", async () => {
    const root = makeFakeRoot();
    await writeText(
      root,
      "notes/2026/05/sample-note.md",
      serializeNote(
        {
          id: "note-001",
          title: "Sample",
          createdAt: "2026-05-17T10:00:00.000Z",
          updatedAt: "2026-05-17T10:00:00.000Z",
        },
        "Body",
      ),
    );
    expect(await assessVaultRepair(root)).toEqual({
      eligible: true,
      noteCount: 1,
    });
  });
});

describe("repairVault", () => {
  it("writes vault metadata from existing note files", async () => {
    const root = makeFakeRoot();
    const path = "notes/2026/05/hello-note-001.md";
    await writeText(
      root,
      path,
      serializeNote(
        {
          id: "note-001",
          title: "Hello",
          createdAt: "2026-05-17T10:00:00.000Z",
          updatedAt: "2026-05-17T10:00:00.000Z",
          spaceIds: "space-a",
        },
        "Recipe body",
      ),
    );

    const result = await repairVault(root, new Date("2026-05-17T10:00:00.000Z"));
    expect(result).toEqual({
      noteCount: 1,
      spaceCount: 1,
      skipped: [],
    });

    const manifest = JSON.parse(await readManifest(root));
    expect(manifest.app).toBe("private-notes");

    const index = JSON.parse(await readIndex(root));
    expect(index.notes).toHaveLength(1);
    expect(index.notes[0]).toMatchObject({
      id: "note-001",
      title: "Hello",
      path,
      spaceIds: "space-a",
    });

    const spaces = JSON.parse(await readSpaces(root));
    expect(spaces.spaces).toHaveLength(1);
    expect(spaces.spaces[0]?.name).toBe("Recovered space 1");
  });

  it("refuses when metadata already exists", async () => {
    const root = makeFakeRoot();
    await initializeVault(root);
    await expect(repairVault(root)).rejects.toThrow(
      "Vault metadata already exists.",
    );
  });

  it("skips unreadable note files and still repairs the rest", async () => {
    const root = makeFakeRoot();
    await writeText(root, "notes/2026/05/broken.md", "not frontmatter");
    await writeText(
      root,
      "notes/2026/05/good-note-002.md",
      serializeNote(
        {
          id: "note-002",
          title: "Good",
          createdAt: "2026-05-17T10:00:00.000Z",
          updatedAt: "2026-05-17T10:00:00.000Z",
        },
        "Body",
      ),
    );

    const result = await repairVault(root);
    expect(result.noteCount).toBe(1);
    expect(result.skipped).toEqual(["notes/2026/05/broken.md"]);
  });
});

async function readManifest(root: FileSystemDirectoryHandle): Promise<string> {
  const { readText } = await import("../handle");
  return readText(root, PATHS.manifest);
}

async function readIndex(root: FileSystemDirectoryHandle): Promise<string> {
  const { readText } = await import("../handle");
  return readText(root, PATHS.index);
}

async function readSpaces(root: FileSystemDirectoryHandle): Promise<string> {
  const { readText } = await import("../handle");
  return readText(root, PATHS.spaces);
}
