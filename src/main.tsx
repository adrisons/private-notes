import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { App } from "./App";
import { applyTheme, readStoredTheme } from "./lib/theme";
import { registerServiceWorker } from "./infrastructure/platform/web/pwa/register-sw";

// Apply the stored theme before React mounts to avoid a flash of the
// system theme on hard reloads.
applyTheme(readStoredTheme(), { animate: false });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Install the PWA shell service worker in production (ADR-012). No-op in dev.
registerServiceWorker();
