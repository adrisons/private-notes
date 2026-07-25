import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const tokensPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../design-tokens.css",
);
const tokensSource = readFileSync(tokensPath, "utf8");

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

function extractBlock(source: string, selector: string): string {
  const start = source.indexOf(selector);
  if (start < 0) throw new Error(`Missing selector: ${selector}`);
  const braceStart = source.indexOf("{", start);
  let depth = 0;
  for (let i = braceStart; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(braceStart + 1, i);
    }
  }
  throw new Error(`Unclosed block for selector: ${selector}`);
}

function parsePalette(block: string): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const match of block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6});/gi)) {
    vars[match[1]] = match[2];
  }
  return vars;
}

const lightPalette = parsePalette(
  extractBlock(tokensSource, ':root,\nhtml[data-theme="light"]'),
);
const darkPalette = parsePalette(
  extractBlock(tokensSource, 'html[data-theme="dark"]'),
);

/** WCAG AA minimum for normal-sized text. */
const AA_NORMAL = 4.5;

interface ContrastPair {
  foreground: string;
  background: string;
  label: string;
}

function semanticPairs(): ContrastPair[] {
  const surfaces = ["canvas", "surface", "surface-raised"] as const;
  const pairs: ContrastPair[] = [
    {
      foreground: "accent-foreground",
      background: "accent",
      label: "primary button",
    },
    {
      foreground: "danger-foreground",
      background: "danger",
      label: "danger button",
    },
    {
      foreground: "accent-soft-foreground",
      background: "accent-soft",
      label: "accent soft fill",
    },
    {
      foreground: "chip-neutral-fg",
      background: "chip-neutral-bg",
      label: "General space chip",
    },
    {
      foreground: "chip-blue-fg",
      background: "chip-blue-bg",
      label: "blue space chip",
    },
    {
      foreground: "chip-green-fg",
      background: "chip-green-bg",
      label: "green space chip",
    },
    {
      foreground: "chip-amber-fg",
      background: "chip-amber-bg",
      label: "amber space chip",
    },
    {
      foreground: "chip-red-fg",
      background: "chip-red-bg",
      label: "red space chip",
    },
    {
      foreground: "chip-purple-fg",
      background: "chip-purple-bg",
      label: "purple space chip",
    },
  ];

  for (const surface of surfaces) {
    pairs.push(
      {
        foreground: "foreground-muted",
        background: surface,
        label: `--foreground-muted on --${surface}`,
      },
      {
        foreground: "foreground-subtle",
        background: surface,
        label: `--foreground-subtle on --${surface}`,
      },
    );
  }

  return pairs;
}

describe("design token contrast", () => {
  it.each([
    ["light", lightPalette],
    ["dark", darkPalette],
  ] as const)(
    "keeps %s palette foreground/background pairs at WCAG AA",
    (_name, palette) => {
      for (const pair of semanticPairs()) {
        const fg = palette[pair.foreground];
        const bg = palette[pair.background];
        expect(fg, `missing --${pair.foreground}`).toBeTruthy();
        expect(bg, `missing --${pair.background}`).toBeTruthy();
        expect(
          contrastRatio(fg, bg),
          `${pair.label}: ${fg} on ${bg}`,
        ).toBeGreaterThanOrEqual(AA_NORMAL);
      }
    },
  );
});
