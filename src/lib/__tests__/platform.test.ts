import { describe, it, expect, afterEach } from "vitest";
import { formatModKeyShortcut, isMacPlatform, modKeyLabel } from "../platform";

describe("platform", () => {
  const original = navigator.platform;

  afterEach(() => {
    Object.defineProperty(navigator, "platform", {
      value: original,
      configurable: true,
    });
  });

  it("detects macOS platforms", () => {
    Object.defineProperty(navigator, "platform", {
      value: "MacIntel",
      configurable: true,
    });
    expect(isMacPlatform()).toBe(true);
    expect(modKeyLabel()).toBe("⌘");
    expect(formatModKeyShortcut("K")).toBe("⌘K");
  });

  it("detects non-mac platforms", () => {
    Object.defineProperty(navigator, "platform", {
      value: "Win32",
      configurable: true,
    });
    expect(isMacPlatform()).toBe(false);
    expect(modKeyLabel()).toBe("Ctrl");
    expect(formatModKeyShortcut("K")).toBe("Ctrl+K");
  });
});
