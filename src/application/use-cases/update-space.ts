import {
  applySpacePatch,
  type CustomSpace,
  type SpaceId,
  type SpacePatch,
} from "../../domain";
import type { VaultSession } from "../vault-session";
import { guardVaultIO } from "../errors";

export async function updateSpace(
  session: VaultSession,
  id: SpaceId,
  patch: SpacePatch,
): Promise<CustomSpace | null> {
  const existing = await session.listSpaces();
  const otherNames = existing
    .filter((space) => space.id !== id)
    .map((space) => space.name);
  const validated = applySpacePatch(patch, otherNames);
  return guardVaultIO(
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
