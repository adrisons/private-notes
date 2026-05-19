/**
 * Persistent schema for the on-disk vault. Bumping `SCHEMA_VERSION` is a
 * breaking change and requires either a migration or a refusal to open.
 */
export const APP_SIGNATURE = "private-notes" as const;
export const SCHEMA_VERSION = 1 as const;

export const PATHS = {
  meta: ".private-notes",
  manifest: ".private-notes/manifest.json",
  index: ".private-notes/index.json",
  notes: "notes",
  attachments: "attachments",
} as const;

export interface Manifest {
  app: typeof APP_SIGNATURE;
  version: number;
  createdAt: string;
}

export interface NoteRecord {
  id: string;
  title: string;
  /** Relative path under the vault root, e.g. "notes/2026/05/foo-01HX.md". */
  path: string;
  createdAt: string;
  updatedAt: string;
}

export interface NoteIndex {
  version: number;
  notes: NoteRecord[];
}

export type ValidationResult =
  | { kind: "compatible"; manifest: Manifest }
  | { kind: "empty" }
  | { kind: "incompatible"; reason: string };
