import { describe, it, expect } from "vitest";
import { markdownToHtml } from "../parse";

describe("markdownToHtml", () => {
  it("converts bold and italic", () => {
    const html = markdownToHtml("**a** *b*");
    expect(html).toContain("<strong>a</strong>");
    expect(html).toContain("<em>b</em>");
  });

  it("converts GFM strikethrough", () => {
    const html = markdownToHtml("~~x~~");
    // marked emits <del> for GFM strike.
    expect(html.toLowerCase()).toContain("<del>x</del>");
  });

  it("passes through inline <u> for underline", () => {
    expect(markdownToHtml("<u>under</u>")).toContain("<u>under</u>");
  });

  it("unwraps standalone image paragraphs", () => {
    const html = markdownToHtml("![cat](attachments/x/abc.png)");
    expect(html).not.toMatch(/<p>\s*<img/);
    expect(html).toContain("<img");
  });

  it("converts fenced code blocks to pre/code", () => {
    const html = markdownToHtml("```\nhello\n```");
    expect(html).toContain("<pre>");
    expect(html).toContain("<code");
    expect(html).toContain("hello");
  });

  it("converts headings, lists, and blockquotes", () => {
    const html = markdownToHtml(
      "# Title\n\n- a\n- b\n\n> quoted",
    );
    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>a</li>");
    expect(html).toContain("<blockquote>");
    expect(html).toContain("quoted");
  });

  it("converts horizontal rules to hr", () => {
    const html = markdownToHtml("above\n\n---\n\nbelow");
    expect(html).toContain("<hr");
  });
});
