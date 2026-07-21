import { parseNote } from "../../domain/note/frontmatter";
import { parseSpaceIds } from "../../domain/space/space-ids";
import { SPACE_COLOR_IDS } from "../../domain/space/space-color";
import { dedupeRecordsById } from "../../domain/vault/reconcile-policy";
import {
  buildEmptyAttachmentRefs,
  type AttachmentRefsIndex,
} from "../attachments/refs";
import { extractAttachmentPaths } from "../attachments/paths";
import { buildEmptySpacesIndex } from "../spaces/storage";
import {
  fileExists,
  getDirectory,
  listFilesRecursive,
  readText,
  writeText,
} from "./handle";
import { buildEmptyIndex, buildManifest } from "./manifest";
import { PATHS, type NoteRecord, type SpacesIndex } from "./schema";

export interface VaultRepairAssessment {
  /** True when note markdown exists but vault metadata is missing. */
  eligible: boolean;
  noteCount: number;
}

export interface VaultRepairResult {
  noteCount: number;
  spaceCount: number;
  skipped: string[];
}

async function collectNotePaths(
  root: FileSystemDirectoryHandle,
): Promise<string[]> {
  return (await listFilesRecursive(root, PATHS.notes))
    .filter((path) => path.endsWith(".md"))
    .sort();
}

/** Report whether a folder can be repaired in-app (notes without metadata). */
export async function assessVaultRepair(
  root: FileSystemDirectoryHandle,
): Promise<VaultRepairAssessment> {
  if (await fileExists(root, PATHS.manifest)) {
    return { eligible: false, noteCount: 0 };
  }
  const noteCount = (await collectNotePaths(root)).length;
  return { eligible: noteCount > 0, noteCount };
}

function recordFromFile(
  path: string,
  frontmatter: {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    spaceIds?: string;
  },
): NoteRecord {
  const record: NoteRecord = {
    id: frontmatter.id,
    title: frontmatter.title,
    path,
    createdAt: frontmatter.createdAt,
    updatedAt: frontmatter.updatedAt,
  };
  if (frontmatter.spaceIds) {
    record.spaceIds = frontmatter.spaceIds;
  }
  return record;
}

function buildRecoveredSpaces(
  spaceFirstSeen: Map<string, string>,
  now: string,
): SpacesIndex {
  const spaceIds = [...spaceFirstSeen.keys()].sort();
  return {
    ...buildEmptySpacesIndex(),
    spaces: spaceIds.map((id, index) => ({
      id,
      name: `Recovered space ${index + 1}`,
      colorId: SPACE_COLOR_IDS[index % SPACE_COLOR_IDS.length]!,
      createdAt: spaceFirstSeen.get(id) ?? now,
      updatedAt: spaceFirstSeen.get(id) ?? now,
    })),
  };
}

/**
 * Rebuild `.private-notes/` for a folder that already has note markdown under
 * `notes/` but no vault manifest. Space names are placeholders — rename them after open.
 */
export async function repairVault(
  root: FileSystemDirectoryHandle,
  now: Date = new Date(),
): Promise<VaultRepairResult> {
  if (await fileExists(root, PATHS.manifest)) {
    throw new Error("Vault metadata already exists.");
  }

  const paths = await collectNotePaths(root);
  if (paths.length === 0) {
    throw new Error("No note files found under notes/.");
  }

  const records: NoteRecord[] = [];
  const skipped: string[] = [];
  const spaceFirstSeen = new Map<string, string>();
  const attachmentRefs: AttachmentRefsIndex["refs"] = {};

  for (const path of paths) {
    try {
      const { frontmatter, body } = parseNote(await readText(root, path));
      records.push(recordFromFile(path, frontmatter));
      if (frontmatter.spaceIds) {
        for (const spaceId of parseSpaceIds(frontmatter.spaceIds)) {
          if (!spaceFirstSeen.has(spaceId)) {
            spaceFirstSeen.set(spaceId, frontmatter.updatedAt);
          }
        }
      }
      for (const attachmentPath of extractAttachmentPaths(body)) {
        const noteIds = attachmentRefs[attachmentPath] ?? [];
        if (!noteIds.includes(frontmatter.id)) {
          attachmentRefs[attachmentPath] = [...noteIds, frontmatter.id];
        }
      }
    } catch {
      skipped.push(path);
    }
  }

  const notes = dedupeRecordsById(records) as NoteRecord[];
  if (notes.length === 0) {
    throw new Error("No readable note files found under notes/.");
  }

  const iso = now.toISOString();
  await getDirectory(root, PATHS.meta, { create: true });
  await getDirectory(root, PATHS.notes, { create: true });
  await getDirectory(root, PATHS.attachments, { create: true });

  await writeText(
    root,
    PATHS.manifest,
    JSON.stringify(buildManifest(now), null, 2),
  );
  await writeText(
    root,
    PATHS.index,
    JSON.stringify({ ...buildEmptyIndex(), notes }, null, 2),
  );
  await writeText(
    root,
    PATHS.spaces,
    JSON.stringify(buildRecoveredSpaces(spaceFirstSeen, iso), null, 2),
  );
  await writeText(
    root,
    PATHS.attachmentRefs,
    JSON.stringify(
      { ...buildEmptyAttachmentRefs(), refs: attachmentRefs },
      null,
      2,
    ),
  );

  return {
    noteCount: notes.length,
    spaceCount: spaceFirstSeen.size,
    skipped,
  };
}
