import { GENERAL_SPACE_ID } from "./space-id";
import type { Space } from "./space";

/** Separate from `GENERAL_SPACE` so the name rules can import it without a cycle. */
export const GENERAL_SPACE_NAME = "General";

export const GENERAL_SPACE: Space = Object.freeze({
  id: GENERAL_SPACE_ID,
  name: GENERAL_SPACE_NAME,
  colorId: null,
});

/** Shown in the spaces overview — General is built-in, not stored on disk. */
export const GENERAL_SPACE_DESCRIPTION =
  "Notes without another space live here.";
