/** Matches `![alt](attachments/...)` image references in note markdown. */
const ATTACHMENT_PATH_RE = /!\[[^\]]*\]\((attachments\/[^)]+)\)/g;

/** Collect unique attachment paths referenced in a markdown body. */
export function extractAttachmentPaths(markdown: string): Set<string> {
  const paths = new Set<string>();
  for (const match of markdown.matchAll(ATTACHMENT_PATH_RE)) {
    paths.add(match[1]!);
  }
  return paths;
}
