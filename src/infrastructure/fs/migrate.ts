import { readText, writeText, fileExists } from "../fs/handle";
import { PATHS, SCHEMA_VERSION, type Manifest } from "../fs/schema";
import { buildEmptyIndex } from "../fs/manifest";
import { parseNoteIndex, parseSpacesIndex } from "../fs/validate";
import { parseJson } from "../../lib/validate";
import {
  buildEmptySpacesIndex,
  ensureSpacesFile,
} from "../spaces/storage";

async function bumpIndexVersion(root: FileSystemDirectoryHandle): Promise<void> {
  if (!(await fileExists(root, PATHS.index))) {
    await writeText(
      root,
      PATHS.index,
      JSON.stringify(buildEmptyIndex(), null, 2),
    );
    return;
  }
  const text = await readText(root, PATHS.index);
  const index = parseNoteIndex(parseJson(text, PATHS.index), PATHS.index);
  if (index.version < SCHEMA_VERSION) {
    await writeText(
      root,
      PATHS.index,
      JSON.stringify({ ...index, version: SCHEMA_VERSION }, null, 2),
    );
  }
}

async function bumpSpacesVersion(root: FileSystemDirectoryHandle): Promise<void> {
  if (!(await fileExists(root, PATHS.spaces))) {
    await writeText(
      root,
      PATHS.spaces,
      JSON.stringify(buildEmptySpacesIndex(), null, 2),
    );
    return;
  }
  const text = await readText(root, PATHS.spaces);
  const index = parseSpacesIndex(parseJson(text, PATHS.spaces), PATHS.spaces);
  if (index.version < SCHEMA_VERSION) {
    await writeText(
      root,
      PATHS.spaces,
      JSON.stringify({ ...index, version: SCHEMA_VERSION }, null, 2),
    );
  }
}

/**
 * Upgrade an older vault to the current schema. Idempotent when already at
 * SCHEMA_VERSION. Add explicit `if (current.version === N)` steps when bumping
 * SCHEMA_VERSION — there is no legacy history before v1.
 */
export async function migrateVaultIfNeeded(
  root: FileSystemDirectoryHandle,
  manifest: Manifest,
): Promise<Manifest> {
  await ensureSpacesFile(root);

  if (manifest.version >= SCHEMA_VERSION) {
    return manifest;
  }

  let current = manifest;

  // Future bumps: migrate data here, then advance `current.version` stepwise.

  await bumpIndexVersion(root);
  await bumpSpacesVersion(root);
  current = {
    ...current,
    version: SCHEMA_VERSION,
  };
  await writeText(root, PATHS.manifest, JSON.stringify(current, null, 2));

  return current;
}
