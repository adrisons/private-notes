import { describe, it, expect } from "vitest";
import { FakeEmbedder, dot, l2NormalizeInPlace } from "../embedder";

describe("FakeEmbedder", () => {
  it("returns unit-normalized vectors of the configured size", async () => {
    const e = new FakeEmbedder("test", 16);
    const [v] = await e.embed(["hello world"]);
    expect(v).toBeDefined();
    expect(v!.length).toBe(16);
    const norm = Math.sqrt(v!.reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  it("is deterministic for the same input", async () => {
    const e = new FakeEmbedder();
    const [a] = await e.embed(["hello"]);
    const [b] = await e.embed(["hello"]);
    expect(a).toEqual(b);
  });

  it("ranks lexically similar texts higher", async () => {
    const e = new FakeEmbedder();
    const [query, similar, different] = await e.embed([
      "the cat sat on the mat",
      "a cat was on a mat",
      "rockets launch into orbit",
    ]);
    expect(dot(query!, similar!)).toBeGreaterThan(dot(query!, different!));
  });
});

describe("l2NormalizeInPlace", () => {
  it("leaves an all-zero vector untouched", () => {
    const v = [0, 0, 0];
    l2NormalizeInPlace(v);
    expect(v).toEqual([0, 0, 0]);
  });
});
