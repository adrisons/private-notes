import { GENERAL_SPACE_NAME } from "./general-space";
import type { SpaceColorId } from "./space-color";
import { SpaceValidationError } from "./space-error";
import { isGeneralSpaceId, type SpaceId } from "./space-id";

/** Any space the UI can show, built-in General included. */
export interface Space {
  readonly id: SpaceId;
  readonly name: string;
  /** `null` means the built-in General styling (neutral tokens in UI). */
  readonly colorId: SpaceColorId | null;
}

/** User-created space stored in `.private-notes/spaces.json`. */
export interface CustomSpace extends Space {
  readonly colorId: SpaceColorId;
  readonly description?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function isCustomSpaceId(id: SpaceId): boolean {
  return !isGeneralSpaceId(id);
}

/** Shown when the user saves a space without typing a name. */
export const FALLBACK_SPACE_NAME = "Untitled";

export const RESERVED_SPACE_NAME_MESSAGE =
  "“General” is reserved for the built-in space.";

export const DUPLICATE_SPACE_NAME_MESSAGE =
  "A space with this name already exists.";

/** Case-insensitive name collision against other custom spaces. */
export function isDuplicateSpaceName(
  name: string,
  existingNames: readonly string[],
): boolean {
  const lower = name.toLowerCase();
  return existingNames.some((existing) => existing.toLowerCase() === lower);
}

/** Custom spaces cannot reuse the built-in General name. */
export function isReservedSpaceName(name: string): boolean {
  return name.trim().toLowerCase() === GENERAL_SPACE_NAME.toLowerCase();
}

export function normalizeSpaceName(raw: string): string {
  return raw.trim() || FALLBACK_SPACE_NAME;
}

export function normalizeSpaceDescription(
  raw: string | undefined,
): string | undefined {
  return raw?.trim() || undefined;
}

/**
 * The single gate every write goes through — screens use it to preview the
 * result, use-cases to reject the write. Persistence stores what it returns
 * verbatim.
 */
export function assertValidSpaceName(
  raw: string,
  existingNames: readonly string[] = [],
): string {
  const name = normalizeSpaceName(raw);
  if (isReservedSpaceName(name)) {
    throw new SpaceValidationError(RESERVED_SPACE_NAME_MESSAGE);
  }
  if (isDuplicateSpaceName(name, existingNames)) {
    throw new SpaceValidationError(DUPLICATE_SPACE_NAME_MESSAGE);
  }
  return name;
}

export interface SpaceDraft {
  name: string;
  colorId: SpaceColorId;
  description?: string;
}

/** Validated attributes for a new custom space; the id is minted on write. */
export function createSpaceDraft(
  input: SpaceDraft,
  existingNames: readonly string[] = [],
): SpaceDraft {
  return {
    name: assertValidSpaceName(input.name, existingNames),
    colorId: input.colorId,
    ...(normalizeSpaceDescription(input.description)
      ? { description: normalizeSpaceDescription(input.description) }
      : null),
  };
}

export interface SpacePatch {
  name?: string;
  colorId?: SpaceColorId;
  /** `null` clears the description; omit the key to leave it untouched. */
  description?: string | null;
}

/** Same rules as `createSpaceDraft`, applied only to the fields being changed. */
export function applySpacePatch(
  patch: SpacePatch,
  existingNames: readonly string[] = [],
): SpacePatch {
  return {
    ...(patch.name !== undefined
      ? { name: assertValidSpaceName(patch.name, existingNames) }
      : null),
    ...(patch.colorId !== undefined ? { colorId: patch.colorId } : null),
    ...(patch.description !== undefined
      ? {
          description:
            normalizeSpaceDescription(patch.description ?? undefined) ?? null,
        }
      : null),
  };
}
