import { readText, writeText, fileExists, listFilesRecursive } from "../fs/handle";
import { PATHS, SCHEMA_VERSION, type Manifest, type NoteRecord } from "../fs/schema";
import { buildEmptyIndex } from "../fs/manifest";
import { parseNoteIndex, parseSpacesIndex } from "../fs/validate";
import { parseJson } from "../../lib/validate";
import { ensureSpacesFile, buildEmptySpacesIndex } from "../spaces/storage";
import { migrateLegacySpaceField } from "../../domain";
import { parseNote, serializeNote } from "../../domain/note/frontmatter";

type LegacyNoteRecord = NoteRecord & { spaceId?: string };

function unquote(raw: string): string {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed
      .slice(1, -1)
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }
  return trimmed;
}

/** Read v2 `spaceId` from frontmatter before parseNote stopped accepting it. */
function legacySpaceIdInFrontmatter(text: string): string | undefined {
  const normalized = text.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) return undefined;
  const rest = normalized.slice(4);
  const closeIdx = rest.indexOf("\n---");
  if (closeIdx === -1) return undefined;
  for (const rawLine of rest.slice(0, closeIdx).split("\n")) {
    const line = rawLine.trim();
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    if (line.slice(0, colon).trim() === "spaceId") {
      return unquote(line.slice(colon + 1));
    }
  }
  return undefined;
}

function migrateRecord(record: LegacyNoteRecord): {
  record: NoteRecord;
  changed: boolean;
} {
  if (!record.spaceId) return { record, changed: false };
  const spaceIds = migrateLegacySpaceField(record.spaceIds, record.spaceId);
  const next: NoteRecord = {
    id: record.id,
    title: record.title,
    path: record.path,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
  if (spaceIds) next.spaceIds = spaceIds;
  return { record: next, changed: true };
}

async function migrateSpaceFields(root: FileSystemDirectoryHandle): Promise<void> {
  if (await fileExists(root, PATHS.index)) {
    const text = await readText(root, PATHS.index);
    const index = parseNoteIndex(parseJson(text, PATHS.index), PATHS.index);
    let indexChanged = false;
    const notes = index.notes.map((note) => {
      const { record, changed } = migrateRecord(note as LegacyNoteRecord);
      if (changed) indexChanged = true;
      return record;
    });
    if (indexChanged) {
      await writeText(
        root,
        PATHS.index,
        JSON.stringify({ ...index, notes, version: SCHEMA_VERSION }, null, 2),
      );
    }
  }

  const files = (await listFilesRecursive(root, PATHS.notes)).filter((path) =>
    path.endsWith(".md"),
  );
  for (const path of files) {
    const text = await readText(root, path);
    const legacySpaceId = legacySpaceIdInFrontmatter(text);
    if (!legacySpaceId) continue;
    try {
      const parsed = parseNote(text);
      const spaceIds = migrateLegacySpaceField(
        parsed.frontmatter.spaceIds,
        legacySpaceId,
      );
      const nextFrontmatter = {
        id: parsed.frontmatter.id,
        title: parsed.frontmatter.title,
        createdAt: parsed.frontmatter.createdAt,
        updatedAt: parsed.frontmatter.updatedAt,
        ...(spaceIds ? { spaceIds } : null),
      };
      await writeText(root, path, serializeNote(nextFrontmatter, parsed.body));
    } catch {
      // Unparseable note — index migration still applies; file stays as-is.
    }
  }
}

async function migrateSpaceTimestamps(
  root: FileSystemDirectoryHandle,
  migrationTime: string,
): Promise<void> {
  if (!(await fileExists(root, PATHS.spaces))) return;
  const text = await readText(root, PATHS.spaces);
  const index = parseSpacesIndex(parseJson(text, PATHS.spaces), PATHS.spaces);
  let changed = false;
  const spaces = index.spaces.map((space) => {
    if (space.createdAt && space.updatedAt) return space;
    changed = true;
    return {
      ...space,
      createdAt: space.createdAt ?? migrationTime,
      updatedAt: space.updatedAt ?? migrationTime,
    };
  });
  if (!changed && index.version >= SCHEMA_VERSION) return;
  await writeText(
    root,
    PATHS.spaces,
    JSON.stringify({ version: SCHEMA_VERSION, spaces }, null, 2),
  );
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

/**
 * Upgrade an older vault to the current schema. Idempotent when already at
 * SCHEMA_VERSION.
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

  if (current.version === 1) {
    await bumpIndexVersion(root);
    current = {
      ...current,
      version: 2,
    };
    await writeText(root, PATHS.manifest, JSON.stringify(current, null, 2));
  }

  if (current.version === 2) {
    await migrateSpaceFields(root);
    await bumpIndexVersion(root);
    current = {
      ...current,
      version: 3,
    };
    await writeText(root, PATHS.manifest, JSON.stringify(current, null, 2));
  }

  if (current.version === 3) {
    const migrationTime = new Date().toISOString();
    await migrateSpaceTimestamps(root, migrationTime);
    await bumpSpacesVersion(root);
    current = {
      ...current,
      version: SCHEMA_VERSION,
    };
    await writeText(root, PATHS.manifest, JSON.stringify(current, null, 2));
  }

  return current;
}
