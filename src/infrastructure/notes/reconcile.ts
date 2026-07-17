import { PATHS, type NoteIndex, type NoteRecord } from "../fs/schema";
import { buildEmptyIndex } from "../fs/manifest";
import { parseNoteIndex } from "../fs/validate";
import { withIndexLock } from "../fs/locks";
import { fileExists, listFilesRecursive, readText, writeText } from "../fs/handle";
import { parseJson } from "../../lib/validate";
import { parseNote } from "../../domain/note/frontmatter";
import {
  computeReconcileDiff,
  dedupeRecordsById,
  indexSnapshotChanged,
  type ReconcileRecord,
} from "../../domain/vault/reconcile-policy";

export interface ReconcileResult {
  /** The index after reconciliation (matches what's on disk). */
  index: NoteIndex;
  /** Whether the index file was rewritten. */
  changed: boolean;
  /** Note files present on disk but absent from the previous index. */
  added: number;
  /** Previous index entries whose note file no longer exists. */
  removed: number;
  /** Note file paths that could not be parsed and had no prior index entry. */
  skipped: string[];
}

/** Read the existing index, tolerating a missing or corrupt file. */
async function readPriorIndex(
  root: FileSystemDirectoryHandle,
): Promise<{ notes: NoteRecord[]; usable: boolean }> {
  if (!(await fileExists(root, PATHS.index))) {
    return { notes: [], usable: false };
  }
  try {
    const parsed = parseNoteIndex(
      parseJson(await readText(root, PATHS.index), PATHS.index),
      PATHS.index,
    );
    return { notes: parsed.notes, usable: true };
  } catch {
    // Corrupt/torn index — rebuild it wholesale from the note files.
    return { notes: [], usable: false };
  }
}

function recordFromFile(
  path: string,
  frontmatter: {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
  },
): NoteRecord {
  return {
    id: frontmatter.id,
    title: frontmatter.title,
    path,
    createdAt: frontmatter.createdAt,
    updatedAt: frontmatter.updatedAt,
  };
}

export async function reconcileVault(
  root: FileSystemDirectoryHandle,
): Promise<ReconcileResult> {
  return withIndexLock(async () => {
    const prior = await readPriorIndex(root);
    const priorByPath = new Map(prior.notes.map((n) => [n.path, n]));
    const priorIds = new Set(prior.notes.map((n) => n.id));

    const files = (await listFilesRecursive(root, PATHS.notes))
      .filter((p) => p.endsWith(".md"))
      .sort();

    const skipped: string[] = [];
    const scanned: ReconcileRecord[] = [];

    for (const path of files) {
      let record: ReconcileRecord | undefined;
      try {
        const { frontmatter } = parseNote(await readText(root, path));
        record = recordFromFile(path, frontmatter);
      } catch {
        const preserved = priorByPath.get(path);
        if (preserved) record = preserved;
        else {
          skipped.push(path);
          continue;
        }
      }
      scanned.push(record);
    }

    const notes = dedupeRecordsById(scanned) as NoteRecord[];
    const nextIds = new Set(notes.map((n) => n.id));
    const { added, removed } = computeReconcileDiff(priorIds, nextIds);

    const changed = indexSnapshotChanged(prior.usable, prior.notes, notes);

    const index: NoteIndex = { ...buildEmptyIndex(), notes };
    if (changed) {
      await writeText(root, PATHS.index, JSON.stringify(index, null, 2));
    }

    return { index, changed, added, removed, skipped };
  });
}
