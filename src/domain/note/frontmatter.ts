/**
 * Minimal YAML-frontmatter serializer/parser for our restricted schema:
 * top-level keys with string values, fenced between `---` lines.
 *
 * We do NOT depend on a YAML library — the values we read and write are
 * always strings (id, title, ISO dates, comma-separated space ids), and
 * supporting just that subset keeps the file format predictable for tools
 * like `cat` or `grep`.
 */


import { parseSpaceIds, serializeSpaceIds } from "../space/space-ids";

export interface NoteFrontmatter {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  /** Comma-separated custom space ids. Omitted when the note is General-only. */
  spaceIds?: string;
}

export interface ParsedNote {
  frontmatter: NoteFrontmatter;
  body: string;
}

const DELIMITER = "---";

/** Escape a value so it survives a single-line YAML scalar. */
function quote(value: string): string {
  let escaped = "";
  for (const ch of value) {
    if (ch === "\\") escaped += "\\\\";
    else if (ch === '"') escaped += '\\"';
    else if (ch === "\n") escaped += "\\n";
    else if (ch === "\r") escaped += "\\r";
    else if (ch === "\t") escaped += "\\t";
    else {
      const code = ch.charCodeAt(0);
      if (code < 0x20 || code === 0x7f) {
        escaped += `\\u${code.toString(16).padStart(4, "0")}`;
      } else {
        escaped += ch;
      }
    }
  }
  return `"${escaped}"`;
}

function unquote(raw: string): string {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed
      .slice(1, -1)
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) =>
        String.fromCharCode(Number.parseInt(hex, 16)),
      )
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }
  return trimmed;
}

/**
 * The body as it will read back from disk: CRLF folded, trailing whitespace
 * gone, and no blank lines between the closing delimiter and the first line of
 * prose. Writing and reading a note each normalise a different half of that,
 * so an in-memory body and the same body after a round trip are not always the
 * same string.
 *
 * Anything that fingerprints a body has to agree on which of the two it means.
 * When the incremental reindex hashed the editor's text and the next reload
 * hashed the file's, a note that merely ended in a space was re-embedded on
 * every open. `serializeNote` applies this on the way out so the identity
 * `parseNote(serializeNote(fm, body)).body === canonicalBody(body)` holds.
 */
export function canonicalBody(body: string): string {
  return body
    .replace(/\r\n/g, "\n")
    .replace(/\s+$/, "")
    .replace(/^\n+/, "");
}

export function serializeNote(
  frontmatter: NoteFrontmatter,
  body: string,
): string {
  const lines = [
    DELIMITER,
    `id: ${quote(frontmatter.id)}`,
    `title: ${quote(frontmatter.title)}`,
    `createdAt: ${quote(frontmatter.createdAt)}`,
    `updatedAt: ${quote(frontmatter.updatedAt)}`,
  ];
  const serialized = serializeSpaceIds(parseSpaceIds(frontmatter.spaceIds));
  if (serialized) {
    lines.push(`spaceIds: ${quote(serialized)}`);
  }
  lines.push(DELIMITER, "", canonicalBody(body), "");
  return lines.join("\n");
}

export class FrontmatterError extends Error {}

export function parseNote(text: string): ParsedNote {
  const normalized = text.replace(/\r\n/g, "\n");
  if (!normalized.startsWith(`${DELIMITER}\n`)) {
    throw new FrontmatterError("Missing frontmatter opening delimiter.");
  }
  const rest = normalized.slice(DELIMITER.length + 1);
  const closeIdx = rest.indexOf(`\n${DELIMITER}`);
  if (closeIdx === -1) {
    throw new FrontmatterError("Missing frontmatter closing delimiter.");
  }
  const header = rest.slice(0, closeIdx);
  const after = rest
    .slice(closeIdx + DELIMITER.length + 1)
    .replace(/^\n+/, "")
    .replace(/\n+$/, "");

  const data: Partial<NoteFrontmatter> = {};
  for (const rawLine of header.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const colon = line.indexOf(":");
    if (colon === -1) {
      throw new FrontmatterError(`Invalid frontmatter line: ${line}`);
    }
    const key = line.slice(0, colon).trim();
    const value = unquote(line.slice(colon + 1));
    if (
      key === "id" ||
      key === "title" ||
      key === "createdAt" ||
      key === "updatedAt" ||
      key === "spaceIds"
    ) {
      data[key] = value;
    }
  }
  for (const k of ["id", "title", "createdAt", "updatedAt"] as const) {
    if (typeof data[k] !== "string") {
      throw new FrontmatterError(`Missing required frontmatter field: ${k}`);
    }
  }
  return { frontmatter: data as NoteFrontmatter, body: after };
}
