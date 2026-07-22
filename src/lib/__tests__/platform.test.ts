import { describe, it, expect, afterEach } from "vitest";
import {
  formatModKeyShortcut,
  isAndroidPlatform,
  isIOSPlatform,
  isMacPlatform,
  modKeyLabel,
} from "../platform";

function setNavigator(props: {
  platform?: string;
  userAgent?: string;
  maxTouchPoints?: number;
}): void {
  for (const [key, value] of Object.entries(props)) {
    Object.defineProperty(navigator, key, { value, configurable: true });
  }
}

describe("platform", () => {
  const original = {
    platform: navigator.platform,
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
  };

  afterEach(() => {
    setNavigator(original);
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

  it("detects iPhone via user agent", () => {
    setNavigator({
      platform: "iPhone",
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      maxTouchPoints: 5,
    });
    expect(isIOSPlatform()).toBe(true);
    expect(isAndroidPlatform()).toBe(false);
  });

  it("detects iPadOS masquerading as MacIntel with touch", () => {
    setNavigator({
      platform: "MacIntel",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit",
      maxTouchPoints: 5,
    });
    expect(isIOSPlatform()).toBe(true);
  });

  it("does not treat a touchless Mac as iOS", () => {
    setNavigator({
      platform: "MacIntel",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit",
      maxTouchPoints: 0,
    });
    expect(isIOSPlatform()).toBe(false);
  });

  it("detects Android via user agent", () => {
    setNavigator({
      platform: "Linux armv8l",
      userAgent:
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120",
      maxTouchPoints: 5,
    });
    expect(isAndroidPlatform()).toBe(true);
    expect(isIOSPlatform()).toBe(false);
  });
});
