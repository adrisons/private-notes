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

  describe("with View Transitions available", () => {
    /**
     * The compositor cross-fade replaces the CSS one — arming the fallback
     * rule as well would repaint every element for nothing.
     */
    function stubViewTransition(ready: Promise<void>, finished: Promise<void>) {
      const start = vi.fn((update: () => void) => {
        update();
        return { ready, finished, updateCallbackDone: Promise.resolve() };
      });
      Object.defineProperty(document, "startViewTransition", {
        value: start,
        configurable: true,
        writable: true,
      });
      return start;
    }

    afterEach(() => {
      Reflect.deleteProperty(document, "startViewTransition");
    });

    it("routes the swap through startViewTransition, not the CSS fallback", () => {
      const start = stubViewTransition(
        Promise.resolve(),
        Promise.resolve(),
      );

      applyTheme("dark");

      expect(start).toHaveBeenCalledTimes(1);
      expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
      expect(
        document.documentElement.getAttribute("data-theme-transition"),
      ).toBeNull();
    });

    it("swallows rejections from a superseded or aborted transition", async () => {
      // A repeat click rejects both promises; unhandled, they reach the console.
      stubViewTransition(
        Promise.reject(new Error("skipped")),
        Promise.reject(new Error("aborted")),
      );

      expect(() => applyTheme("light")).not.toThrow();
      expect(document.documentElement.getAttribute("data-theme")).toBe("light");

      vi.useRealTimers();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    it("skips the transition entirely when animate is false", () => {
      const start = stubViewTransition(
        Promise.resolve(),
        Promise.resolve(),
      );

      applyTheme("dark", { animate: false });

      expect(start).not.toHaveBeenCalled();
      expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    });
  });
});
