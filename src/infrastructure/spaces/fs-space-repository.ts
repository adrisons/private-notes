import {
  parseSpaceColorId,
  spaceId,
  type CustomSpace,
  type SpaceId,
} from "../../domain";
import type {
  CreateSpaceInput,
  SpaceRepository,
  UpdateSpaceInput,
} from "../../application/ports/space-repository";
import { clearSpaceFromNotes } from "../notes/storage";
import {
  createSpaceRecord,
  deleteSpaceRecord,
  listSpaceRecords,
  updateSpaceRecord,
} from "./storage";

function toCustomSpace(record: {
  id: string;
  name: string;
  colorId: string;
  description?: string;
}): CustomSpace {
  return {
    id: spaceId(record.id),
    name: record.name,
    colorId: parseSpaceColorId(record.colorId),
    ...(record.description ? { description: record.description } : null),
  };
}

export class FsSpaceRepository implements SpaceRepository {
  private readonly root: FileSystemDirectoryHandle;

  constructor(root: FileSystemDirectoryHandle) {
    this.root = root;
  }

  private io() {
    return { root: this.root };
  }

  async list(): Promise<CustomSpace[]> {
    const records = await listSpaceRecords(this.io());
    return records.map(toCustomSpace);
  }

  async create(input: CreateSpaceInput): Promise<CustomSpace> {
    const record = await createSpaceRecord(this.io(), input);
    return toCustomSpace(record);
  }

  async update(id: SpaceId, patch: UpdateSpaceInput): Promise<CustomSpace | null> {
    const record = await updateSpaceRecord(this.io(), id, patch);
    return record ? toCustomSpace(record) : null;
  }

  async delete(id: SpaceId): Promise<boolean> {
    await clearSpaceFromNotes(this.io(), id);
    return deleteSpaceRecord(this.io(), id);
  }
}
