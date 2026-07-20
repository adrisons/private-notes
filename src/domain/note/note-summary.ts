import type { SpaceId } from "../space/space-id";
import type { NoteId } from "./note-id";

/** List/search projection of a note — no body. */
export interface NoteSummary {
  readonly id: NoteId;
  title: string;
  updatedAt: string;
  /** Custom spaces only; empty means General. */
  spaceIds: SpaceId[];
}
