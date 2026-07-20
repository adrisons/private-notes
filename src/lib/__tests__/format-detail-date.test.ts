import { describe, expect, it } from "vitest";
import { formatDetailDate } from "../format-detail-date";

describe("formatDetailDate", () => {
  it("formats an ISO timestamp with medium date and short time", () => {
    const formatted = formatDetailDate("2026-05-17T14:30:00.000Z");
    expect(formatted).toMatch(/2026/);
    expect(formatted).toMatch(/17/);
    expect(formatted.length).toBeGreaterThan(8);
  });
});
