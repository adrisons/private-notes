import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { CSP_HEADER, CSP_META } from "../csp-policy";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function readHeadersCsp(): string {
  const headers = readFileSync(join(repoRoot, "public/_headers"), "utf8");
  const match = headers.match(
    /^[\s\S]*?Content-Security-Policy:\s*(.+)$/m,
  );
  if (!match) {
    throw new Error("public/_headers is missing a Content-Security-Policy line");
  }
  return match[1].trim();
}

describe("csp-policy", () => {
  it("matches the hosting header in public/_headers", () => {
    expect(readHeadersCsp()).toBe(CSP_HEADER);
  });

  it("keeps the meta policy free of frame-ancestors", () => {
    expect(CSP_META).not.toContain("frame-ancestors");
    expect(CSP_HEADER).toContain("frame-ancestors 'none'");
  });

  it("allows the observed model-download and WASM hosts", () => {
    for (const host of [
      "https://huggingface.co",
      "https://*.aws.cdn.hf.co",
      "https://cdn.jsdelivr.net",
    ]) {
      expect(CSP_META).toContain(host);
    }
  });
});
