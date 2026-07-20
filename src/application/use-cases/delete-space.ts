import { isGeneralSpaceId, type SpaceId } from "../../domain";
import type { VaultSession } from "../vault-session";
import { guardNoteIO } from "../errors";

export interface DeleteSpacesResult {
  /** Spaces actually removed from `spaces.json`. */
  deleted: SpaceId[];
  /** True when any note was rewritten, so callers know to refresh summaries. */
  notesChanged: boolean;
}

/**
 * Deleting a space spans two aggregates: the space record and every note that
 * references it. The order is deliberate — notes are detached first because
 * that is the multi-file, failure-prone half. A failure there leaves the space
 * intact and the whole operation retryable, instead of stranding notes that
 * point at a space the user can no longer see.
 */
export async function deleteSpaces(
  session: VaultSession,
  ids: readonly SpaceId[],
): Promise<DeleteSpacesResult> {
  const targets = ids.filter((id) => !isGeneralSpaceId(id));
  if (targets.length === 0) return { deleted: [], notesChanged: false };

  return guardNoteIO(
    {
      operation: "delete-space",
      module: "application/use-cases/delete-space.ts",
      trace:
        "deleteSpaces → VaultSession.clearSpaceFromNotes → FsNoteRepository.clearSpace, then VaultSession.deleteSpace",
      fixHint:
        "Check clearSpaceFromNotes in infrastructure/notes/storage.ts and deleteSpaceRecord in infrastructure/spaces/storage.ts.",
      details: { spaceIds: targets },
    },
    targets.length === 1
      ? "Could not delete this space."
      : "Could not delete these spaces.",
    "Make sure the vault folder is writable, then try again.",
    async () => {
      const deleted: SpaceId[] = [];
      let notesChanged = false;
      for (const id of targets) {
        const touched = await session.clearSpaceFromNotes(id);
        if (touched.length > 0) notesChanged = true;
        if (await session.deleteSpace(id)) deleted.push(id);
      }
      return { deleted, notesChanged };
    },
  );
}
