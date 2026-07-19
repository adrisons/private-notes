import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  applyTheme,
  persistTheme,
  readStoredTheme,
  THEME_STORAGE_KEY,
  THEME_TRANSITION_MS,
} from "../theme";

describe("theme manager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-theme-transition");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("defaults to 'system' when nothing is stored", () => {
    expect(readStoredTheme()).toBe("system");
  });

  it("'system' clears the data-theme attribute", () => {
    document.documentElement.setAttribute("data-theme", "dark");
    applyTheme("system");
    expect(document.documentElement.getAttribute("data-theme")).toBeNull();
  });

  it("light/dark set the data-theme attribute and persist", () => {
    persistTheme("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(readStoredTheme()).toBe("dark");

    persistTheme("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(readStoredTheme()).toBe("light");
  });

  it("persisting 'system' clears storage and attribute", () => {
    persistTheme("dark");
    persistTheme("system");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(document.documentElement.getAttribute("data-theme")).toBeNull();
  });

  it("animates theme changes unless explicitly disabled", () => {
    applyTheme("dark", { animate: false });
    expect(
      document.documentElement.getAttribute("data-theme-transition"),
    ).toBeNull();

    applyTheme("light");
    expect(
      document.documentElement.getAttribute("data-theme-transition"),
    ).not.toBeNull();

    vi.advanceTimersByTime(THEME_TRANSITION_MS);
    expect(
      document.documentElement.getAttribute("data-theme-transition"),
    ).toBeNull();
  });
});
