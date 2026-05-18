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
});
