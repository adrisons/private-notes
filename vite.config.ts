/// <reference types="vitest" />
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * Content-Security-Policy for the production build. Keep this in sync with
 * `public/_headers` (the hosting-level header, which is the authoritative
 * delivery mechanism). It is injected as a <meta> only into the built
 * `index.html`; the dev server needs inline scripts, `eval`, and a websocket
 * for HMR, so applying it there would break `pnpm dev`.
 *
 * - `script-src 'wasm-unsafe-eval'`: onnxruntime-web (via transformers.js)
 *   compiles the embedding model to WebAssembly.
 * - `worker-src blob:`: the threaded WASM backend spawns workers from blobs.
 * - `connect-src` Hugging Face: one-time model weight download; files resolve
 *   to `cdn-lfs*.huggingface.co`.
 * - `img-src blob:`: attachment images are served as blob URLs from the vault.
 */
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  "img-src 'self' blob: data:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "worker-src 'self' blob:",
  "connect-src 'self' https://huggingface.co https://*.huggingface.co",
].join("; ");

/** Inject the CSP meta tag into the built HTML only (not the dev server). */
function cspMeta(): Plugin {
  return {
    name: "csp-meta",
    apply: "build",
    transformIndexHtml(html) {
      return html.replace(
        "</title>",
        `</title>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      );
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), cspMeta()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("@tiptap") || id.includes("prosemirror-")) {
            return "editor";
          }
          if (id.includes("marked")) return "markdown";
          if (
            id.includes("/react-dom/") ||
            id.includes("/react/") ||
            id.includes("scheduler/")
          ) {
            return "react";
          }
        },
      },
    },
    // The embedder worker bundles transformers.js (~877 kB minified).
    chunkSizeWarningLimit: 900,
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // Use forks so each worker is a real Node process. Node 22+ may expose a
    // broken global localStorage getter; vitest.setup.ts wires jsdom's storage.
    pool: "forks",
    css: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.d.ts", "src/test/**", "src/workers/**"],
    },
    // The suite is split into named projects so each kind can run (and be
    // cached) on its own in CI, while sharing the single config above via
    // `extends: true`. Selection is by filename convention:
    //   *.integration.test.*  → cross-module / App-level flows (`test:integration`)
    //   *.relevance.test.*     → the search-ranking regression net (`test:relevance`)
    //   everything else *.test.* → fast unit tests (`test:general`)
    //   *.bench.ts             → performance/load benchmarks (`pnpm bench`)
    // `vitest run` runs the three test projects; `vitest bench` runs `bench`.
    // Each test project pins `benchmark.include: []` so a `*.bench.ts` file is
    // owned only by the `bench` project (otherwise Vitest's default benchmark
    // glob would tag benchmarks with an arbitrary test project's name).
    projects: [
      {
        extends: true,
        test: {
          name: "general",
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: [
            "src/**/*.integration.test.{ts,tsx}",
            "src/**/*.relevance.test.{ts,tsx}",
          ],
          benchmark: { include: [] },
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["src/**/*.integration.test.{ts,tsx}"],
          benchmark: { include: [] },
        },
      },
      {
        extends: true,
        test: {
          name: "relevance",
          include: ["src/**/*.relevance.test.{ts,tsx}"],
          benchmark: { include: [] },
        },
      },
      {
        extends: true,
        test: {
          name: "bench",
          // Benchmarks only: no unit tests, so `vitest run` skips this project
          // and only `vitest bench` exercises it.
          include: [],
          benchmark: { include: ["src/**/*.bench.ts"] },
        },
      },
    ],
  },
});
