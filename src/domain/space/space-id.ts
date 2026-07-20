/** Branded id so space ids are not confused with note ids or colors. */
export type SpaceId = string & { readonly __spaceBrand: unique symbol };

export function spaceId(value: string): SpaceId {
  return value as SpaceId;
}

/** Built-in default space for notes without an explicit assignment. */
export const GENERAL_SPACE_ID = spaceId("general");

export function resolveSpaceId(raw?: string | null): SpaceId {
  if (!raw || raw === GENERAL_SPACE_ID) return GENERAL_SPACE_ID;
  return spaceId(raw);
}

export function isGeneralSpaceId(id: SpaceId): boolean {
  return id === GENERAL_SPACE_ID;
}
