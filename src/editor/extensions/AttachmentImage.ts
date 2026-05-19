import { Node, mergeAttributes } from "@tiptap/core";
import {
  ReactNodeViewRenderer,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
import { createElement as h, useEffect, useState } from "react";

/**
 * Block-level image node. Always full-width; cannot live inside a paragraph,
 * which prevents the surrounding text from being reflowed around the image.
 *
 * Markdown representation is `![alt](src)` rendered as its own paragraph. The
 * stored `src` is a relative path (`attachments/<noteId>/<sha1>.<ext>`) that
 * the browser cannot fetch on its own — the host app injects `resolveSrc` to
 * map the path to a usable `blob:` URL backed by the vault file handle.
 */
export interface AttachmentImageOptions {
  resolveSrc: (src: string) => Promise<string | null>;
}

export const AttachmentImage = Node.create<AttachmentImageOptions>({
  name: "attachmentImage",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addOptions() {
    return {
      resolveSrc: async (src: string) => src,
    };
  },

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: "img[src]" }];
  },

  renderHTML({ HTMLAttributes }) {
    // Used when the editor falls back to non-React HTML rendering (e.g.
    // copy-paste, .getHTML()). The interactive NodeView below covers the
    // common case of editing inside the app.
    return [
      "figure",
      { class: "attachment-figure" },
      ["img", mergeAttributes(HTMLAttributes, { loading: "lazy" })],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(AttachmentImageView);
  },
});

function AttachmentImageView({ node, extension }: NodeViewProps) {
  const src: string = node.attrs.src ?? "";
  const alt: string = node.attrs.alt ?? "";
  const [resolved, setResolved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!src) return;
    let cancelled = false;
    setError(null);
    setResolved(null);
    const options = extension.options as AttachmentImageOptions;
    options
      .resolveSrc(src)
      .then((url) => {
        if (!cancelled) setResolved(url ?? null);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [src, extension]);

  return h(
    NodeViewWrapper,
    { as: "figure", className: "attachment-figure" },
    resolved
      ? h("img", { src: resolved, alt, loading: "lazy" })
      : h(
          "div",
          {
            className: "attachment-placeholder",
            role: "img",
            "aria-label": alt || "Attachment",
          },
          error ? `Could not load: ${error}` : "Loading image…",
        ),
  );
}
