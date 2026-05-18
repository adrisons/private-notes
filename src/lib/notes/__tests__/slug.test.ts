import { describe, it, expect } from "vitest";
import { slugify } from "../slug";

describe("slugify", () => {
  it("lowercases and dashifies", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("strips accents", () => {
    expect(slugify("Año nuevo, café")).toBe("ano-nuevo-cafe");
  });

  it("collapses runs of separators", () => {
    expect(slugify("a !! b   c")).toBe("a-b-c");
  });

  it("falls back to 'untitled' when nothing usable remains", () => {
    expect(slugify("¡!¿?")).toBe("untitled");
  });

  it("trims to 80 chars", () => {
    expect(slugify("a".repeat(200)).length).toBe(80);
  });
});
