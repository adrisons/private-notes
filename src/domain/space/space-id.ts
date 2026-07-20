import { SpaceValidationError } from "./space-error";

/** Branded id so space ids are not confused with note ids or colors. */
export type SpaceId = string & { readonly __spaceBrand: unique symbol };

/**
 * A note's spaces are persisted as one comma-separated string (ADR-002 §9), so
 * a comma or whitespace inside an id would silently corrupt every *other*
 * assignment on that note the next time it round-trips through disk.
 */
const INVALID_SPACE_ID = /[,\s]/;

export function isValidSpaceId(value: string): boolean {
  return value.length > 0 && !INVALID_SPACE_ID.test(value);
}

/** Strict constructor for ids the app mints or has already validated. */
export function spaceId(value: string): SpaceId {
  if (!isValidSpaceId(value)) {
    throw new SpaceValidationError(`Invalid space id: ${JSON.stringify(value)}`);
  }
  return value as SpaceId;
}

/**
 * Lenient counterpart for untrusted input. External editors may write anything
 * into `spaceIds`, and ADR-002 chooses to skip what we cannot read rather than
 * refuse to open the vault.
 */
export function tryParseSpaceId(value: string): SpaceId | null {
  const trimmed = value.trim();
  return isValidSpaceId(trimmed) ? (trimmed as SpaceId) : null;
}

/** Built-in default space for notes without an explicit assignment. */
export const GENERAL_SPACE_ID = spaceId("general");

export function isGeneralSpaceId(id: SpaceId): boolean {
  return id === GENERAL_SPACE_ID;
}
