# System architecture

High-level map of **private-notes**: a browser app that reads and writes a folder on disk, edits Markdown notes, and runs semantic search locally.

For **why** each choice was made, see the linked ADRs in [docs/README.md](./README.md).

## Context diagram

```mermaid
flowchart TB
  User[User]
  Browser[Chromium browser]
  VaultFolder["Vault folder on disk"]
  Worker[Embedder Web Worker]
  HFCDN["Hugging Face CDN\n(first model download only)"]

  User --> Browser
  Browser -->|File System Access API| VaultFolder
  Browser --> Worker
  Worker -.->|model weights once| HFCDN
  Worker -->|writes embeddings| VaultFolder
```

**Privacy:** note content and attachments never leave the device except the optional one-time download of the embedding model.

## On-disk layout (summary)

```
<vault>/
  .private-notes/          # app metadata (ADR-002, ADR-008)
    manifest.json
    index.json
    attachment-refs.json   # note ids per attachment path (ADR-006)
  .semantic-index/         # vector index (ADR-004)
    manifest.json
    notes/<noteId>.json
  notes/YYYY/MM/          # Markdown + YAML frontmatter
  attachments/<sha256>.<ext>   # content-addressed, globally deduplicated (ADR-006)
```

Details: [ADR-002](./adr/002-note-storage-format.md), [ADR-004](./adr/004-semantic-index-persistence.md).

## Schema versions

| Store | Constant | File | On mismatch |
|-------|----------|------|-------------|
| Vault | `SCHEMA_VERSION` | `.private-notes/manifest.json` | Refuse open if newer than app ([ADR-008](./adr/008-schema-compatibility.md)) |
| Semantic index | `SEMANTIC_SCHEMA_VERSION` | `.semantic-index/manifest.json` | Wipe index and re-embed |

## Module map

| Concern | Source | ADR |
|---------|--------|-----|
| Domain model | `src/domain/` | [009](./adr/009-layered-application-architecture.md) |
| Application ports, session, hooks | `src/application/` | [009](./adr/009-layered-application-architecture.md) |
| Infrastructure adapters | `src/infrastructure/` (wraps `src/lib/` I/O) | [009](./adr/009-layered-application-architecture.md) |
| Boot, vault open, picker (I/O) | `src/lib/fs/`, adapters in `src/infrastructure/fs/` | [001](./adr/001-local-first-vault.md) |
| Note CRUD, frontmatter (I/O) | `src/lib/notes/`, `src/infrastructure/notes/` | [002](./adr/002-note-storage-format.md) |
| Embedder, chunking, worker | `src/lib/search/`, `src/workers/` | [003](./adr/003-semantic-search-embeddings.md) |
| Index I/O, search, reindex | `src/lib/search/`, `src/infrastructure/search/` | [004](./adr/004-semantic-index-persistence.md) |
| Editor UI | `src/editor/` | [005](./adr/005-markdown-editor.md) |
| MD parse/serialize | `src/lib/markdown/` | [005](./adr/005-markdown-editor.md) |
| Attachments + cache | `src/lib/attachments/`, `src/infrastructure/attachments/` | [006](./adr/006-attachments-cache.md) |
| Autosave, orchestration | `src/application/hooks/`, thin `src/App.tsx` | [007](./adr/007-autosave-eventual-reindex.md), [009](./adr/009-layered-application-architecture.md) |
| Sidebar search, index status | `src/screens/SidebarSearch.tsx`, `IndexStatus.tsx`, `src/lib/search/index-progress.ts` | [007](./adr/007-autosave-eventual-reindex.md) |
| Command palette search | `src/screens/CommandPalette.tsx` | [003](./adr/003-semantic-search-embeddings.md), [004](./adr/004-semantic-index-persistence.md) |
| Browser gate | `src/lib/compatibility.ts` | [001](./adr/001-local-first-vault.md), [008](./adr/008-schema-compatibility.md) |

## Flow: open vault

```mermaid
sequenceDiagram
  participant App
  participant Compat as compatibility
  participant IDB as IndexedDB handle store
  participant FSA as File System Access API

  App->>Compat: getCompatibility()
  alt unsupported
    App-->>User: Unsupported screen
  else supported
    App->>IDB: loadVaultHandle()
    alt handle + permission OK
      App->>FSA: openOrInitialize(root)
      App->>App: AttachmentURLCache, listNotes
    else no handle
      App-->>User: Welcome → pickFolder()
    end
  end
```

See [ADR-001](./adr/001-local-first-vault.md).

## Flow: edit and save

```mermaid
sequenceDiagram
  participant User
  participant Editor as TipTap Editor
  participant App
  participant Disk as vault files
  participant Index as semantic indexer

  User->>Editor: type
  Editor->>App: onChange(markdown)
  App->>App: setState (immediate UI)
  App->>App: debounce 500ms
  App->>Disk: updateNote
  App->>Index: reindex([note]) background
```

See [ADR-005](./adr/005-markdown-editor.md), [ADR-007](./adr/007-autosave-eventual-reindex.md).

## Flow: semantic search

```mermaid
flowchart LR
  Q[Query string] --> E[Embed query in worker]
  E --> S[Stream note JSON files]
  S --> D[Dot product per chunk]
  D --> T[Top-K hits + snippets]
```

- **Indexing:** chunk body → embed batches → write `.semantic-index/notes/<id>.json`.
- **Invalidation:** `contentHash`, schema version, model id/dimensions ([ADR-004](./adr/004-semantic-index-persistence.md)).
- **Embed layers:** `indexer` / `search` call the `Embedder` interface; `TransformersEmbedder` forwards inference to the worker; chunking, disk I/O, and scoring stay on the main thread. See [semantic-search-primer.md](./semantic-search-primer.md).

## Flow: full reindex

Triggered when the vault opens (embedder ready) or manually from **All indexed** in the sidebar (`IndexStatus` → `ActionDialog`):

1. `pruneOrphans` — remove embedding files for deleted notes.
2. `reindex` — for each note, skip if `contentHash` and metadata still match; else re-embed.

Progress is shown as a percentage under the sidebar search trigger; when complete, **All indexed** opens a short explanation and a **Reindex** action.

Incremental reindex on save only processes the saved note ([ADR-007](./adr/007-autosave-eventual-reindex.md)).

## Sidebar search

`SidebarSearch` opens the command palette (click or **⌘K** / **Ctrl+K**). `IndexStatus` below it surfaces index state:

- **Loading model…** — embedder not ready yet.
- **Indexing N%** — full reindex in progress.
- **All indexed** — clickable; opens `ActionDialog` with context and manual reindex.

Semantic search itself runs inside `CommandPalette`, not inline in the sidebar.

## Command palette

`CommandPalette` combines:

- **Semantic hits** when the embedder is ready and the query is non-empty.
- **Lexical fallback** — title substring match on the note list when semantic search returns nothing useful.

## Code splitting

Heavy pieces load after vault open to keep the initial bundle small:

- `Editor` — `React.lazy` in `App.tsx`
- Search API — `loadSearchApi()` in `src/lib/search/runtime.ts`
- Embedding model — Web Worker + transformers.js ([ADR-003](./adr/003-semantic-search-embeddings.md))

## Testing hooks

| Component | Test double |
|-----------|-------------|
| File system | `src/test/fakeFs.ts` (`makeFakeRoot`, `makeFakeRootWithPermissions`) |
| Embedder | `FakeEmbedder` in `src/lib/search/embedder.ts` |
| App integration | `src/test/appHarness.tsx` (`renderApp`, `seedVault`, `waitForSearchReady`) |

Full strategy: [testing.md](./testing.md).

## Related documents

- [ADR index](./README.md)
- [Semantic search primer](./semantic-search-primer.md) — embeddings, cosine similarity, worker vs main thread
- [User README](../README.md)
