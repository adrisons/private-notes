import { describe, it, expect } from "vitest";
import { getCompatibility } from "../compatibility";

describe("getCompatibility", () => {
  // jsdom has Worker and SubtleCrypto but not showDirectoryPicker.
  it("reports the missing File System Access API in jsdom", () => {
    const report = getCompatibility();
    expect(report.supported).toBe(false);
    expect(report.reasons.some((r) => r.includes("File System Access"))).toBe(
      true,
    );
  });
});
