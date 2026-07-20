import { isGeneralSpaceId, spaceId, type SpaceId } from "./space-id";

const SEP = ",";

/** Parse comma-separated custom space ids from frontmatter or index. */
export function parseSpaceIds(raw?: string | null): SpaceId[] {
  if (!raw || raw.trim().length === 0) return [];
  return raw
    .split(SEP)
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !isGeneralSpaceId(spaceId(part)))
    .map((part) => spaceId(part));
}

/** Serialize custom space ids for frontmatter/index; omits General. */
export function serializeSpaceIds(ids: readonly SpaceId[]): string | undefined {
  const custom = ids.filter((id) => !isGeneralSpaceId(id));
  if (custom.length === 0) return undefined;
  return custom.join(SEP);
}

/**
 * Convert v2 `spaceId` + optional `spaceIds` into a v3 `spaceIds` string.
 * Used only during vault migration — not at runtime after v3.
 */
export function migrateLegacySpaceField(
  spaceIds?: string | null,
  legacySpaceId?: string | null,
): string | undefined {
  const parsed = parseSpaceIds(spaceIds);
  if (parsed.length > 0) return serializeSpaceIds(parsed);
  if (!legacySpaceId) return undefined;
  const legacy = spaceId(legacySpaceId);
  if (isGeneralSpaceId(legacy)) return undefined;
  return serializeSpaceIds([legacy]);
}

export function noteBelongsToSpace(
  noteSpaceIds: readonly SpaceId[],
  filterSpaceId: SpaceId,
): boolean {
  if (isGeneralSpaceId(filterSpaceId)) return noteSpaceIds.length === 0;
  return noteSpaceIds.includes(filterSpaceId);
}

export function addSpaceId(
  current: readonly SpaceId[],
  next: SpaceId,
): SpaceId[] {
  if (isGeneralSpaceId(next) || current.includes(next)) return [...current];
  return [...current, next];
}

export function removeSpaceId(
  current: readonly SpaceId[],
  target: SpaceId,
): SpaceId[] {
  return current.filter((id) => id !== target);
}
