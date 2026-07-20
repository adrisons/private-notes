/** Palette ids backed by `--chip-*` tokens in design-tokens.css. */
export const SPACE_COLOR_IDS = [
  "blue",
  "green",
  "amber",
  "red",
  "purple",
] as const;

export type SpaceColorId = (typeof SPACE_COLOR_IDS)[number];

export function isSpaceColorId(value: string): value is SpaceColorId {
  return (SPACE_COLOR_IDS as readonly string[]).includes(value);
}

export function parseSpaceColorId(value: string): SpaceColorId {
  if (isSpaceColorId(value)) return value;
  throw new Error(`Invalid space color: ${value}`);
}
