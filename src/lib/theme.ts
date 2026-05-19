/**
 * Three-state theme manager: "light" / "dark" / "system".
 *
 * - Persists to localStorage under PRIVATE_NOTES_THEME_KEY.
 * - Applies via a `data-theme` attribute on <html> that the CSS variables
 *   pick up (see styles.css).
 * - "system" removes the attribute, letting `prefers-color-scheme` win.
 */
export type Theme = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "private-notes:theme";

export function readStoredTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

export function persistTheme(theme: Theme): void {
  try {
    if (theme === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* private mode — ignore */
  }
  applyTheme(theme);
}
