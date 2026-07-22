import { describe, it, expect, afterEach } from "vitest";
import { getCompatibility } from "../compatibility";

describe("getCompatibility", () => {
  const original = {
    platform: navigator.platform,
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
  };

  afterEach(() => {
    for (const [key, value] of Object.entries(original)) {
      Object.defineProperty(navigator, key, { value, configurable: true });
    }
  });

  // jsdom has Worker and SubtleCrypto but not showDirectoryPicker.
  it("reports the missing File System Access API in jsdom", () => {
    const report = getCompatibility();
    expect(report.supported).toBe(false);
    expect(report.reasons.some((r) => r.includes("File System Access"))).toBe(
      true,
    );
  });

  function setNavigator(props: {
    platform?: string;
    userAgent?: string;
    maxTouchPoints?: number;
  }): void {
    for (const [key, value] of Object.entries(props)) {
      Object.defineProperty(navigator, key, { value, configurable: true });
    }
  }

  it("classifies a non-iOS unsupported browser as 'browser'", () => {
    setNavigator({
      platform: "Win32",
      userAgent: "Mozilla/5.0 (Windows NT 10.0) Gecko/20100101 Firefox/120.0",
      maxTouchPoints: 0,
    });
    expect(getCompatibility().unsupportedKind).toBe("browser");
  });

  it("classifies iOS as 'ios'", () => {
    setNavigator({
      platform: "iPhone",
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      maxTouchPoints: 5,
    });
    expect(getCompatibility().unsupportedKind).toBe("ios");
  });
});
