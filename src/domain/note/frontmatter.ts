/**
 * Minimal YAML-frontmatter serializer/parser for our restricted schema:
 * top-level keys with string values, fenced between `---` lines.
 *
 * We do NOT depend on a YAML library — the values we read and write are
 * always strings (id, title, ISO dates), and supporting just that subset keeps
 * the file format predictable for tools like `cat` or `grep`.
 */

export interface NoteFrontmatter {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ParsedNote {
  frontmatter: NoteFrontmatter;
  body: string;
}

const DELIMITER = "---";

/** Escape a value so it survives a single-line YAML scalar. */
function quote(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function unquote(raw: string): string {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed
      .slice(1, -1)
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }
  return trimmed;
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
    DELIMITER,
    "",
    body.replace(/\s+$/, ""),
    "",
  ];
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
  // Strip the surrounding blank line(s) the serializer adds around the body.
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
      key === "updatedAt"
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
