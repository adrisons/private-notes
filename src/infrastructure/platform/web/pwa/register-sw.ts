/**
 * Service-worker registration for the installable PWA shell (ADR-012).
 *
 * `vite-plugin-pwa` generates and injects the worker at build time and exposes
 * `virtual:pwa-register` to wire it up. In dev (and in tests) that virtual
 * module is absent, so registration is a no-op — the app runs identically
 * without a worker. The worker precaches only the built shell; it never touches
 * note content or the embedding model weights.
 */
export function registerServiceWorker(): void {
  if (import.meta.env?.DEV) return;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }
  // Dynamic import so bundlers that lack the virtual module (dev, vitest) do
  // not fail to resolve it. `autoUpdate` handles refresh on new deploys.
  import("virtual:pwa-register")
    .then(({ registerSW }) => {
      registerSW({ immediate: true });
    })
    .catch(() => {
      // No plugin-provided worker in this environment; nothing to register.
    });
}
