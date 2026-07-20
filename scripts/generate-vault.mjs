#!/usr/bin/env node
/**
 * Generate a real private-notes vault on disk for MANUAL E2E performance
 * measurement. Open the resulting folder in the app (`pnpm dev`) and the vault
 * reindexes with the real embedding model — letting you measure cold start,
 * reindex time, search latency and memory with DevTools at a realistic scale.
 *
 * This deliberately writes only note files + metadata (no embeddings): the app
 * builds the semantic index itself on open, which is exactly what we profile.
 *
 * The on-disk format mirrors the TypeScript sources:
 *   - frontmatter    -> src/domain/note/frontmatter.ts (serializeNote)
 *   - note path       -> src/infrastructure/notes/path.ts (buildNotePath)
 *   - slug            -> src/domain/note/slug.ts (slugify)
 *   - metadata files  -> src/infrastructure/fs/{schema,manifest}.ts
 * Keep them in sync if the vault schema (version 1) changes.
 *
 * Usage:
 *   node scripts/generate-vault.mjs --out ./bench-vault --notes 10000 --chunks 4
 *   pnpm gen:vault -- --out ./bench-vault --notes 5000
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const SCHEMA_VERSION = 1;
const WORDS_PER_CHUNK = 168; // ~ chunk size - overlap (see chunk.ts defaults).
const WORDS =
  "note idea project meeting plan search index vector query chunk memory disk vault semantic model embedding token cache latency bottleneck performance data growth scale user document folder markdown title body tag space attachment image render editor keyboard shortcut palette recent draft archive review release feature bug fix refactor test benchmark report baseline budget regression proyecto reunión idea nota búsqueda índice rendimiento crecimiento datos".split(
    " ",
  );

function parseArgs(argv) {
  const args = { out: null, notes: 1000, chunks: 4, seed: 1 };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    const val = argv[i + 1];
    if (key === "--out") (args.out = val), i++;
    else if (key === "--notes") (args.notes = Number(val)), i++;
    else if (key === "--chunks") (args.chunks = Number(val)), i++;
    else if (key === "--seed") (args.seed = Number(val)), i++;
  }
  return args;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function slugify(title) {
  const stripped = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return stripped.length > 0 ? stripped : "untitled";
}

function quote(value) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function serializeNote(fm, body) {
  const lines = [
    "---",
    `id: ${quote(fm.id)}`,
    `title: ${quote(fm.title)}`,
    `createdAt: ${quote(fm.createdAt)}`,
    `updatedAt: ${quote(fm.updatedAt)}`,
    "---",
    "",
    body.replace(/\s+$/, ""),
    "",
  ];
  return lines.join("\n");
}

function generateBody(rng, targetChunks) {
  const wordCount = Math.max(1, targetChunks) * WORDS_PER_CHUNK;
  const out = [];
  for (let i = 0; i < wordCount; i++) {
    out.push(WORDS[Math.floor(rng() * WORDS.length)]);
    if (i > 0 && i % 12 === 0) out.push(".\n");
  }
  return out.join(" ");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.out || !Number.isFinite(args.notes) || args.notes <= 0) {
    console.error(
      "Usage: node scripts/generate-vault.mjs --out <dir> [--notes N] [--chunks N] [--seed N]",
    );
    process.exit(1);
  }

  const rng = mulberry32(args.seed);
  const createdAt = new Date("2026-01-01T00:00:00.000Z");
  const iso = createdAt.toISOString();
  const year = createdAt.getUTCFullYear().toString();
  const month = String(createdAt.getUTCMonth() + 1).padStart(2, "0");

  await mkdir(join(args.out, ".private-notes"), { recursive: true });
  await mkdir(join(args.out, "attachments"), { recursive: true });

  const records = [];
  for (let i = 0; i < args.notes; i++) {
    const id = `note-${i.toString().padStart(6, "0")}`;
    const title = `Note ${i} ${WORDS[Math.floor(rng() * WORDS.length)]}`;
    const body = generateBody(rng, args.chunks);
    const path = `notes/${year}/${month}/${slugify(title)}-${id}.md`;
    const abs = join(args.out, path);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, serializeNote({ id, title, createdAt: iso, updatedAt: iso }, body));
    records.push({ id, title, path, createdAt: iso, updatedAt: iso });
    if ((i + 1) % 1000 === 0) console.log(`  ...${i + 1}/${args.notes} notes`);
  }

  const meta = join(args.out, ".private-notes");
  await writeFile(
    join(meta, "manifest.json"),
    JSON.stringify({ app: "private-notes", version: SCHEMA_VERSION, createdAt: iso }, null, 2),
  );
  await writeFile(
    join(meta, "index.json"),
    JSON.stringify({ version: SCHEMA_VERSION, notes: records }, null, 2),
  );
  await writeFile(
    join(meta, "spaces.json"),
    JSON.stringify({ version: SCHEMA_VERSION, spaces: [] }, null, 2),
  );
  await writeFile(
    join(meta, "attachment-refs.json"),
    JSON.stringify({ version: 1, refs: {} }, null, 2),
  );

  console.log(
    `Generated ${args.notes} notes (~${args.chunks} chunks each) in ${args.out}`,
  );
  console.log("Open this folder in the app to profile reindex + search.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
