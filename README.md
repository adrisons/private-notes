# private-notes-llm

Local-first private notes with on-device semantic search.

- Notes live as plain Markdown files in a folder you pick on your computer.
- The browser reads and writes that folder directly via the File System Access API. Nothing leaves your device.
- Search is powered by a small multilingual embedding model that runs locally in a Web Worker via [`@huggingface/transformers`](https://github.com/huggingface/transformers.js). No remote API, no login.

## Requirements

- A Chromium-based browser (Chrome, Edge, Brave, Opera, Arc). Firefox and Safari do not yet support the File System Access API.
- Node 20+ for development.

The first time you search, the model (~120 MB quantized, multilingual MiniLM) is downloaded from the Hugging Face CDN and cached in your browser. Every subsequent run is fully offline.

## Why not WebLLM?

A generative LLM does not "index" content: it reads context at inference time. Pushing every note into a context window does not scale and is slow. The right primitive for "search across all my notes" is **vector search** built on embeddings, which is exactly what this app does. WebLLM could later be used on top to draft answers from retrieved chunks, but that is not required for search itself.

## Folder layout

The folder you choose is owned by the app. It is initialized on first use with this structure:

```
<your-folder>/
  .private-notes/
    manifest.json         # vault signature + schema version
    index.json            # array of NoteRecord
  .semantic-index/        # sibling folder, sync-friendly
    manifest.json         # { schemaVersion, modelId, dimensions }
    notes/<noteId>.json   # all chunks for one note + their embeddings
  notes/YYYY/MM/<slug>-<id>.md
  attachments/<noteId>/<sha1>.<ext>
```

Each note is a Markdown file with YAML frontmatter (`id`, `title`, `createdAt`, `updatedAt`).

The semantic index is kept in a separate sibling folder so it can be shared across devices (e.g. via Dropbox). One JSON file per note keeps sync conflicts narrow — two devices editing different notes never write to the same file. If a note's `contentHash` no longer matches the on-disk note, or the active model differs from the one declared in `manifest.json`, those files are re-embedded.

### What is stored per note in the semantic index

```jsonc
{
  "noteId": "01HXXX…",
  "filePath": "notes/2026/05/example-01HXXX.md",
  "contentHash": "sha1 of the note body",
  "modelId": "Xenova/paraphrase-multilingual-MiniLM-L12-v2",
  "dimensions": 384,
  "schemaVersion": 1,
  "updatedAt": "2026-05-17T10:00:00.000Z",
  "chunks": [
    { "idx": 0, "text": "…", "offset": 0, "length": 380, "embedding": [/* unit vector */] }
  ]
}
```

Embeddings of different models are never mixed. Changing the model deletes the index and reindexes everything.

## Scripts

```bash
npm install
npm run dev        # start Vite dev server
npm run test       # run Vitest
npm run typecheck  # tsc --noEmit
npm run build      # production build
```

## Status

Early development. See commit history for incremental milestones.
