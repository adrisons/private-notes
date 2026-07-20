import type { CSSProperties } from "react";
import type { SpaceColorId } from "../application/view-models";

/**
 * The only place a `SpaceColorId` becomes `--chip-*` tokens. A `null` colour is
 * the built-in General space, which uses neutral surface tokens instead.
 */
export function spaceChipStyle(colorId: SpaceColorId | null): CSSProperties {
  if (colorId === null) {
    return {
      backgroundColor: "var(--surface-sunken)",
      color: "var(--foreground-muted)",
    };
  }
  return {
    backgroundColor: `var(--chip-${colorId}-bg)`,
    color: `var(--chip-${colorId}-fg)`,
  };
}

/** Solid dot used where a full chip would be too heavy (space list rows). */
export function spaceDotStyle(colorId: SpaceColorId | null): CSSProperties {
  return {
    backgroundColor:
      colorId === null ? "var(--surface-sunken)" : `var(--chip-${colorId}-fg)`,
  };
}
