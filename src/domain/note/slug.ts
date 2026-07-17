/**
 * Title -> URL/filesystem-safe slug. Strips combining marks (so "ñ" -> "n"),
 * lowercases, replaces runs of non-alphanumerics with single dashes.
 * Returns `"untitled"` if nothing usable remains.
 */
export function slugify(title: string): string {
  const stripped = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return stripped.length > 0 ? stripped : "untitled";
}
