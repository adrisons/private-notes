/**
 * Crash recovery for the vault index.
 *
 * `createNote` / `updateNote` / `deleteNote` write the note file and
 * `.private-notes/index.json` as two separate steps (ADR-007: "memory first,
 * disk soon, index later"). A crash, kill, or lost tab between those steps —
 * or a torn write of `index.json` itself — leaves the two out of sync:
 *
 *   - a note file exists on disk but is missing from the index (orphan) — the
 *     note vanishes from the UI even though the data is safe on disk;
 *   - the index references a note file that no longer exists (dangling) — the
 *     app tries to open a note that isn't there.
 *
 * Note files are the source of truth (they carry id/title/dates in their
 * frontmatter); the index is a derivable cache. On vault open we scan `notes/`
 * and rebuild the index from what's actually on disk. We only rewrite the file
 * when it actually differs, to avoid churn and needless cross-tab contention.
 */
import { PATHS, type NoteIndex, type NoteRecord } from "../fs/types";
import { buildEmptyIndex } from "../fs/manifest";
import { parseNoteIndex } from "../fs/validate";
import { withIndexLock } from "../fs/locks";
import { fileExists, listFilesRecursive, readText, writeText } from "../fs/handle";
import { parseJson } from "../validate";
import { parseNote } from "./frontmatter";

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

function sortById(notes: NoteRecord[]): NoteRecord[] {
  return [...notes].sort((a, b) => a.id.localeCompare(b.id));
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
    // Dedupe by id (a crash mid-rename could leave two files sharing an id);
    // keep the most recently updated record.
    const byId = new Map<string, NoteRecord>();

    for (const path of files) {
      let record: NoteRecord | undefined;
      try {
        const { frontmatter } = parseNote(await readText(root, path));
        record = {
          id: frontmatter.id,
          title: frontmatter.title,
          path,
          createdAt: frontmatter.createdAt,
          updatedAt: frontmatter.updatedAt,
        };
      } catch {
        // Unparseable file: keep the prior index entry if we had one (the file
        // is present, just momentarily unreadable — don't hide it). Otherwise
        // report it and move on rather than aborting the whole vault open.
        const preserved = priorByPath.get(path);
        if (preserved) record = preserved;
        else {
          skipped.push(path);
          continue;
        }
      }
      const existing = byId.get(record.id);
      if (!existing || record.updatedAt > existing.updatedAt) {
        byId.set(record.id, record);
      }
    }

    const notes = [...byId.values()];
    const nextIds = new Set(notes.map((n) => n.id));
    const added = [...nextIds].filter((id) => !priorIds.has(id)).length;
    const removed = [...priorIds].filter((id) => !nextIds.has(id)).length;

    const changed =
      !prior.usable ||
      JSON.stringify(sortById(prior.notes)) !== JSON.stringify(sortById(notes));

    const index: NoteIndex = { ...buildEmptyIndex(), notes };
    if (changed) {
      await writeText(root, PATHS.index, JSON.stringify(index, null, 2));
    }

    return { index, changed, added, removed, skipped };
  });
}
