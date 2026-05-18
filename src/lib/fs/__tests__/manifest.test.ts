import { describe, it, expect } from "vitest";
import {
  buildEmptyIndex,
  buildManifest,
  validateManifestJson,
} from "../manifest";
import { APP_SIGNATURE, SCHEMA_VERSION } from "../types";

describe("buildManifest", () => {
  it("emits app signature, version and ISO timestamp", () => {
    const m = buildManifest(new Date("2026-05-17T10:00:00Z"));
    expect(m.app).toBe(APP_SIGNATURE);
    expect(m.version).toBe(SCHEMA_VERSION);
    expect(m.createdAt).toBe("2026-05-17T10:00:00.000Z");
  });
});

describe("buildEmptyIndex", () => {
  it("starts at the current schema version with no notes", () => {
    const idx = buildEmptyIndex();
    expect(idx.version).toBe(SCHEMA_VERSION);
    expect(idx.notes).toEqual([]);
  });
});

describe("validateManifestJson", () => {
  it("accepts a well-formed manifest", () => {
    const result = validateManifestJson({
      app: APP_SIGNATURE,
      version: SCHEMA_VERSION,
      createdAt: "2026-05-17T10:00:00.000Z",
    });
    expect(result.kind).toBe("compatible");
  });

  it("rejects a foreign app signature", () => {
    const result = validateManifestJson({
      app: "obsidian",
      version: 1,
      createdAt: "2026-05-17T10:00:00.000Z",
    });
    expect(result.kind).toBe("incompatible");
  });

  it("rejects a newer schema version", () => {
    const result = validateManifestJson({
      app: APP_SIGNATURE,
      version: SCHEMA_VERSION + 1,
      createdAt: "2026-05-17T10:00:00.000Z",
    });
    expect(result).toMatchObject({ kind: "incompatible" });
  });

  it("rejects non-objects", () => {
    expect(validateManifestJson(null).kind).toBe("incompatible");
    expect(validateManifestJson("foo").kind).toBe("incompatible");
  });
});
