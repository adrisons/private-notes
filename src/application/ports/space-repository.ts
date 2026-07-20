import type { CustomSpace, SpaceDraft, SpaceId, SpacePatch } from "../../domain";

/**
 * Attributes reach an adapter already validated by the domain
 * (`createSpaceDraft` / `applySpacePatch`, applied in the space use-cases).
 * Implementations persist them verbatim — they do not re-apply naming rules.
 */
export type CreateSpaceInput = SpaceDraft;
export type UpdateSpaceInput = SpacePatch;

export interface SpaceRepository {
  list(): Promise<CustomSpace[]>;
  create(input: CreateSpaceInput): Promise<CustomSpace>;
  update(id: SpaceId, patch: UpdateSpaceInput): Promise<CustomSpace | null>;
  /**
   * Removes the space record only. Detaching the id from notes belongs to the
   * note aggregate — see the `delete-space` use-case.
   */
  delete(id: SpaceId): Promise<boolean>;
}
