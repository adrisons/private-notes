import type { SpaceColorId } from "./space-color";
import { GENERAL_SPACE_ID, type SpaceId } from "./space-id";

/** Neutral chip styling — not a persisted `--chip-*` color. */
export const GENERAL_SPACE_COLOR: SpaceColorId = "blue";

export interface Space {
  readonly id: SpaceId;
  name: string;
  /** `null` means the built-in General styling (neutral tokens in UI). */
  colorId: SpaceColorId | null;
}

export const GENERAL_SPACE: Space = {
  id: GENERAL_SPACE_ID,
  name: "General",
  colorId: null,
};

/** Shown in the spaces overview — General is built-in, not stored on disk. */
export const GENERAL_SPACE_DESCRIPTION =
  "Notes without another space live here.";

/** Custom spaces cannot reuse the built-in General name. */
export function isReservedSpaceName(name: string): boolean {
  return name.trim().toLowerCase() === GENERAL_SPACE.name.toLowerCase();
}
