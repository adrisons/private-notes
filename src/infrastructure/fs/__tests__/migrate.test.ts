import { describe, it, expect } from "vitest";
import { makeFakeRoot } from "../../../test/fakeFs";
import { writeText, readText } from "../handle";
import { PATHS, SCHEMA_VERSION } from "../schema";
import { buildManifest } from "../manifest";
import { migrateVaultIfNeeded } from "../migrate";

describe("migrateVaultIfNeeded", () => {
  it("is a no-op when the vault is already at the current schema", async () => {
    const root = makeFakeRoot();
    const manifest = buildManifest(new Date("2026-05-17T10:00:00Z"));

    await writeText(root, PATHS.manifest, JSON.stringify(manifest, null, 2));
    await writeText(
      root,
      PATHS.index,
      JSON.stringify({ version: SCHEMA_VERSION, notes: [] }, null, 2),
    );
    await writeText(
      root,
      PATHS.spaces,
      JSON.stringify({ version: SCHEMA_VERSION, spaces: [] }, null, 2),
    );

    const result = await migrateVaultIfNeeded(root, manifest);
    expect(result.version).toBe(SCHEMA_VERSION);
    expect(JSON.parse(await readText(root, PATHS.manifest)).version).toBe(
      SCHEMA_VERSION,
    );
  });

  it("creates spaces.json when missing on an otherwise valid v1 vault", async () => {
    const root = makeFakeRoot();
    const manifest = buildManifest();

    await writeText(root, PATHS.manifest, JSON.stringify(manifest, null, 2));
    await writeText(
      root,
      PATHS.index,
      JSON.stringify({ version: SCHEMA_VERSION, notes: [] }, null, 2),
    );

    await migrateVaultIfNeeded(root, manifest);

    const spaces = JSON.parse(await readText(root, PATHS.spaces));
    expect(spaces.version).toBe(SCHEMA_VERSION);
    expect(spaces.spaces).toEqual([]);
  });
});
