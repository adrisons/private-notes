import { describe, it, expect } from "vitest";
import { parseNoteIndex } from "../validate";
import { VaultDataError } from "../../../lib/validate";
import { SCHEMA_VERSION } from "../schema";

const validRecord = {
  id: "01HX",
  title: "A note",
  path: "notes/2026/05/a-01HX.md",
  createdAt: "2026-05-17T10:00:00.000Z",
  updatedAt: "2026-05-17T10:00:00.000Z",
};

describe("parseNoteIndex", () => {
  it("accepts a well-formed index", () => {
    const index = parseNoteIndex(
      { version: SCHEMA_VERSION, notes: [validRecord] },
      "index.json",
    );
    expect(index.notes).toHaveLength(1);
    expect(index.notes[0]?.id).toBe("01HX");
  });

  it("accepts an empty index", () => {
    expect(
      parseNoteIndex({ version: SCHEMA_VERSION, notes: [] }, "index.json").notes,
    ).toEqual([]);
  });

  it("throws VaultDataError on a non-object", () => {
    expect(() => parseNoteIndex(null, "index.json")).toThrow(VaultDataError);
    expect(() => parseNoteIndex("nope", "index.json")).toThrow(VaultDataError);
  });

  it("throws when version is missing or non-numeric", () => {
    expect(() => parseNoteIndex({ notes: [] }, "index.json")).toThrow(
      VaultDataError,
    );
    expect(() =>
      parseNoteIndex({ version: "1", notes: [] }, "index.json"),
    ).toThrow(VaultDataError);
  });

  it("throws when notes is not an array", () => {
    expect(() =>
      parseNoteIndex({ version: 1, notes: {} }, "index.json"),
    ).toThrow(VaultDataError);
  });

  it("throws when a record is missing a field, naming the index", () => {
    const broken: Record<string, unknown> = { ...validRecord };
    delete broken.updatedAt;
    expect(() =>
      parseNoteIndex({ version: 1, notes: [broken] }, "index.json"),
    ).toThrow(/notes\[0\]/);
  });

  it("throws when a record path is unsafe", () => {
    expect(() =>
      parseNoteIndex(
        {
          version: SCHEMA_VERSION,
          notes: [{ ...validRecord, path: "notes/../evil.md" }],
        },
        "index.json",
      ),
    ).toThrow(/notes\[0\]/);
  });

  it("tags the error with the file name", () => {
    try {
      parseNoteIndex(null, "index.json");
    } catch (err) {
      expect((err as VaultDataError).file).toBe("index.json");
      expect((err as Error).message).toContain("index.json");
    }
  });
});
