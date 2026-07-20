import { describe, expect, it } from "vitest";
import { formatRelative } from "../format-relative";

describe("formatRelative", () => {
  it("returns just now for very recent timestamps", () => {
    const now = new Date().toISOString();
    expect(formatRelative(now)).toBe("just now");
  });

  it("returns minutes for timestamps within an hour", () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(formatRelative(fiveMinutesAgo)).toBe("5m ago");
  });
});
