import { marked } from "marked";

/**
 * Convert markdown into the HTML representation Tiptap consumes via
 * `setContent`. We intentionally pass through inline HTML (so `<u>...</u>`
 * survives) but disable mangle/header IDs to keep the output predictable.
 */
export function markdownToHtml(md: string): string {
  marked.setOptions({
    gfm: true,
    breaks: false,
  });
  // marked.parse can be sync or async depending on config; we force sync.
  return marked.parse(md, { async: false }) as string;
}
