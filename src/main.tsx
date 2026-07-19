import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { App } from "./App";
import { applyTheme, readStoredTheme } from "./lib/theme";

// Apply the stored theme before React mounts to avoid a flash of the
// system theme on hard reloads.
applyTheme(readStoredTheme(), { animate: false });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
