import { createSpaceDraft, type CustomSpace, type SpaceDraft } from "../../domain";
import type { VaultSession } from "../vault-session";
import { guardVaultIO } from "../errors";

/**
 * Validation runs outside the I/O guard so a `SpaceValidationError` keeps its
 * own message ("General is reserved…") instead of becoming a generic I/O toast.
 */
export async function createSpace(
  session: VaultSession,
  input: SpaceDraft,
): Promise<CustomSpace> {
  const existing = await session.listSpaces();
  const draft = createSpaceDraft(
    input,
    existing.map((space) => space.name),
  );
  return guardVaultIO(
    {
      operation: "create-space",
      module: "application/use-cases/create-space.ts",
      trace: "createSpace → VaultSession.createSpace → FsSpaceRepository.create",
      fixHint:
        "Check createSpaceRecord and withIndexLock in infrastructure/spaces/storage.ts.",
      details: { name: draft.name },
    },
    "Could not create this space.",
    "Make sure the vault folder is writable, then try again.",
    () => session.createSpace(draft),
  );
}
