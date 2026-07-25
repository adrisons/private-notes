/** Matches `![alt](attachments/...)` image references in note markdown. */
import { isSafeRelativePath } from "../fs/handle";

const ATTACHMENT_PATH_RE = /!\[[^\]]*\]\((attachments\/[^)]+)\)/g;

/** Collect unique attachment paths referenced in a markdown body. */
export function extractAttachmentPaths(markdown: string): Set<string> {
  const paths = new Set<string>();
  for (const match of markdown.matchAll(ATTACHMENT_PATH_RE)) {
    const path = match[1]!;
    if (isSafeRelativePath(path)) {
      paths.add(path);
    }
  }
  return paths;
}
