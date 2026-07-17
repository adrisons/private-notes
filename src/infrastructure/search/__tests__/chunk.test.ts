import { describe, it, expect } from "vitest";
import { chunkText } from "../chunk";

describe("chunkText", () => {
  it("returns no chunks for empty input", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   ")).toEqual([]);
  });

  it("produces a single chunk for short text", () => {
    const out = chunkText("one two three");
    expect(out).toHaveLength(1);
    expect(out[0]?.text).toBe("one two three");
    expect(out[0]?.offset).toBe(0);
    expect(out[0]?.length).toBe("one two three".length);
  });

  it("splits long text with overlap", () => {
    const words = Array.from({ length: 500 }, (_, i) => `w${i}`).join(" ");
    const out = chunkText(words, { size: 100, overlap: 20 });
    expect(out.length).toBeGreaterThan(4);
    // Adjacent chunks must overlap (start of chunk 2 < end of chunk 1).
    const a = out[0]!;
    const b = out[1]!;
    expect(b.offset).toBeLessThan(a.offset + a.length);
  });

  it("rejects non-sensical configurations", () => {
    expect(() => chunkText("hi", { size: 10, overlap: 10 })).toThrow();
  });
});
