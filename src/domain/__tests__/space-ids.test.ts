import { describe, expect, it } from "vitest";
import {
  migrateLegacySpaceField,
  parseSpaceIds,
  serializeSpaceIds,
} from "../space/space-ids";
import { SpaceValidationError } from "../space/space-error";
import { GENERAL_SPACE_ID, spaceId, tryParseSpaceId } from "../space/space-id";

describe("spaceId", () => {
  it("rejects ids that would corrupt the comma-separated field", () => {
    expect(() => spaceId("a,b")).toThrow(SpaceValidationError);
    expect(() => spaceId("")).toThrow(SpaceValidationError);
    expect(() => spaceId("has space")).toThrow(SpaceValidationError);
  });

  it("accepts a ULID", () => {
    expect(spaceId("01HWORK123")).toBe("01HWORK123");
  });
});

describe("tryParseSpaceId", () => {
  it("returns null instead of throwing, for untrusted input", () => {
    expect(tryParseSpaceId("a,b")).toBeNull();
    expect(tryParseSpaceId("   ")).toBeNull();
    expect(tryParseSpaceId("  work  ")).toBe("work");
  });
});

describe("parseSpaceIds", () => {
  it("skips unreadable entries rather than failing the whole note", () => {
    expect(parseSpaceIds("work, ,personal")).toEqual(["work", "personal"]);
  });

  it("drops General and duplicates", () => {
    expect(parseSpaceIds("work,general,work")).toEqual(["work"]);
    expect(parseSpaceIds(undefined)).toEqual([]);
  });

  it("round-trips through serializeSpaceIds", () => {
    const ids = parseSpaceIds("work,personal");
    expect(serializeSpaceIds(ids)).toBe("work,personal");
    expect(serializeSpaceIds([GENERAL_SPACE_ID])).toBeUndefined();
  });
});

describe("migrateLegacySpaceField", () => {
  it("prefers v3 spaceIds when present", () => {
    expect(migrateLegacySpaceField("work,personal", "old")).toBe(
      "work,personal",
    );
  });

  it("promotes a v2 spaceId, ignoring General and malformed values", () => {
    expect(migrateLegacySpaceField(undefined, "work")).toBe("work");
    expect(migrateLegacySpaceField(undefined, "general")).toBeUndefined();
    expect(migrateLegacySpaceField(undefined, "a,b")).toBeUndefined();
  });
});
