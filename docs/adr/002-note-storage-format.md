# ADR-002: Plain Markdown notes + JSON index

- **Status:** Accepted
- **Date:** 2026-05-19

## Context

- Notes must remain **portable and human-readable** outside the app.
- We need fast listing and metadata without scanning the whole tree on every UI update.
- Frontmatter should stay simple — no full YAML parser dependency for four string fields.

## Decision

1. **Each note is a `.md` file** with a small YAML frontmatter block (`id`, `title`, `createdAt`, `updatedAt`) parsed/serialized manually in `frontmatter.ts`.
2. **Paths are stable:** `notes/YYYY/MM/<slug>-<id>.md`. Title changes update frontmatter and index only — the file path does not move (`path.ts`).
3. **Central index:** `.private-notes/index.json` holds `NoteRecord[]` for listing; the filesystem is the source of truth for body content.
4. **Vault manifest:** `.private-notes/manifest.json` with app signature `private-notes` and `SCHEMA_VERSION` ([ADR-008](./008-schema-compatibility.md)).
5. **Safe delete:** remove entry from index first, then delete the file (and attachment folder as applicable).
6. **IDs:** opaque string ids (see `src/lib/notes/id.ts`) embedded in the filename.

## Consequences

### Positive

- Users can edit notes in any editor; only frontmatter conventions matter.
- Index makes the sidebar O(n) over records, not O(files) walks.

### Negative

- Index and files can theoretically diverge if edited externally without updating `index.json`.
- No rich YAML types (tags, nested metadata) without a format change.

### Neutral

- Markdown body excludes frontmatter; semantic indexing hashes the body only.

## Diagram

```mermaid
flowchart LR
  Index[".private-notes/index.json"]
  NoteFile["notes/YYYY/MM/slug-id.md"]
  Index -->|path| NoteFile
  NoteFile -->|frontmatter + body| App[App / Editor]
```

## References

- [CommonMark](https://commonmark.org/)
- [YAML specification](https://yaml.org/spec/) (we only use a constrained subset by hand)
- Code: `src/lib/notes/storage.ts`, `frontmatter.ts`, `path.ts`, `src/lib/fs/types.ts`
