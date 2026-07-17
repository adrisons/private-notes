/**
 * Small, dependency-free validation primitives for data read off disk.
 *
 * Every JSON file in the vault is untrusted input: it may be corrupt, half
 * written after a crash, or edited by another tool in a synced folder. A bare
 * `JSON.parse(text) as T` cast lets malformed data flow inward and fail far
 * from its origin. These helpers turn that into a single, well-labeled failure
 * at the I/O boundary.
 *
 * Two failure styles, by design:
 * - Critical vault files (index, attachment refs) call `assert*` and throw a
 *   `VaultDataError` — the app must not proceed with a corrupt index.
 * - The semantic index is a rebuildable cache: its readers return `null` on
 *   invalid data so the entry is simply re-embedded (see ADR-004).
 */

/** Thrown when a critical vault file fails validation. */
export class VaultDataError extends Error {
  /** The vault-relative file that failed, for actionable messages. */
  readonly file?: string;

  constructor(message: string, file?: string) {
    super(file ? `${file}: ${message}` : message);
    this.name = "VaultDataError";
    this.file = file;
  }
}

export function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function isString(v: unknown): v is string {
  return typeof v === "string";
}

export function isNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every(isString);
}

export function isNumberArray(v: unknown): v is number[] {
  return Array.isArray(v) && v.every(isNumber);
}

/**
 * Parse JSON text into an `unknown`, converting a syntax error into a
 * `VaultDataError` tagged with the file it came from.
 */
export function parseJson(text: string, file: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new VaultDataError("not valid JSON", file);
  }
}
