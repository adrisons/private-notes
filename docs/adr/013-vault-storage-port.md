# ADR-013: Vault storage port and web platform isolation

- **Status:** Accepted
- **Date:** 2026-07-22

## Context

[ADR-001](./001-local-first-vault.md) binds the app to the File System Access
API: `FileSystemDirectoryHandle` is threaded through the application ports,
`VaultSession`, and every infrastructure repository. That coupling has two
costs:

1. **It hardcodes one backend.** The moment a second backend is wanted — OPFS
   for iOS/Firefox, or a native filesystem — the handle type leaks everywhere.
2. **It blurs the layer boundary.** [ADR-009](./009-layered-application-architecture.md)
   keeps application logic backend-agnostic, but a browser type in the port
   signatures contradicts that.

We are shipping a PWA for Chromium desktop and Chrome Android
([ADR-012](./012-pwa-installable-shell.md)). iOS Safari and Firefox lack the
directory picker and stay unsupported for now. We still want the seam that lets
a future OPFS backend slot in without touching `domain/` or `use-cases/`.

## Decision

### `VaultStorage` port

A backend-agnostic file I/O port at
`src/application/ports/vault-storage.ts`, expressed in POSIX-relative paths and
plain data — no browser or native types:

```ts
interface VaultStorage {
  readText(path): Promise<string>;
  writeText(path, text): Promise<void>;
  writeBytes(path, data): Promise<void>;
  fileExists(path): Promise<boolean>;
  removeFile(path): Promise<void>;
  listFilesRecursive(dirPath): Promise<string[]>;
  isEffectivelyEmpty(): Promise<boolean>;
}
```

The current FSA helpers in `infrastructure/fs/handle.ts` become the
implementation detail of a single adapter, `FsaVaultStorage`, which binds a
`FileSystemDirectoryHandle` once and exposes the port.

### Platform isolation directory

Web-specific adapters move under `src/infrastructure/platform/web/`:

```
infrastructure/platform/web/
  fsa-vault-storage.ts     # FileSystemDirectoryHandle -> VaultStorage
  web-infrastructure.ts    # bundles the web adapters for composition
  pwa/register-sw.ts       # service-worker registration ([ADR-012](./012-pwa-installable-shell.md))
```

`application/composition/` remains the only place allowed to import a platform
adapter. A future `platform/opfs/` (iOS/Firefox) or native backend adds a
sibling folder implementing the same port; nothing above composition changes.

### Scope of this ADR

- **In scope now:** the `VaultStorage` port, the `FsaVaultStorage` adapter, the
  `platform/web/` folder, and SW registration wiring. The abstraction is added
  additively so the existing repositories keep working and the test baseline
  stays green.
- **Out of scope now (follow-up):** migrating every repository to consume
  `VaultStorage` instead of the raw handle, and extracting a `vault-layout/`
  module. This is a mechanical, backend-neutral refactor with no user-facing
  effect and is safe to land incrementally after the PWA
  ([ADR-012](./012-pwa-installable-shell.md)).
- **Explicitly not planned:** Capacitor / native wrappers and App Store / Play
  Store distribution. iOS support, if it returns, is an OPFS backend behind this
  same port, documented in a new ADR.

### Relationship to ADR-001

ADR-001 stays accepted: the vault is still markdown on disk via FSA, and the
compatibility gate still requires the directory picker. This ADR narrows its
"Chromium-only" phrasing to "Chromium desktop and Chrome Android" and records
that the backend is now reachable through a port rather than a hardcoded handle.

## Consequences

### Positive

- One clear seam (`VaultStorage`) for a second backend; `domain/` and
  `use-cases/` never learn which platform is underneath.
- PWA/service-worker code is quarantined in `platform/web/`.
- No behavioural change and no test churn for the additive step.

### Negative

- Until the follow-up repository migration lands, two access styles coexist:
  the new port and the direct handle helpers. The boundary is documented to
  avoid new direct-handle usage in fresh code.

### Neutral

- iOS/Firefox remain unsupported; the port makes adding OPFS a localized change
  rather than a cross-cutting one.

## References

- [File System Access API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API)
- [Origin Private File System (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system)
- Related: [ADR-001](./001-local-first-vault.md), [ADR-009](./009-layered-application-architecture.md), [ADR-012](./012-pwa-installable-shell.md)
- Code: `src/application/ports/vault-storage.ts`,
  `src/infrastructure/platform/web/`, `src/application/composition/index.ts`
