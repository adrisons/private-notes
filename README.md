# private-notes-llm

Local-first private notes with on-device semantic search.

- Notes live as plain Markdown files in a folder you pick on your computer.
- The browser reads and writes that folder directly via the File System Access API. Nothing leaves your device.
- Search is powered by a small multilingual embedding model that runs locally in a Web Worker via [`transformers.js`](https://github.com/huggingface/transformers.js). No remote API, no login.

## Requirements

- A Chromium-based browser (Chrome, Edge, Brave, Opera, Arc). Firefox and Safari do not yet support the File System Access API.
- Node 20+ for development.

## Why not WebLLM?

A generative LLM does not "index" content: it reads context at inference time. Pushing every note into a context window does not scale and is slow. The right primitive for "search across all my notes" is **vector search** built on embeddings, which is exactly what this app does. WebLLM could later be used on top to draft answers from retrieved chunks, but that is not required for search itself.

## Folder layout

The folder you choose is owned by the app. It is initialized on first use with this structure:

```
<your-folder>/
  .private-notes/
    manifest.json
    index.json
    embeddings.bin
    embeddings.meta.json
  notes/YYYY/MM/<slug>-<id>.md
  attachments/<noteId>/<sha1>.<ext>
```

Each note is a Markdown file with YAML frontmatter for metadata (id, title, timestamps).

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
