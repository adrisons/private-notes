import { describe, expect, it } from "vitest";
import {
  ATTACHMENT_IMAGE_MAX_WIDTH,
  ATTACHMENT_IMAGE_MIN_WIDTH,
  clampAttachmentImageWidth,
  defaultAttachmentImageWidth,
} from "../attachment-image-size";

describe("clampAttachmentImageWidth", () => {
  it("clamps to the configured bounds", () => {
    expect(clampAttachmentImageWidth(40)).toBe(ATTACHMENT_IMAGE_MIN_WIDTH);
    expect(clampAttachmentImageWidth(900)).toBe(ATTACHMENT_IMAGE_MAX_WIDTH);
    expect(clampAttachmentImageWidth(420.6)).toBe(421);
  });
});

describe("defaultAttachmentImageWidth", () => {
  it("falls back to the default maximum when dimensions cannot be read", async () => {
    const invalid = new File(["not-an-image"], "bad.png", { type: "image/png" });
    await expect(defaultAttachmentImageWidth(invalid)).resolves.toBe(
      ATTACHMENT_IMAGE_MAX_WIDTH,
    );
  });
});
