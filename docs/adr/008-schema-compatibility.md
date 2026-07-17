# ADR-008: Schema versioning and compatibility policy

- **Status:** Accepted
- **Date:** 2026-05-19
- **Updated:** 2026-07-17

## Context

- On-disk data outlives any single app build; users may open the same folder with an older or newer version.
- The vault and semantic index evolve independently ([ADR-002](./002-note-storage-format.md), [ADR-004](./004-semantic-index-persistence.md)).
- The browser must expose APIs the app depends on ([ADR-001](./001-local-first-vault.md)).

## Decision

### Vault schema (`.private-notes/`)

- Constant `SCHEMA_VERSION` in `src/lib/fs/types.ts` (currently `1`).
- `validateManifestJson`:
  - Wrong `app` signature → incompatible.
  - `version > SCHEMA_VERSION` → **refuse to open** (“written by a newer app”).
  - `version <= SCHEMA_VERSION` → compatible (forward-compatible reads).
- Bumping `SCHEMA_VERSION` is a **breaking change** — requires migration tooling or explicit refusal (comment in `types.ts`).

### Semantic index schema (`.semantic-index/`)

- Constant `SEMANTIC_SCHEMA_VERSION` in `src/lib/search/types.ts` (currently `1`).
- Per-note and manifest `schemaVersion` must match; otherwise re-embed.
- **Model change** (`modelId` / `dimensions`): `clearSemanticIndex` wipes all per-note JSON, then new manifest — **never mix embeddings from different models**.
- During search, mismatched records are **skipped** until reindex updates them.

### Browser compatibility (`compatibility.ts`)

| Capability | Required | Purpose |
|------------|----------|---------|
| File System Access API | Yes | Vault I/O |
| Web Workers | Yes | Embedding inference |
| `SubtleCrypto.digest` | Yes | SHA-256 content hashes |
| WebGPU | No | Optional; WASM fallback |

## Consequences

### Positive

- Clear failure modes instead of corrupting user data silently.
- Older apps can still read older vault versions until a breaking bump.

### Negative

- Newer vault without migration blocks older builds entirely.
- Full semantic reindex after model or schema changes can take time.

### Neutral

- Semantic schema can be rebuilt from Markdown; vault data cannot be inferred from the index alone.

## References

- [ADR-000](./000-documentation.md) — how to document future schema bumps
- Code: `src/lib/fs/manifest.ts`, `src/lib/fs/types.ts`, `src/lib/search/types.ts`, `src/lib/search/indexer.ts`, `src/lib/compatibility.ts`
