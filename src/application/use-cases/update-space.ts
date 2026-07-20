import { applySpacePatch, type CustomSpace, type SpaceId, type SpacePatch } from "../../domain";
import type { VaultSession } from "../vault-session";
import { guardNoteIO } from "../errors";

export async function updateSpace(
  session: VaultSession,
  id: SpaceId,
  patch: SpacePatch,
): Promise<CustomSpace | null> {
  const validated = applySpacePatch(patch);
  return guardNoteIO(
    {
      operation: "update-space",
      module: "application/use-cases/update-space.ts",
      trace: "updateSpace → VaultSession.updateSpace → FsSpaceRepository.update",
      fixHint:
        "Check updateSpaceRecord in infrastructure/spaces/storage.ts; the id must exist in spaces.json.",
      details: { spaceId: id },
    },
    "Could not save this space.",
    "Make sure the vault folder is writable, then try again.",
    () => session.updateSpace(id, validated),
  );
}
