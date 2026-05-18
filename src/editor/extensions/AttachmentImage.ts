import { Node, mergeAttributes } from "@tiptap/core";

/**
 * Block-level image node. Always full-width; cannot live inside a paragraph,
 * which prevents the surrounding text from being reflowed around the image.
 *
 * Markdown representation is `![alt](src)` rendered as its own paragraph.
 */
export const AttachmentImage = Node.create({
  name: "attachmentImage",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

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
    return [
      "figure",
      { class: "attachment-figure" },
      ["img", mergeAttributes(HTMLAttributes, { loading: "lazy" })],
    ];
  },
});
