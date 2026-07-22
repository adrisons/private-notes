/// <reference lib="webworker" />
import { precacheAndRoute } from "workbox-precaching";
import { clientsClaim } from "workbox-core";

/**
 * The installable PWA shell service worker (ADR-012). Built with the
 * `injectManifest` strategy: Vite bundles this file with esbuild and injects
 * the precache list into `self.__WB_MANIFEST`.
 *
 * It precaches only the built app shell (HTML/CSS/JS/icons/fonts). Note content
 * lives on disk, off-origin, and the embedding model weights are cached at
 * runtime by the browser HTTP cache — neither is precached or transmitted here.
 */
export {};

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

precacheAndRoute(self.__WB_MANIFEST);

// `registerType: "autoUpdate"` on the client pairs with taking control as soon
// as a new worker is installed, so a reload after deploy serves fresh assets.
self.skipWaiting();
clientsClaim();
