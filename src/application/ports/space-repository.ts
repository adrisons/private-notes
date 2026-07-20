import type { CustomSpace, SpaceColorId, SpaceId } from "../../domain";

export interface CreateSpaceInput {
  name: string;
  colorId: SpaceColorId;
  description?: string;
}

export interface UpdateSpaceInput {
  name?: string;
  colorId?: SpaceColorId;
  description?: string;
}

export interface SpaceRepository {
  list(): Promise<CustomSpace[]>;
  create(input: CreateSpaceInput): Promise<CustomSpace>;
  update(id: SpaceId, patch: UpdateSpaceInput): Promise<CustomSpace | null>;
  delete(id: SpaceId): Promise<boolean>;
}
