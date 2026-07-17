import { describe, it, expect } from "vitest";
import { extractAttachmentPaths } from "../paths";

describe("extractAttachmentPaths", () => {
  it("finds attachment image paths in markdown", () => {
    const md = "Hello\n\n![cat](attachments/abc123.png)\n\nWorld";
    expect([...extractAttachmentPaths(md)]).toEqual(["attachments/abc123.png"]);
  });

  it("collects multiple unique paths", () => {
    const md = [
      "![a](attachments/one.png)",
      "![b](attachments/two.jpg)",
      "![c](attachments/one.png)",
    ].join("\n\n");
    expect([...extractAttachmentPaths(md)].sort()).toEqual([
      "attachments/one.png",
      "attachments/two.jpg",
    ]);
  });

  it("ignores non-attachment links", () => {
    const md = "[link](https://example.com) ![img](attachments/x.png)";
    expect([...extractAttachmentPaths(md)]).toEqual(["attachments/x.png"]);
  });

  it("returns empty for bodies without attachments", () => {
    expect([...extractAttachmentPaths("plain text")]).toEqual([]);
  });
});
