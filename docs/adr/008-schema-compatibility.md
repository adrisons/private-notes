# ADR-008: Schema versioning and compatibility policy

- **Status:** Accepted
- **Date:** 2026-05-19
- **Updated:** 2026-07-20

## Context

- On-disk data outlives any single app build; users may open the same folder with an older or newer version.
- The vault and semantic index evolve independently ([ADR-002](./002-note-storage-format.md), [ADR-004](./004-semantic-index-persistence.md)).
- The browser must expose APIs the app depends on ([ADR-001](./001-local-first-vault.md)).
- The app ships vault schema **v1** as the canonical on-disk format. There is no migration history before v1.

## Decision

### Vault schema (`.private-notes/`)

- Constant `SCHEMA_VERSION` in `src/infrastructure/fs/schema.ts` (currently `1`).
- `validateManifestJson`:
  - Wrong `app` signature → incompatible.
  - `version > SCHEMA_VERSION` → **refuse to open** (“written by a newer app”).
  - `version <= SCHEMA_VERSION` → compatible (forward-compatible reads).
- On open, `migrateVaultIfNeeded` in `src/infrastructure/fs/migrate.ts` upgrades vaults below the current version. Idempotent when already at `SCHEMA_VERSION`. Each bump adds an explicit step in that module plus an ADR update.
- Bumping `SCHEMA_VERSION` is a **breaking change** for older app builds — requires migration tooling and documentation before release.

### Semantic index schema (`.semantic-index/`)

- Constant `SEMANTIC_SCHEMA_VERSION` in `src/infrastructure/search/types.ts` (currently `1`).
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
- Older vault versions can be upgraded on open once migration steps exist.
- Older apps can still read older vault versions until a breaking bump they cannot parse.

### Negative

- Newer vault without migration blocks older builds entirely.
- Full semantic reindex after model or schema changes can take time.

### Neutral

- Semantic schema can be rebuilt from Markdown; vault data cannot be inferred from the index alone.

## References

- [ADR-000](./000-documentation.md) — how to document future schema bumps
- Code: `src/infrastructure/fs/manifest.ts`, `src/infrastructure/fs/migrate.ts`, `src/infrastructure/fs/schema.ts`, `src/infrastructure/search/types.ts`, `src/infrastructure/search/indexer.ts`, `src/lib/compatibility.ts`
