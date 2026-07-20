import { describe, expect, it } from "vitest";
import { GENERAL_SPACE } from "../space/general-space";
import {
  applySpacePatch,
  assertValidSpaceName,
  createSpaceDraft,
  FALLBACK_SPACE_NAME,
  isCustomSpaceId,
  isReservedSpaceName,
  normalizeSpaceName,
} from "../space/space";
import { SpaceValidationError } from "../space/space-error";
import { GENERAL_SPACE_ID, spaceId } from "../space/space-id";

describe("isReservedSpaceName", () => {
  it("matches General case-insensitively", () => {
    expect(isReservedSpaceName("General")).toBe(true);
    expect(isReservedSpaceName("general")).toBe(true);
    expect(isReservedSpaceName(" GENERAL ")).toBe(true);
  });

  it("allows other names", () => {
    expect(isReservedSpaceName("Work")).toBe(false);
    expect(isReservedSpaceName("Generally speaking")).toBe(false);
  });

  it("uses the built-in General label", () => {
    expect(GENERAL_SPACE.name).toBe("General");
  });
});

describe("GENERAL_SPACE", () => {
  it("is frozen so no consumer can rename the built-in space", () => {
    expect(Object.isFrozen(GENERAL_SPACE)).toBe(true);
  });
});

describe("isCustomSpaceId", () => {
  it("treats every id but General as custom", () => {
    expect(isCustomSpaceId(GENERAL_SPACE_ID)).toBe(false);
    expect(isCustomSpaceId(spaceId("01HWORK"))).toBe(true);
  });
});

describe("space name rules", () => {
  it("falls back to Untitled for blank input", () => {
    expect(normalizeSpaceName("   ")).toBe(FALLBACK_SPACE_NAME);
    expect(normalizeSpaceName("  Work ")).toBe("Work");
  });

  it("rejects the reserved name from a single gate", () => {
    expect(() => assertValidSpaceName("general")).toThrow(SpaceValidationError);
    expect(() => createSpaceDraft({ name: " General ", colorId: "blue" })).toThrow(
      SpaceValidationError,
    );
    expect(() => applySpacePatch({ name: "GENERAL" })).toThrow(
      SpaceValidationError,
    );
  });

  it("normalizes a draft and drops a blank description", () => {
    expect(
      createSpaceDraft({ name: " Work ", colorId: "blue", description: "  " }),
    ).toEqual({ name: "Work", colorId: "blue" });
  });

  it("only carries the patched fields, and clears via null", () => {
    expect(applySpacePatch({ colorId: "red" })).toEqual({ colorId: "red" });
    expect(applySpacePatch({ description: "  " })).toEqual({
      description: null,
    });
    expect(applySpacePatch({ description: " ctx " })).toEqual({
      description: "ctx",
    });
  });
});
