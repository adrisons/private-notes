import { describe, expect, it } from "vitest";
import { computeCondensedChipsLayout } from "../condensed-chips-layout";

const ELLIPSIS = 12;
const GAP = 4;

describe("computeCondensedChipsLayout", () => {
  it("shows every chip when they all fit", () => {
    expect(computeCondensedChipsLayout(200, [30, 40, 35], ELLIPSIS, GAP)).toEqual({
      visibleCount: 3,
      truncateLast: false,
      lastChipMaxWidth: null,
      showOverflowEllipsis: false,
    });
  });

  it("shows full leading chips and an overflow ellipsis", () => {
    expect(computeCondensedChipsLayout(90, [30, 40, 35, 28], ELLIPSIS, GAP)).toEqual({
      visibleCount: 2,
      truncateLast: false,
      lastChipMaxWidth: null,
      showOverflowEllipsis: true,
    });
  });

  it("truncates the first chip when even one full label does not fit", () => {
    expect(computeCondensedChipsLayout(50, [80, 40], ELLIPSIS, GAP)).toEqual({
      visibleCount: 1,
      truncateLast: true,
      lastChipMaxWidth: 50 - GAP - ELLIPSIS,
      showOverflowEllipsis: true,
    });
  });

  it("truncates a lone chip when the row is narrower than its label", () => {
    expect(computeCondensedChipsLayout(36, [80], ELLIPSIS, GAP)).toEqual({
      visibleCount: 1,
      truncateLast: true,
      lastChipMaxWidth: 36,
      showOverflowEllipsis: false,
    });
  });
});
