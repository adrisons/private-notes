/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
    css: true,
    // Node 22+ stubs global localStorage and shadows jsdom; disable it.
    poolOptions: {
      forks: { execArgv: ["--no-webstorage"] },
      threads: { execArgv: ["--no-webstorage"] },
    },
  },
});
