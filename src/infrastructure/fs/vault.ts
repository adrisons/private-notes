import {
  fileExists,
  getDirectory,
  isEffectivelyEmpty,
  readText,
  writeText,
} from "./handle";
import {
  buildEmptyIndex,
  buildManifest,
  validateManifestJson,
} from "./manifest";
import { buildEmptyAttachmentRefs } from "../attachments/refs";
import { buildEmptySpacesIndex } from "../spaces/storage";
import { migrateVaultIfNeeded } from "./migrate";
import { PATHS, type Manifest, type ValidationResult } from "./schema";

/**
 * Reads the manifest file (if any) and reports whether the folder is a usable
 * vault, an empty folder we may initialize, or something we must refuse.
 */
export async function inspectFolder(
  root: FileSystemDirectoryHandle,
): Promise<ValidationResult> {
  const hasManifest = await fileExists(root, PATHS.manifest);
  if (hasManifest) {
    try {
      const text = await readText(root, PATHS.manifest);
      return validateManifestJson(JSON.parse(text));
    } catch (err) {
      return {
        kind: "incompatible",
        reason: `Manifest could not be read: ${(err as Error).message}`,
      };
    }
  }
  if (await isEffectivelyEmpty(root)) {
    return { kind: "empty" };
  }
  return {
    kind: "incompatible",
    reason:
      "Folder is not empty and is not a private-notes vault. Choose a different folder.",
  };
}

/** Writes a fresh manifest, index, and required subdirectories. */
export async function initializeVault(
  root: FileSystemDirectoryHandle,
  now: Date = new Date(),
): Promise<Manifest> {
  await getDirectory(root, PATHS.meta, { create: true });
  await getDirectory(root, PATHS.notes, { create: true });
  await getDirectory(root, PATHS.attachments, { create: true });
  const manifest = buildManifest(now);
  await writeText(root, PATHS.manifest, JSON.stringify(manifest, null, 2));
  await writeText(
    root,
    PATHS.index,
    JSON.stringify(buildEmptyIndex(), null, 2),
  );
  await writeText(
    root,
    PATHS.attachmentRefs,
    JSON.stringify(buildEmptyAttachmentRefs(), null, 2),
  );
  await writeText(
    root,
    PATHS.spaces,
    JSON.stringify(buildEmptySpacesIndex(), null, 2),
  );
  return manifest;
}

/**
 * Open the vault: validate it, or initialize it if the folder is empty.
 * Returns the manifest on success.
 */
export async function openOrInitialize(
  root: FileSystemDirectoryHandle,
): Promise<{ manifest: Manifest; initialized: boolean }> {
  const result = await inspectFolder(root);
  if (result.kind === "compatible") {
    const manifest = await migrateVaultIfNeeded(root, result.manifest);
    return { manifest, initialized: false };
  }
  if (result.kind === "empty") {
    const manifest = await initializeVault(root);
    return { manifest, initialized: true };
  }
  throw new Error(result.reason);
}
