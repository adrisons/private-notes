/**
 * Three-state theme manager: "light" / "dark" / "system".
 *
 * - Persists to localStorage under PRIVATE_NOTES_THEME_KEY.
 * - Applies via a `data-theme` attribute on <html> that the CSS variables
 *   pick up (see styles.css).
 * - "system" removes the attribute, letting `prefers-color-scheme` win.
 *
 * The cross-fade runs through the View Transitions API where available: the
 * browser snapshots the page either side of the token swap and blends the two
 * on the compositor, so the cost is flat no matter how much is on screen.
 * The CSS fallback (`data-theme-transition`) is deliberately narrow — see the
 * note above that rule in styles.css.
 */
export type Theme = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "private-notes:theme";

/** Must stay in sync with `--duration-normal` in design-tokens.css. */
export const THEME_TRANSITION_MS = 220;

const THEME_TRANSITION_ATTR = "data-theme-transition";

let themeTransitionTimer: ReturnType<typeof setTimeout> | undefined;

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Fallback cross-fade: arm the CSS rule for one beat, then disarm. */
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

function setThemeAttribute(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
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
  if (options?.animate === false || prefersReducedMotion()) {
    setThemeAttribute(theme);
    return;
  }

  const startViewTransition =
    document.startViewTransition?.bind(document) ?? undefined;

  if (startViewTransition) {
    const transition = startViewTransition(() => setThemeAttribute(theme));
    // Both promises reject when a transition is superseded by a repeat click,
    // or aborted because the document is not being rendered (background tab).
    // The theme still applies in every case, so neither is actionable — but an
    // unhandled rejection would surface as a console error.
    transition.ready.catch(() => {});
    transition.finished.catch(() => {});
    return;
  }

  beginThemeTransition();
  setThemeAttribute(theme);
}

/**
 * Animate when the OS palette changes while theme is set to "system".
 *
 * This one cannot use a view transition: the media query has already resolved
 * by the time `change` fires, so there is no old state left to snapshot. The
 * CSS fallback is what runs here — rare enough that its cost does not matter.
 */
export function subscribeSystemThemeChanges(): () => void {
  if (typeof window.matchMedia !== "function") return () => {};
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => {
    if (readStoredTheme() === "system" && !prefersReducedMotion()) {
      beginThemeTransition();
    }
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
