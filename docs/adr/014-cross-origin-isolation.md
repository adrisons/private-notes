# ADR-014: Cross-origin isolation for threaded WASM inference

- **Status:** Accepted
- **Date:** 2026-07-22

## Context

Indexing time is dominated by embedding inference, which runs as WebAssembly in
the embedder worker ([ADR-003](./003-semantic-search-embeddings.md)). onnxruntime-web
can run that WASM on several threads, but only when the page is
**cross-origin isolated** — `crossOriginIsolated === true`, which the browser
grants only when SharedArrayBuffer is available. Without it, onnxruntime falls
back to a single thread regardless of `navigator.hardwareConcurrency`.

`public/_headers` already sent `Cross-Origin-Opener-Policy: same-origin` but
not `Cross-Origin-Embedder-Policy`, so `crossOriginIsolated` was false and every
reindex ran single-threaded — the largest single lever on indexing time left on
the table.

## Decision

Set the cross-origin isolation pair in every environment:

- **Production:** add `Cross-Origin-Embedder-Policy: require-corp` alongside the
  existing COOP in [public/_headers](../../public/_headers) (the authoritative
  hosting-level response headers).
- **Dev / preview:** set both COOP and COEP via `server.headers` /
  `preview.headers` in [vite.config.ts](../../vite.config.ts), so
  `crossOriginIsolated` holds locally too. COOP/COEP are HTTP headers and
  **cannot** be expressed in the CSP `<meta>` tag the way the CSP is, so they do
  not go through the `cspMeta` plugin.

`require-corp` means every cross-origin subresource must opt in with CORP or be
fetched with CORS. Allowed egress (see [csp-policy.ts](../../src/lib/csp-policy.ts)):
the one-time Hugging Face model download — which often redirects to
`*.aws.cdn.hf.co` — and the onnxruntime WASM backend on jsDelivr, both fetched
with CORS. Vault attachments are same-origin `blob:` URLs and are unaffected. The worker is
same-origin. No application code changes — onnxruntime detects isolation and
threads on its own.

## Consequences

### Positive

- Reindexing runs multi-threaded on Chromium desktop, the biggest lever on
  indexing throughput, with no new dependency and no code in the hot path.
- Isolation holds in dev and preview, so the threaded path is exercised locally
  and not only in production.

### Negative

- `require-corp` is strict: any *future* cross-origin resource must send CORP or
  be requested with CORS, or it will be blocked. This is a deliberate trade —
  the app is single-origin by design (AGENTS.md §1), so the surface is small.
- One more header pair to keep in sync between `public/_headers` and
  `vite.config.ts`, next to the CSP that already carries that caveat
  ([ADR-012](./012-pwa-installable-shell.md)).

### Neutral

- Chromium-only by design (AGENTS.md §1), so `credentialless` COEP (a laxer
  variant) buys nothing here; `require-corp` is the stricter, well-supported
  choice.
- Threads still require `SharedArrayBuffer`; a browser that refuses isolation
  simply keeps the single-threaded path, so this is a speedup, not a gate.

## References

- [ADR-003](./003-semantic-search-embeddings.md) — embeddings, worker, WASM inference
- [ADR-012](./012-pwa-installable-shell.md) — CSP authored in `_headers` + `vite.config.ts`
- [Cross-origin isolation (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Window/crossOriginIsolated)
- [COEP (MDN)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Embedder-Policy)
- Code: `public/_headers`, `vite.config.ts`, `src/workers/embedder.worker.ts`
