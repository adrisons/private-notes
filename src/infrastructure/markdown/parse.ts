import { marked } from "marked";
import DOMPurify from "dompurify";

/**
 * HTML the editor is allowed to render. This is an explicit allowlist that
 * mirrors the Tiptap schema (StarterKit nodes/marks + Underline +
 * `attachmentImage`). Tiptap already drops unknown nodes when it parses HTML,
 * but that is an implicit, schema-dependent defense. Notes are plain Markdown
 * files in a folder the user may sync across devices (e.g. Dropbox), so a
 * `.md` authored elsewhere is untrusted input. We sanitize here, at the
 * trust boundary, before the HTML ever reaches `setContent`.
 */
const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "del",
  "s",
  "u",
  "code",
  "pre",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "ul",
  "ol",
  "li",
  "blockquote",
  "hr",
  "img",
] as const;

// `src`/`alt` for images, `class` so fenced code keeps its `language-*` hint.
const ALLOWED_ATTR = ["src", "alt", "class"] as const;

/**
 * Convert markdown into the sanitized HTML representation Tiptap consumes via
 * `setContent`. Inline HTML in the source (e.g. `<u>...</u>`) survives only if
 * it is on the allowlist above; everything else — `<script>`, `<iframe>`,
 * event handlers, `javascript:` URLs — is stripped.
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
  const rawHtml = marked.parse(md, { async: false }) as string;
  const safeHtml = DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: [...ALLOWED_TAGS],
    ALLOWED_ATTR: [...ALLOWED_ATTR],
    // Relative attachment paths (`attachments/<sha256>.png`) and `blob:` URLs
    // resolved by the node view must pass; `javascript:`/`data:` are rejected
    // by DOMPurify's default URI policy.
    ALLOW_ARIA_ATTR: false,
    ALLOW_DATA_ATTR: false,
  });
  return safeHtml.replace(/<p>\s*(<img\b[^>]*\/?>)\s*<\/p>/g, "$1");
}
