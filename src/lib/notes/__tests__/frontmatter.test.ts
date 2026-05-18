import { describe, it, expect } from "vitest";
import {
  parseNote,
  serializeNote,
  FrontmatterError,
} from "../frontmatter";

const baseFrontmatter = {
  id: "01HXXXX",
  title: "Hello",
  createdAt: "2026-05-17T10:00:00.000Z",
  updatedAt: "2026-05-17T10:30:00.000Z",
};

describe("serializeNote / parseNote", () => {
  it("round-trips a simple note", () => {
    const text = serializeNote(baseFrontmatter, "Body goes here.");
    const parsed = parseNote(text);
    expect(parsed.frontmatter).toEqual(baseFrontmatter);
    expect(parsed.body).toBe("Body goes here.");
  });

  it("escapes quotes in the title", () => {
    const text = serializeNote({ ...baseFrontmatter, title: 'She said "hi"' }, "");
    const parsed = parseNote(text);
    expect(parsed.frontmatter.title).toBe('She said "hi"');
  });

  it("preserves multi-paragraph bodies", () => {
    const body = "Line A\n\nLine B\n\nLine C";
    const parsed = parseNote(serializeNote(baseFrontmatter, body));
    expect(parsed.body).toBe(body);
  });

  it("rejects missing opening delimiter", () => {
    expect(() => parseNote("hello")).toThrow(FrontmatterError);
  });

  it("rejects missing required fields", () => {
    expect(() => parseNote("---\ntitle: x\n---\n")).toThrow(FrontmatterError);
  });
});
