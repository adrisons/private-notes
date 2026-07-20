import { describe, expect, it } from "vitest";

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
  );
}

function contrastRatio(foreground: string, background: string): number {
  const parse = (hex: string): [number, number, number] => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const fg = relativeLuminance(parse(foreground));
  const bg = relativeLuminance(parse(background));
  const lighter = Math.max(fg, bg);
  const darker = Math.min(fg, bg);
  return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG AA minimum for normal-sized text. */
const AA_NORMAL = 4.5;

describe("design token contrast", () => {
  it("keeps --foreground-muted readable on common surfaces (WCAG AA)", () => {
    const lightMuted = "#6b625b";
    const darkMuted = "#b8b0ab";

    expect(contrastRatio(lightMuted, "#fbfaf8")).toBeGreaterThanOrEqual(
      AA_NORMAL,
    );
    expect(contrastRatio(lightMuted, "#f4f1ec")).toBeGreaterThanOrEqual(
      AA_NORMAL,
    );
    expect(contrastRatio(lightMuted, "#ffffff")).toBeGreaterThanOrEqual(
      AA_NORMAL,
    );
    expect(contrastRatio(darkMuted, "#252220")).toBeGreaterThanOrEqual(
      AA_NORMAL,
    );
    expect(contrastRatio(darkMuted, "#2c2926")).toBeGreaterThanOrEqual(
      AA_NORMAL,
    );
  });

  it("keeps General space chip and dot readable (WCAG AA)", () => {
    expect(contrastRatio("#524a44", "#e4ddd4")).toBeGreaterThanOrEqual(
      AA_NORMAL,
    );
    expect(contrastRatio("#524a44", "#fbe9e1")).toBeGreaterThanOrEqual(
      AA_NORMAL,
    );
    expect(contrastRatio("#524a44", "#ffffff")).toBeGreaterThanOrEqual(
      AA_NORMAL,
    );
    expect(contrastRatio("#d4ccc6", "#45403c")).toBeGreaterThanOrEqual(
      AA_NORMAL,
    );
    expect(contrastRatio("#d4ccc6", "#3a2119")).toBeGreaterThanOrEqual(
      AA_NORMAL,
    );
    expect(contrastRatio("#d4ccc6", "#36322f")).toBeGreaterThanOrEqual(
      AA_NORMAL,
    );
  });
});
