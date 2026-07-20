import { describe, expect, it } from "vitest";
import { GENERAL_SPACE, isReservedSpaceName } from "../space/general-space";

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
