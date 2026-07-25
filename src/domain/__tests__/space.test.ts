import { describe, expect, it } from "vitest";
import {
  assertValidSpaceName,
  createSpaceDraft,
  DUPLICATE_SPACE_NAME_MESSAGE,
  isDuplicateSpaceName,
} from "../space/space";
import { SpaceValidationError } from "../space/space-error";

describe("space name uniqueness", () => {
  it("rejects a duplicate name case-insensitively", () => {
    expect(isDuplicateSpaceName("Work", ["Personal", "work"])).toBe(true);
    expect(() => assertValidSpaceName("WORK", ["Work"])).toThrow(
      SpaceValidationError,
    );
    expect(() => assertValidSpaceName("WORK", ["Work"])).toThrow(
      DUPLICATE_SPACE_NAME_MESSAGE,
    );
  });

  it("passes existing names into createSpaceDraft", () => {
    expect(() =>
      createSpaceDraft({ name: "Alpha", colorId: "blue" }, ["alpha"]),
    ).toThrow(SpaceValidationError);
  });
});
