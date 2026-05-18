import {
  APP_SIGNATURE,
  SCHEMA_VERSION,
  type Manifest,
  type NoteIndex,
  type ValidationResult,
} from "./types";

/** Build a fresh manifest for a newly initialized vault. */
export function buildManifest(now: Date = new Date()): Manifest {
  return {
    app: APP_SIGNATURE,
    version: SCHEMA_VERSION,
    createdAt: now.toISOString(),
  };
}

export function buildEmptyIndex(): NoteIndex {
  return { version: SCHEMA_VERSION, notes: [] };
}

/**
 * Validate raw JSON read from disk. Returns either a compatible manifest or
 * a structured incompatibility reason — never throws.
 */
export function validateManifestJson(raw: unknown): ValidationResult {
  if (!raw || typeof raw !== "object") {
    return { kind: "incompatible", reason: "Manifest is not a JSON object." };
  }
  const m = raw as Partial<Manifest>;
  if (m.app !== APP_SIGNATURE) {
    return {
      kind: "incompatible",
      reason: `Unexpected app signature: ${String(m.app)}`,
    };
  }
  if (typeof m.version !== "number") {
    return { kind: "incompatible", reason: "Missing manifest version." };
  }
  if (m.version > SCHEMA_VERSION) {
    return {
      kind: "incompatible",
      reason: `Vault was written by a newer app version (${m.version}).`,
    };
  }
  if (typeof m.createdAt !== "string") {
    return { kind: "incompatible", reason: "Missing createdAt timestamp." };
  }
  return {
    kind: "compatible",
    manifest: {
      app: APP_SIGNATURE,
      version: m.version,
      createdAt: m.createdAt,
    },
  };
}
