import type { SpaceColorId } from "./space-color";
import type { SpaceId } from "./space-id";

/** User-created space stored in `.private-notes/spaces.json`. */
export interface CustomSpace {
  readonly id: SpaceId;
  name: string;
  description?: string;
  colorId: SpaceColorId;
}

export function isCustomSpaceId(id: SpaceId): boolean {
  return id !== "general";
}
