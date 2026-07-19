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

/** Must stay in sync with `--duration-slow` in design-tokens.css. */
export const THEME_TRANSITION_MS = 320;

const THEME_TRANSITION_ATTR = "data-theme-transition";

let themeTransitionTimer: ReturnType<typeof setTimeout> | undefined;

function beginThemeTransition(): void {
  const root = document.documentElement;
  root.setAttribute(THEME_TRANSITION_ATTR, "");
  if (themeTransitionTimer !== undefined) {
    clearTimeout(themeTransitionTimer);
  }
  themeTransitionTimer = setTimeout(() => {
    root.removeAttribute(THEME_TRANSITION_ATTR);
    themeTransitionTimer = undefined;
  }, THEME_TRANSITION_MS);
}

export interface ApplyThemeOptions {
  /** When false, skip the cross-fade (e.g. before first paint). */
  animate?: boolean;
}

export function readStoredTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(theme: Theme, options?: ApplyThemeOptions): void {
  if (options?.animate !== false) beginThemeTransition();
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

/** Animate when the OS palette changes while theme is set to "system". */
export function subscribeSystemThemeChanges(): () => void {
  if (typeof window.matchMedia !== "function") return () => {};
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => {
    if (readStoredTheme() === "system") beginThemeTransition();
  };
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
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
