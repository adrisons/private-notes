# private-notes

Local-first private notes with on-device semantic search.

Your notes are plain Markdown files in a folder you pick. Nothing leaves your
device — not the text, not the search index, not a single analytics ping. The
browser reads and writes that folder directly, and search runs on your own
machine. No account, no server, no sync you did not ask for.

## Contents

- [Why private-notes](#why-private-notes)
- [Features](#features)
- [Requirements](#requirements)
- [How search works](#how-search-works)
- [Folder layout](#folder-layout)
- [Scripts](#scripts)
- [Architecture & decisions](#architecture--decisions)
- [Status](#status)

## Why private-notes

Three properties that shape every decision in this app:

- **Private by construction.** The only network call the app ever makes is the
  one-time download of the embedding model. Your note content has no path to
  the network — no backend, no telemetry, no login. Privacy is not a setting
  you have to trust; it is the shape of the code.
- **Local-first, files you own.** The Markdown on disk is the source of truth.
  Indexes and caches are derived from it, so the app can rebuild itself from
  your files at any time. Point another editor at the same folder, back it up,
  or sync it through Dropbox — the notes are just files, and they are yours.
- **Fast and light.** Search answers as you type: a warm keyword index, cached
  across keystrokes, fused with on-device embeddings. The note list is
  virtualized and stays smooth at thousands of notes, saves happen on a
  debounce, and reindexing runs in the background so writing never stalls.

## Features

- **Semantic search that understands meaning.** A small multilingual model
  finds notes by concept, so you can search for what you meant, not just the
  words you typed.
- **Keyword search that stays exact.** A BM25-shaped inverted index makes sure
  precise terms and short queries still land, fused with meaning into one
  ranked list.
- **Titles and spaces feed search too.** Rename a note and it is searchable at
  once; type "africa" and everything filed under that space surfaces, even when
  the word never appears in the text.
- **Spaces to group your notes.** Custom collections like *Trips*, *Recipes* or
  *Work* keep things organized without folders full of files to babysit.
- **A Markdown editor that writes clean files.** A TipTap editor produces
  standard Markdown with YAML frontmatter — what you see is exactly what lands
  on disk, readable in any other tool.
- **Attachments without waste.** Images are stored content-addressed and
  deduplicated, so pasting the same picture twice writes it once.
- **Instant, optimistic UI.** Notes autosave and re-index in the background,
  and the interface answers immediately while you keep writing.
- **Accent- and case-insensitive matching.** With light Spanish inflection
  folding, so *pescados* finds *pescado*.
- **Works fully offline.** After the first model download, every search runs
  with no network at all.
- **A vault that migrates forward.** The on-disk format is versioned, so
  existing notes stay safe across updates.

## Requirements

- A Chromium-based browser (Chrome, Edge, Brave, Opera, Arc). Firefox and Safari do not yet support the File System Access API.
- Node 20+ for development.

The first time you search, the model (~120 MB quantized, `Xenova/multilingual-e5-small`, 384-dim) is downloaded from the Hugging Face CDN and cached in your browser. Every subsequent run is fully offline.

## How search works

Search is **hybrid** and produces a single ranked list, never two lists stapled together:

- **Meaning (dense).** Your query is embedded in the worker and compared to note
  embeddings by cosine similarity. The model is asymmetric-retrieval tuned, with
  `query:` / `passage:` prefixes.
- **Keywords (lexical).** An inverted index with BM25-shaped scoring catches
  exact terms and short queries. It is cached across keystrokes, so warm queries
  are several times faster than the first one.
- **Fusion.** Both are combined with Reciprocal Rank Fusion, then title and
  space signals from the in-memory note list are layered on top — so a title or
  space match answers even before the index is ready.

Matching is accent- and case-insensitive with light Spanish inflection folding, so *pescados* finds *pescado*.

## Folder layout

The folder you choose is owned by the app. It is initialized on first use with this structure:

```
<your-folder>/
  .private-notes/
    manifest.json         # vault signature + schema version
    index.json            # array of NoteRecord
    spaces.json           # custom space definitions
    attachment-refs.json  # note ids per attachment path (ADR-006)
  .semantic-index/        # sibling folder, sync-friendly
    manifest.json         # { schemaVersion, modelId, dimensions }
    content-hashes.json   # noteId → contentHash hint for a cheap reindex scan (ADR-011)
    notes/<noteId>.json   # all chunks for one note + their embeddings
  notes/YYYY/MM/<slug>-<id>.md
  attachments/<sha256>.<ext>
```

Each note is a Markdown file with YAML frontmatter (`id`, `title`, `createdAt`, `updatedAt`).

The semantic index is kept in a separate sibling folder so it can be shared across devices (e.g. via Dropbox). One JSON file per note keeps sync conflicts narrow — two devices editing different notes never write to the same file. If a note's `contentHash` no longer matches the on-disk note, or the active model differs from the one declared in `manifest.json`, those files are re-embedded.

### What is stored per note in the semantic index

```jsonc
{
  "noteId": "01HXXX…",
  "filePath": "notes/2026/05/example-01HXXX.md",
  "contentHash": "sha256 of the note title + body",
  "modelId": "Xenova/multilingual-e5-small",
  "dimensions": 384,
  "schemaVersion": 2,
  "updatedAt": "2026-05-17T10:00:00.000Z",
  "chunks": [
    { "idx": -1, "kind": "title", "text": "…", "offset": 0, "length": 0, "embedding": [/* unit vector */] },
    { "idx": 0, "kind": "body", "text": "…", "offset": 0, "length": 380, "embedding": [/* unit vector */] }
  ]
}
```

Embeddings of different models are never mixed. Changing the model deletes the index and reindexes everything. Because `contentHash` covers the title, renaming a note re-embeds it.

## Scripts

```bash
pnpm install
pnpm dev            # start Vite dev server
pnpm build          # production build (tsc -b && vite build)
pnpm test           # run Vitest (general + integration + relevance)
pnpm typecheck      # tsc -b --noEmit
pnpm lint           # eslint
pnpm check          # typecheck → lint → test
pnpm bench          # performance benchmarks (not a pass/fail gate)
pnpm gen:vault      # generate a sample vault for local testing
pnpm repair:vault   # rebuild vault metadata from the Markdown on disk
```

This repo pins the package manager via the `packageManager` field in `package.json`. Use [pnpm](https://pnpm.io/) (Corepack: `corepack enable`).

## Architecture & decisions

Engineering docs (architecture overview and ADRs): **[docs/README.md](./docs/README.md)**.

## Status

Pre-1.0 and under active development, but usable day to day: creating, editing
and autosaving notes, organizing them into spaces, pasting images, and hybrid
search all work. The on-disk format is versioned and migrates forward
([ADR-008](./docs/adr/008-schema-compatibility.md)), so existing vaults stay
safe across updates — a model or schema change just triggers a one-time reindex
on open. Known performance and correctness work is tracked in
[TODO.md](./TODO.md).
