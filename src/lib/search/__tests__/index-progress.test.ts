import { describe, it, expect } from "vitest";
import {
  formatIndexingLabel,
  formatIndexStatusLabel,
  isIndexStatusInteractive,
} from "../index-progress";

describe("index-progress", () => {
  it("formats indexing percentage", () => {
    expect(formatIndexingLabel({ done: 1, total: 4 })).toBe("Indexing 25%");
    expect(formatIndexingLabel({ done: 4, total: 4 })).toBe("Indexing 100%");
    expect(formatIndexingLabel({ done: 0, total: 0 })).toBe("Indexing…");
    expect(formatIndexingLabel(null)).toBe("Indexing…");
  });

  it("formats sidebar status labels", () => {
    expect(formatIndexStatusLabel(false, false, null)).toBe("Loading model…");
    expect(formatIndexStatusLabel(true, true, { done: 2, total: 5 })).toBe(
      "Indexing 40%",
    );
    expect(formatIndexStatusLabel(true, false, null)).toBe("All indexed");
  });

  it("marks completed status as interactive", () => {
    expect(isIndexStatusInteractive(true, false)).toBe(true);
    expect(isIndexStatusInteractive(true, true)).toBe(false);
    expect(isIndexStatusInteractive(false, false)).toBe(false);
  });
});
