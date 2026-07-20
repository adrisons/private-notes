import { describe, it, expect } from "vitest";
import { makeFakeRoot } from "../../../test/fakeFs";
import { writeText, readText } from "../handle";
import { PATHS, SCHEMA_VERSION } from "../schema";
import { buildManifest } from "../manifest";
import { migrateVaultIfNeeded } from "../migrate";
import { parseNote } from "../../../domain/note/frontmatter";

describe("migrateVaultIfNeeded", () => {
  it("converts v2 spaceId to spaceIds in index and note frontmatter", async () => {
    const root = makeFakeRoot();
    const manifest = { ...buildManifest(), version: 2 };

    await writeText(root, PATHS.manifest, JSON.stringify(manifest, null, 2));
    await writeText(
      root,
      PATHS.index,
      JSON.stringify(
        {
          version: 2,
          notes: [
            {
              id: "01HNOTE123",
              title: "Tagged",
              path: "notes/2026/05/tagged-01HNOTE123.md",
              createdAt: "2026-05-17T10:00:00.000Z",
              updatedAt: "2026-05-17T10:00:00.000Z",
              spaceId: "01SPACE123",
            },
          ],
        },
        null,
        2,
      ),
    );
    await writeText(
      root,
      "notes/2026/05/tagged-01HNOTE123.md",
      `---
id: "01HNOTE123"
title: "Tagged"
createdAt: "2026-05-17T10:00:00.000Z"
updatedAt: "2026-05-17T10:00:00.000Z"
spaceId: "01SPACE123"
---

Body`,
    );

    const result = await migrateVaultIfNeeded(root, manifest);
    expect(result.version).toBe(SCHEMA_VERSION);

    const index = JSON.parse(await readText(root, PATHS.index));
    expect(index.notes[0].spaceIds).toBe("01SPACE123");
    expect(index.notes[0].spaceId).toBeUndefined();

    const parsed = parseNote(
      await readText(root, "notes/2026/05/tagged-01HNOTE123.md"),
    );
    expect(parsed.frontmatter.spaceIds).toBe("01SPACE123");
    expect(parsed.body).toBe("Body");
  });
});
