import { describe, it, expect } from "vitest";
import { pickExtension, sha1Hex } from "../hash";

describe("sha1Hex", () => {
  it("matches the SHA-1 of an empty input", async () => {
    expect(await sha1Hex(new ArrayBuffer(0))).toBe(
      "da39a3ee5e6b4b0d3255bfef95601890afd80709",
    );
  });

  it("accepts Uint8Array views", async () => {
    const bytes = new TextEncoder().encode("abc");
    expect(await sha1Hex(bytes)).toBe(
      "a9993e364706816aba3e25717850c26c9cd0d89d",
    );
  });
});

describe("pickExtension", () => {
  it("uses the file name when possible", () => {
    expect(pickExtension({ name: "cat.PNG", type: "image/png" })).toBe("png");
  });

  it("falls back to the mime type and normalizes jpeg", () => {
    expect(pickExtension({ name: "noext", type: "image/jpeg" })).toBe("jpg");
  });

  it("returns 'bin' when nothing else works", () => {
    expect(pickExtension({ name: "noext", type: "" })).toBe("bin");
  });
});
