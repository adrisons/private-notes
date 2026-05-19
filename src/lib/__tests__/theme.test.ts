import { describe, it, expect, beforeEach } from "vitest";
import {
  applyTheme,
  persistTheme,
  readStoredTheme,
  THEME_STORAGE_KEY,
} from "../theme";

describe("theme manager", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
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
});
