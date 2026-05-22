# Engineering documentation

Architecture decisions and system design for **private-notes**. User-facing setup and folder layout live in the [root README](../README.md).

## Start here

1. **[architecture.md](./architecture.md)** — system map, flows, module index (~10 min).
2. Pick ADRs for the area you are changing (see table below).

## Architecture Decision Records (ADR)

| ADR | Topic | Read when you change… |
|-----|--------|------------------------|
| [000](./adr/000-documentation.md) | How we write ADRs | Adding or superseding a decision |
| [001](./adr/001-local-first-vault.md) | Local-first vault (FSA) | `src/lib/fs/*`, vault boot, permissions |
| [002](./adr/002-note-storage-format.md) | Markdown notes + JSON index | `src/lib/notes/*`, frontmatter, paths |
| [003](./adr/003-semantic-search-embeddings.md) | Embeddings & embedder | `src/lib/search/embedder*`, worker, chunking |
| [004](./adr/004-semantic-index-persistence.md) | Semantic index & vector search | `src/lib/search/index*`, `search.ts` |
| [005](./adr/005-markdown-editor.md) | TipTap editor | `src/editor/*`, `src/lib/markdown/*` |
| [006](./adr/006-attachments-cache.md) | Attachments & blob cache | `src/lib/attachments/*` |
| [007](./adr/007-autosave-eventual-reindex.md) | Autosave & eventual reindex | `src/App.tsx`, debounced persist |
| [008](./adr/008-schema-compatibility.md) | Schema & compatibility | `types.ts`, manifest validation, `compatibility.ts` |

## Suggested reading order by task

| Task | ADRs |
|------|------|
| New on-disk format or migration | 002, 008, 004 |
| Search quality or model change | 003, 004, 008 |
| Editor / markdown features | 005, 002 |
| Images in notes | 006, 005 |
| Save / sync / data loss | 007, 002, 004 |
