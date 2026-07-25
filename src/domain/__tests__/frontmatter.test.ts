import { describe, it, expect } from "vitest";
import {
  canonicalBody,
  parseNote,
  serializeNote,
  FrontmatterError,
} from "../note/frontmatter";

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

  it("round-trips optional spaceIds", () => {
    const text = serializeNote(
      { ...baseFrontmatter, spaceIds: "01SPACE123,01SPACE456" },
      "Body",
    );
    const parsed = parseNote(text);
    expect(parsed.frontmatter.spaceIds).toBe("01SPACE123,01SPACE456");
  });

  it("omits General from serialized frontmatter", () => {
    const text = serializeNote(
      { ...baseFrontmatter, spaceIds: "general" },
      "Body",
    );
    expect(text).not.toContain("spaceIds:");
  });

  it("preserves multi-paragraph bodies", () => {
    const body = "Line A\n\nLine B\n\nLine C";
    const parsed = parseNote(serializeNote(baseFrontmatter, body));
    expect(parsed.body).toBe(body);
  });

  // The incremental reindex fingerprints the body it holds in memory and the
  // full reindex fingerprints the body it reads back, so the two only agree
  // while this identity holds for every shape a body can take.
  it.each([
    ["plain", "Body goes here."],
    ["trailing space", "Body goes here. "],
    ["trailing newlines", "Body goes here.\n\n"],
    ["trailing mixed whitespace", "Body goes here.\n  \n\t"],
    ["leading blank line", "\n\nBody goes here."],
    ["leading indentation", "  indented first line"],
    ["interior blank lines", "Line A\n\n\n\nLine B"],
    ["CRLF", "Line A\r\nLine B\r\n"],
    ["only whitespace", "\n \n"],
    ["empty", ""],
  ])("canonicalBody predicts the round trip: %s", (_name, body) => {
    const parsed = parseNote(serializeNote(baseFrontmatter, body));
    expect(parsed.body).toBe(canonicalBody(body));
    // And it is a fixed point, so hashing it twice cannot drift.
    expect(canonicalBody(parsed.body)).toBe(parsed.body);
  });

  it("rejects missing opening delimiter", () => {
    expect(() => parseNote("hello")).toThrow(FrontmatterError);
  });

  it("rejects missing required fields", () => {
    expect(() => parseNote("---\ntitle: x\n---\n")).toThrow(FrontmatterError);
  });
});
