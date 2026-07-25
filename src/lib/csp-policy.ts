/**
 * Content-Security-Policy shared by `vite.config.ts` (build-time `<meta>`) and
 * `public/_headers` (hosting response header). Re-verify `connect-src` and
 * `script-src` after upgrading `@huggingface/transformers` or changing the
 * embedding model: cold-cache `pnpm build && pnpm preview`, open a vault, and
 * inspect the network panel.
 *
 * Observed chain (2026-07-25, Xenova/multilingual-e5-small, transformers 3.8.x):
 * - `https://huggingface.co/.../resolve/main/...` — tokenizer, config, ONNX manifest
 * - `https://huggingface.co/api/resolve-cache/...` — HF resolve-cache API
 * - `https://us.aws.cdn.hf.co/xet-bridge-us/...` — Xet LFS redirect targets
 * - `https://cdn.jsdelivr.net/npm/@huggingface/transformers@…/dist/ort-wasm-*`
 *   — onnxruntime WASM backend (`env.backends.onnx.wasm.wasmPaths`)
 */

/** Directives common to the meta tag and the hosting header. */
const CORE_DIRECTIVES = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
] as const;

/** Inserted only in the real response header (`frame-ancestors` is ignored in `<meta>`). */
const FRAME_ANCESTORS = "frame-ancestors 'none'" as const;

const APP_DIRECTIVES = [
  "form-action 'self'",
  "img-src 'self' blob: data:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'wasm-unsafe-eval' https://cdn.jsdelivr.net",
  "worker-src 'self' blob:",
  "connect-src 'self' https://huggingface.co https://*.aws.cdn.hf.co https://cdn.jsdelivr.net",
] as const;

/** CSP injected into the built `index.html` (no `frame-ancestors`). */
export const CSP_META = [...CORE_DIRECTIVES, ...APP_DIRECTIVES].join("; ");

/** CSP line for `public/_headers` (includes `frame-ancestors`). */
export const CSP_HEADER = [
  ...CORE_DIRECTIVES,
  FRAME_ANCESTORS,
  ...APP_DIRECTIVES,
].join("; ");
