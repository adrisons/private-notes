import { marked } from "marked";

/**
 * Convert markdown into the HTML representation Tiptap consumes via
 * `setContent`. We intentionally pass through inline HTML (so `<u>...</u>`
 * survives) but disable mangle/header IDs to keep the output predictable.
 *
 * marked wraps standalone `![alt](src)` lines in a `<p>`. We unwrap them so
 * Tiptap picks them up as block-level `attachmentImage` nodes rather than
 * inline images inside a paragraph.
 */
export function markdownToHtml(md: string): string {
  marked.setOptions({
    gfm: true,
    breaks: false,
  });
  const html = marked.parse(md, { async: false }) as string;
  return html.replace(
    /<p>\s*(<img\b[^>]*\/?>)\s*<\/p>/g,
    "$1",
  );
}
