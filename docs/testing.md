# Testing strategy

Phase 1 uses **Vitest** only (no Playwright). End-to-end browser tests are deferred to a later phase.

## Pyramid

| Layer | Location | What to test |
|-------|----------|--------------|
| Unit | `src/lib/**/__tests__/` | Pure logic: FS helpers, notes, search, markdown |
| Component | `src/screens/__tests__/`, `src/ui/*.test.tsx` | UI behaviour with mocked props |
| Integration | `src/App.integration.test.tsx` | Vault boot, CRUD, autosave, command palette search |

Prefer testing the **public surface** of `lib/` modules. Do not load `@huggingface/transformers` or the embedder worker in unit tests.

## Commands

```bash
pnpm test              # run all tests once
pnpm test:watch        # watch mode
pnpm test:coverage     # HTML + text coverage report in coverage/
pnpm typecheck
pnpm lint              # for UI changes
```

Coverage is **report-only** (no enforced thresholds yet).

## Test doubles

| Concern | Double | Module |
|---------|--------|--------|
| File system | `makeFakeRoot()`, `makeFakeRootWithPermissions()` | `src/test/fakeFs.ts` |
| IndexedDB | `fake-indexeddb/auto` import at top of test file | — |
| Embedder | `FakeEmbedder` | `src/lib/search/embedder.ts` |
| App integration | `renderApp()`, `seedVault()` | `src/test/appHarness.tsx` |

### `fakeFs`

In-memory `FileSystemDirectoryHandle` for vault I/O. Good enough for paths, nested directories, read/write, and `entries()`.

`makeFakeRootWithPermissions()` adds `queryPermission` / `requestPermission` stubs. **Do not** attach functions to handles you persist in IndexedDB — structured clone cannot serialize them. Integration tests mock `src/lib/fs/permissions` instead.

### `FakeEmbedder`

Deterministic bag-of-words hashing embedder for indexer/search tests. Production uses `TransformersEmbedder` in a Web Worker.

### App integration harness

`App.tsx` evaluates `getCompatibility()` at import time. Integration tests must:

1. Register `vi.mock("./lib/compatibility", …)` before importing `App`.
2. Mock `transformers-embedder` with a `FakeEmbedder` subclass that implements `ready()`.
3. Mock `permissions` to avoid FS permission prompts.
4. Stub `showDirectoryPicker` to return `makeFakeRoot()`.
5. Mock `editor/Editor` as a `<textarea>` to avoid TipTap in integration tests.

Use `vi.useFakeTimers()` when exercising the 500 ms autosave debounce ([ADR-007](./adr/007-autosave-eventual-reindex.md)). Pair with `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })` and call `advanceAutosave()` from the harness. Always run `cleanupIntegrationTest()` in `afterEach` (does not call `vi.restoreAllMocks()` — that would reset module mocks).

## CI

GitHub Actions runs `pnpm typecheck`, `pnpm test`, and `pnpm lint` on push/PR (see `.github/workflows/ci.yml`).

## Conventions

- Co-locate tests in `__tests__/` next to the module; name files `*.test.ts(x)`.
- Import `fake-indexeddb/auto` in any test that touches `vault-handle-store`.
- Cover new behaviour with at least one test.
- Keep `src/App.test.tsx` for the unsupported-browser path (no compatibility mock).

## Out of scope (Phase 1)

- Playwright / real Chromium e2e
- `transformers-embedder.ts` and `embedder.worker.ts` (use mocks at boundaries)
- Full TipTap editor interaction tests

See [architecture.md](./architecture.md) for system flows and [ADR index](./README.md) for behavioural decisions.
