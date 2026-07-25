# ADR-012: PWA installable shell

- **Status:** Accepted
- **Date:** 2026-07-22

## Context

The app is a static single-page bundle served over HTTPS (Cloudflare). Users
want to launch it like an installed app — an icon in the dock / taskbar / app
list and a standalone window — on desktop and on Android, without a store.

The app already runs entirely on the device ([ADR-001](./001-local-first-vault.md)):
markdown on disk via the File System Access API, embeddings in a Web Worker.
Nothing about installation changes that model; it only adds a manifest, an
installable shell, and an offline-capable app skeleton.

Two hard constraints from [AGENTS.md](../../AGENTS.md) shape the design:

1. **No telemetry, no note content over the network.** The service worker may
   cache the app shell, but must never cache or transmit note content.
2. **One library per concern.** PWA glue is `vite-plugin-pwa`; no second build
   plugin or runtime caching library.

## Decision

### Manifest and icons

- The manifest is declared in `vite.config.ts` and emitted by the plugin as
  `manifest.webmanifest`: `name`, `short_name`, `start_url: "/"`,
  `display: "standalone"`, `theme_color` / `background_color` taken from the
  design tokens (paper canvas + coral accent).
- PNG icons under `public/icons/` at 192 and 512, plus a maskable variant, are
  required for Android install prompts; the existing `favicon.svg` stays for the
  browser tab.
- `index.html` links the manifest and sets `theme-color`, `mobile-web-app-capable`,
  and the remaining Apple `apple-mobile-web-app-*` / `apple-touch-icon` meta. iOS
  is not a supported runtime (see below), but the tags are harmless and keep the
  head complete.

### Service worker

- `vite-plugin-pwa` with `registerType: "autoUpdate"` and the `injectManifest`
  strategy. We own the worker source
  (`infrastructure/platform/web/pwa/sw.ts`); Vite bundles it with esbuild and
  injects the precache manifest. `injectManifest` is chosen over `generateSW`
  because the latter minifies its generated worker with a terser worker pool
  that races on process exit under Rollup 4, making the build flaky.
- The worker precaches **only the built app shell** (HTML, JS/CSS chunks,
  fonts, icons) via `precacheAndRoute(self.__WB_MANIFEST)`, then `skipWaiting()`
  + `clientsClaim()` so a reload after deploy serves fresh assets.
- Files above `maximumFileSizeToCacheInBytes` (e.g. the ~21 MB onnxruntime
  wasm) are left to the browser HTTP cache and loaded on demand, keeping the
  precache lean.
- The worker **does not** cache note content (the vault lives on disk, outside
  the origin) and **does not** cache the embedding model weights — those are
  already cached by transformers.js / the browser HTTP cache
  ([ADR-003](./003-semantic-search-embeddings.md)). Runtime caching for the
  Hugging Face CDN is deliberately omitted.
- SW registration lives in the web platform layer
  (`infrastructure/platform/web/pwa/register-sw.ts`), so no PWA concern leaks
  into `application/` or `domain/`.

### Content-Security-Policy

The CSP is authored twice and must stay in sync ([vite.config.ts](../../vite.config.ts)
meta injection and [public/_headers](../../public/_headers) response header).
The service worker is same-origin and needs no CSP change beyond the existing
`worker-src 'self' blob:`; `manifest-src` falls back to `default-src 'self'`.

### Supported platforms

| Platform | Install | Vault (FSA) |
|----------|---------|-------------|
| Chromium desktop (Chrome, Edge, Brave, Opera, Arc) | PWA install | Yes |
| Chrome on Android | PWA install | Yes |
| iOS Safari / Firefox (any OS) | n/a | No — see [ADR-013](./013-vault-storage-port.md) |

Installability is gated by the browser; **usability** is gated by the File
System Access API. A browser that can install the PWA but lacks FSA (iOS,
Firefox) still shows the `Unsupported` screen. The distinction is documented so
we never imply iOS support in store-like copy.

## Consequences

### Positive

- One distribution channel (a URL) yields an installable app on desktop and
  Android, with no App Store / Play Store fees.
- The shell loads offline after first visit; a returning user with a granted
  vault permission reaches their notes without network.
- PWA code is confined to the web platform layer; the rest of the app is
  unaware it is installed.

### Negative

- A second source of truth for the shell cache (the SW) can serve stale assets;
  `autoUpdate` mitigates this but adds an update-on-reload cycle.
- New dependencies: `vite-plugin-pwa` plus the workbox pieces the injected
  worker imports (`workbox-precaching`, `workbox-core`) and `workbox-window`
  for registration (justified here per AGENTS.md §3).

### Neutral

- iOS users can still "Add to Home Screen", but the app will report
  `Unsupported` until a non-FSA storage backend exists ([ADR-013](./013-vault-storage-port.md)).

## References

- [Progressive Web Apps (MDN)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [Web App Manifest (MDN)](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/)
- Related: [ADR-001](./001-local-first-vault.md), [ADR-008](./008-schema-compatibility.md), [ADR-013](./013-vault-storage-port.md)
- Code: `vite.config.ts` (manifest + `injectManifest`), `index.html`,
  `src/infrastructure/platform/web/pwa/{sw,register-sw}.ts`,
  `src/application/hooks/useInstallPrompt.ts`, `public/icons/`
