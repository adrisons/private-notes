#!/usr/bin/env node
/**
 * Rebuild `.private-notes/` metadata for a folder that already contains
 * note markdown under `notes/` but is missing (or lost) vault signature files.
 *
 * Use when the app refuses to open with "not a private-notes vault" because
 * note files exist without `.private-notes/manifest.json`.
 *
 * The on-disk format mirrors the TypeScript sources — keep in sync with
 * `src/infrastructure/fs/repair-vault.ts` (the in-app repair path).
 *
 * Space names cannot be recovered from note files alone; placeholder names
 * are written and should be renamed in the app after open.
 *
 * Usage:
 *   node scripts/repair-vault.mjs --out ~/Documents/recetas
 *   pnpm repair:vault -- --out ~/Documents/recetas --dry-run
 */
import { mkdir, readdir, readFile, writeFile, access } from "node:fs/promises";
import { join, relative, dirname } from "node:path";

const APP_SIGNATURE = "private-notes";
const SCHEMA_VERSION = 1;
const ATTACHMENT_REFS_VERSION = 1;
const SPACE_COLOR_IDS = ["blue", "green", "amber", "red", "purple"];
const ATTACHMENT_PATH_RE = /!\[[^\]]*\]\((attachments\/[^)]+)\)/g;

function parseArgs(argv) {
  const args = { out: null, dryRun: false, force: false };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    const val = argv[i + 1];
    if (key === "--out") (args.out = val), i++;
    else if (key === "--dry-run") args.dryRun = true;
    else if (key === "--force") args.force = true;
  }
  return args;
}

function unquote(raw) {
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

function parseNote(text) {
  const normalized = text.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) {
    throw new Error("Missing frontmatter opening delimiter.");
  }
  const rest = normalized.slice(4);
  const closeIdx = rest.indexOf("\n---");
  if (closeIdx === -1) {
    throw new Error("Missing frontmatter closing delimiter.");
  }
  const header = rest.slice(0, closeIdx);
  const body = rest
    .slice(closeIdx + 4)
    .replace(/^\n+/, "")
    .replace(/\n+$/, "");

  const data = {};
  for (const rawLine of header.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const colon = line.indexOf(":");
    if (colon === -1) throw new Error(`Invalid frontmatter line: ${line}`);
    const key = line.slice(0, colon).trim();
    const value = unquote(line.slice(colon + 1));
    if (
      key === "id" ||
      key === "title" ||
      key === "createdAt" ||
      key === "updatedAt" ||
      key === "spaceIds"
    ) {
      data[key] = value;
    }
  }
  for (const k of ["id", "title", "createdAt", "updatedAt"]) {
    if (typeof data[k] !== "string") {
      throw new Error(`Missing required frontmatter field: ${k}`);
    }
  }
  return { frontmatter: data, body };
}

function parseSpaceIds(raw) {
  if (!raw || raw.trim().length === 0) return [];
  const ids = [];
  for (const part of raw.split(",")) {
    const id = part.trim();
    if (id.length === 0 || ids.includes(id)) continue;
    ids.push(id);
  }
  return ids;
}

function dedupeRecordsById(records) {
  const byId = new Map();
  for (const record of records) {
    const existing = byId.get(record.id);
    if (!existing || record.updatedAt > existing.updatedAt) {
      byId.set(record.id, record);
    }
  }
  return [...byId.values()];
}

function extractAttachmentPaths(markdown) {
  const paths = new Set();
  for (const match of markdown.matchAll(ATTACHMENT_PATH_RE)) {
    paths.add(match[1]);
  }
  return paths;
}

async function walkMarkdownFiles(dir, baseDir, out) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkMarkdownFiles(abs, baseDir, out);
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      out.push(relative(baseDir, abs).split("\\").join("/"));
    }
  }
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function writeJson(path, value, dryRun) {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  if (dryRun) return;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.out) {
    console.error(
      "Usage: node scripts/repair-vault.mjs --out <vault-dir> [--dry-run] [--force]",
    );
    process.exit(1);
  }

  const root = args.out;
  const metaDir = join(root, ".private-notes");
  const manifestPath = join(metaDir, "manifest.json");
  const notesDir = join(root, "notes");

  if (!(await pathExists(notesDir))) {
    console.error(`No notes/ directory under ${root}`);
    process.exit(1);
  }

  if ((await pathExists(manifestPath)) && !args.force) {
    console.error(
      `Manifest already exists at ${manifestPath}. Use --force to overwrite metadata.`,
    );
    process.exit(1);
  }

  const paths = [];
  await walkMarkdownFiles(notesDir, root, paths);
  paths.sort();

  const records = [];
  const skipped = [];
  const spaceFirstSeen = new Map();
  const attachmentRefs = {};

  for (const path of paths) {
    const relPath = path.startsWith("notes/") ? path : `notes/${path}`;
    try {
      const text = await readFile(join(root, relPath), "utf8");
      const { frontmatter, body } = parseNote(text);
      const record = {
        id: frontmatter.id,
        title: frontmatter.title,
        path: relPath,
        createdAt: frontmatter.createdAt,
        updatedAt: frontmatter.updatedAt,
      };
      if (frontmatter.spaceIds) {
        record.spaceIds = frontmatter.spaceIds;
        for (const spaceId of parseSpaceIds(frontmatter.spaceIds)) {
          if (!spaceFirstSeen.has(spaceId)) {
            spaceFirstSeen.set(spaceId, frontmatter.updatedAt);
          }
        }
      }
      records.push(record);
      for (const attachmentPath of extractAttachmentPaths(body)) {
        const noteIds = attachmentRefs[attachmentPath] ?? [];
        if (!noteIds.includes(frontmatter.id)) {
          attachmentRefs[attachmentPath] = [...noteIds, frontmatter.id];
        }
      }
    } catch (err) {
      skipped.push({ path: relPath, reason: err.message });
    }
  }

  const notes = dedupeRecordsById(records);
  const duplicateCount = records.length - notes.length;

  const spaceIds = [...spaceFirstSeen.keys()].sort();
  const now = new Date().toISOString();
  const spaces = spaceIds.map((id, index) => ({
    id,
    name: `Recovered space ${index + 1}`,
    colorId: SPACE_COLOR_IDS[index % SPACE_COLOR_IDS.length],
    createdAt: spaceFirstSeen.get(id) ?? now,
    updatedAt: spaceFirstSeen.get(id) ?? now,
  }));

  const manifest = {
    app: APP_SIGNATURE,
    version: SCHEMA_VERSION,
    createdAt: now,
  };
  const index = { version: SCHEMA_VERSION, notes };
  const spacesIndex = { version: SCHEMA_VERSION, spaces };
  const refsIndex = { version: ATTACHMENT_REFS_VERSION, refs: attachmentRefs };

  if (args.dryRun) {
    console.log(`[dry-run] Would repair vault at ${root}`);
    console.log(`  notes indexed: ${notes.length}`);
    console.log(`  duplicates dropped: ${duplicateCount}`);
    console.log(`  skipped files: ${skipped.length}`);
    console.log(`  spaces recovered (placeholder names): ${spaces.length}`);
    console.log(`  attachment refs: ${Object.keys(attachmentRefs).length}`);
    if (skipped.length > 0) {
      console.log("\nSkipped:");
      for (const item of skipped) {
        console.log(`  ${item.path}: ${item.reason}`);
      }
    }
    return;
  }

  await mkdir(metaDir, { recursive: true });
  await mkdir(join(root, "attachments"), { recursive: true });
  await writeJson(manifestPath, manifest, false);
  await writeJson(join(metaDir, "index.json"), index, false);
  await writeJson(join(metaDir, "spaces.json"), spacesIndex, false);
  await writeJson(join(metaDir, "attachment-refs.json"), refsIndex, false);

  console.log(`Repaired vault at ${root}`);
  console.log(`  notes indexed: ${notes.length}`);
  console.log(`  duplicates dropped: ${duplicateCount}`);
  console.log(`  skipped files: ${skipped.length}`);
  console.log(`  spaces recovered (rename in app): ${spaces.length}`);
  console.log(`  attachment refs: ${Object.keys(attachmentRefs).length}`);
  if (spaces.length > 0) {
    console.log(
      "\nSpace names were placeholders — open the vault and rename them.",
    );
  }
  if (skipped.length > 0) {
    console.log("\nSkipped:");
    for (const item of skipped) {
      console.log(`  ${item.path}: ${item.reason}`);
    }
  }
  console.log("\nOpen this folder in private-notes to reconcile and reindex.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
