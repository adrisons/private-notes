import { describe, it, expect } from "vitest";
import { pickExtension, sha256Hex } from "../hash";

describe("sha256Hex", () => {
  it("matches the SHA-256 of an empty input", async () => {
    expect(await sha256Hex(new ArrayBuffer(0))).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("accepts Uint8Array views", async () => {
    const bytes = new TextEncoder().encode("abc");
    expect(await sha256Hex(bytes)).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
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
