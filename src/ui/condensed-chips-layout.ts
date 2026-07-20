export interface CondensedChipsLayout {
  visibleCount: number;
  truncateLast: boolean;
  lastChipMaxWidth: number | null;
  showOverflowEllipsis: boolean;
}

/** How many full chips fit before an overflow ellipsis in a single row. */
export function computeCondensedChipsLayout(
  availableWidth: number,
  chipWidths: readonly number[],
  ellipsisWidth: number,
  gap: number,
): CondensedChipsLayout {
  const empty: CondensedChipsLayout = {
    visibleCount: 0,
    truncateLast: false,
    lastChipMaxWidth: null,
    showOverflowEllipsis: false,
  };

  if (chipWidths.length === 0 || availableWidth <= 0) return empty;

  const chipsTotal = chipWidths.reduce(
    (sum, width, index) => sum + width + (index > 0 ? gap : 0),
    0,
  );

  if (chipsTotal <= availableWidth) {
    return {
      visibleCount: chipWidths.length,
      truncateLast: false,
      lastChipMaxWidth: null,
      showOverflowEllipsis: false,
    };
  }

  for (let visible = chipWidths.length; visible >= 1; visible -= 1) {
    const hidden = chipWidths.length - visible;
    const chipsWidth = chipWidths
      .slice(0, visible)
      .reduce((sum, width, index) => sum + width + (index > 0 ? gap : 0), 0);
    const required =
      hidden > 0 ? chipsWidth + gap + ellipsisWidth : chipsWidth;

    if (required <= availableWidth) {
      return {
        visibleCount: visible,
        truncateLast: false,
        lastChipMaxWidth: null,
        showOverflowEllipsis: hidden > 0,
      };
    }
  }

  const hidden = chipWidths.length - 1;
  if (hidden > 0) {
    const maxChip = availableWidth - gap - ellipsisWidth;
    if (maxChip > 0) {
      return {
        visibleCount: 1,
        truncateLast: true,
        lastChipMaxWidth: maxChip,
        showOverflowEllipsis: true,
      };
    }
  }

  return {
    visibleCount: 1,
    truncateLast: true,
    lastChipMaxWidth: availableWidth,
    showOverflowEllipsis: false,
  };
}
