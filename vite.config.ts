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
    // Use forks so each worker is a real Node process; jsdom provides
    // localStorage (Node's own Web Storage API stays off without
    // --experimental-webstorage, so there is nothing to shadow).
    pool: "forks",
    css: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.d.ts", "src/test/**", "src/workers/**"],
    },
    // Performance/load benchmarks (`pnpm bench`). Kept out of the unit run;
    // `*.bench.ts` files never match the default `test.include` globs.
    benchmark: {
      include: ["src/**/*.bench.ts"],
    },
  },
});
