/// <reference types="vitest" />
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { CSP_META } from "./src/lib/csp-policy";

/**
 * Content-Security-Policy for the production build. Directives live in
 * `src/lib/csp-policy.ts` and are mirrored in `public/_headers`; a unit test
 * asserts they stay in sync. Injected as a `<meta>` only into the built
 * `index.html` — the dev server needs inline scripts, `eval`, and a websocket
 * for HMR, so applying it there would break `pnpm dev`.
 */
const CSP = CSP_META;

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

/**
 * Installable PWA shell (ADR-012). Uses the `injectManifest` strategy so the
 * worker (src/infrastructure/platform/web/pwa/sw.ts) is bundled by esbuild;
 * this avoids the flaky terser worker race in workbox's `generateSW` template.
 *
 * The worker precaches only the built app shell (HTML/CSS/JS/icons/fonts) —
 * never note content (it lives on disk, off-origin) and never the embedding
 * model weights (cached at runtime by the HTTP cache). Registration is manual
 * via `platform/web/pwa/register-sw.ts`, so `injectRegister` is off.
 */
function pwa(): Plugin[] {
  return VitePWA({
    strategies: "injectManifest",
    srcDir: "src/infrastructure/platform/web/pwa",
    filename: "sw.ts",
    registerType: "autoUpdate",
    injectRegister: null,
    includeAssets: ["favicon.svg", "apple-touch-icon.png"],
    manifest: {
      name: "private-notes",
      short_name: "private-notes",
      description:
        "Local-first private notes with on-device semantic search.",
      start_url: "/",
      scope: "/",
      display: "standalone",
      theme_color: "#d2542f",
      background_color: "#fbfaf8",
      icons: [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
        {
          src: "/icons/icon-maskable-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ],
    },
    injectManifest: {
      globPatterns: ["**/*.{js,css,html,svg,png,ico,woff,woff2}"],
      // Files above this are left to the browser HTTP cache and loaded on
      // demand (e.g. large onnxruntime wasm), keeping the precache lean.
      maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
    },
  }) as Plugin[];
}

/**
 * Cross-origin isolation headers. `crossOriginIsolated` gates SharedArrayBuffer,
 * which onnxruntime-web needs to run the embedder on multiple WASM threads — the
 * biggest single lever on indexing time. These are real HTTP headers (COOP/COEP
 * cannot be expressed in a <meta> tag like the CSP is), so the dev and preview
 * servers set them here to match `public/_headers` in production. `require-corp`
 * makes cross-origin subresources need CORP or CORS; allowed egress is the
 * Hugging Face model download (often via `*.aws.cdn.hf.co`) and the onnxruntime
 * WASM backend on jsDelivr — see `src/lib/csp-policy.ts`. Vault attachments are
 * same-origin blob: URLs.
 */
const crossOriginIsolation = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), ...pwa(), cspMeta()],
  server: { headers: crossOriginIsolation },
  preview: { headers: crossOriginIsolation },
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
