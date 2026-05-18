import { describe, it, expect } from "vitest";
import { serializeDoc } from "../serialize";
import type { PMDoc, PMMark, PMParagraphNode } from "../types";

function doc(...paragraphs: PMParagraphNode[]): PMDoc {
  return { type: "doc", content: paragraphs };
}

function p(
  ...content: Array<{ text: string; marks?: PMMark["type"][] }>
): PMParagraphNode {
  return {
    type: "paragraph",
    content: content.map((c) => ({
      type: "text",
      text: c.text,
      marks: c.marks?.map((m) => ({ type: m })),
    })),
  };
}

describe("serializeDoc", () => {
  it("serializes plain text", () => {
    expect(serializeDoc(doc(p({ text: "hello" })))).toBe("hello");
  });

  it("serializes bold, italic, strike, underline", () => {
    expect(serializeDoc(doc(p({ text: "x", marks: ["bold"] })))).toBe("**x**");
    expect(serializeDoc(doc(p({ text: "x", marks: ["italic"] })))).toBe("*x*");
    expect(serializeDoc(doc(p({ text: "x", marks: ["strike"] })))).toBe("~~x~~");
    expect(serializeDoc(doc(p({ text: "x", marks: ["underline"] })))).toBe(
      "<u>x</u>",
    );
  });

  it("nests marks in a stable order: bold > italic > strike > underline", () => {
    expect(
      serializeDoc(
        doc(p({ text: "x", marks: ["bold", "italic", "strike", "underline"] })),
      ),
    ).toBe("***~~<u>x</u>~~***");
  });

  it("hoists whitespace out of marks", () => {
    expect(serializeDoc(doc(p({ text: " bold ", marks: ["bold"] })))).toBe(
      " **bold** ",
    );
  });

  it("separates paragraphs with a blank line", () => {
    expect(
      serializeDoc(doc(p({ text: "a" }), p({ text: "b" }))),
    ).toBe("a\n\nb");
  });

  it("emits an attachmentImage as its own paragraph", () => {
    const out = serializeDoc({
      type: "doc",
      content: [
        p({ text: "before" }),
        {
          type: "attachmentImage",
          attrs: { src: "attachments/x/abc.png", alt: "kitten" },
        },
        p({ text: "after" }),
      ],
    });
    expect(out).toBe(
      "before\n\n![kitten](attachments/x/abc.png)\n\nafter",
    );
  });
});
