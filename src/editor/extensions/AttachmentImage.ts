import { NodeSelection } from "@tiptap/pm/state";
import { Node, mergeAttributes, type Editor } from "@tiptap/core";
import {
  ReactNodeViewRenderer,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
import {
  createElement as h,
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type MouseEvent as ReactMouseEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ChangeEvent as ReactChangeEvent,
} from "react";
import {
  ATTACHMENT_IMAGE_MAX_WIDTH,
  clampAttachmentImageWidth,
} from "../attachment-image-size";
import { cn } from "../../lib/cn";

/**
 * Block-level image node. Cannot live inside a paragraph, which prevents the
 * surrounding text from being reflowed around the image.
 *
 * Markdown representation is `![alt](src)` or, when resized,
 * `<img src="..." alt="..." width="N">`. The stored `src` is a relative path
 * (`attachments/<sha256>.<ext>`) that the browser cannot fetch on its own —
 * the host app injects `resolveSrc` to map the path to a usable `blob:` URL.
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
      width: {
        default: null,
        parseHTML: (element) => {
          const raw = element.getAttribute("width");
          if (!raw) return null;
          const parsed = Number.parseInt(raw, 10);
          return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
        },
        renderHTML: (attributes) => {
          if (!attributes.width) return {};
          return { width: attributes.width };
        },
      },
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

  addNodeView() {
    return ReactNodeViewRenderer(AttachmentImageView);
  },

  addKeyboardShortcuts() {
    const deleteSelectedImage = ({ editor }: { editor: Editor }) => {
      const { selection } = editor.state;
      if (
        !(selection instanceof NodeSelection) ||
        selection.node.type.name !== this.name
      ) {
        return false;
      }
      return editor.commands.deleteSelection();
    };

    return {
      Backspace: deleteSelectedImage,
      Delete: deleteSelectedImage,
    };
  },
});

function AttachmentImageView({
  node,
  extension,
  editor,
  getPos,
  selected,
  updateAttributes,
}: NodeViewProps) {
  const src: string = node.attrs.src ?? "";
  const alt: string = node.attrs.alt ?? "";
  const width: number | null = node.attrs.width ?? null;
  const figureRef = useRef<HTMLElement>(null);
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

  const onFigureClick = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      // Clicks land on the inner img; explicitly select the atom so Backspace
      // / Delete remove the whole attachment, not adjacent text.
      event.preventDefault();
      const pos = getPos();
      if (typeof pos !== "number") return;
      editor.chain().focus().setNodeSelection(pos).run();
    },
    [editor, getPos],
  );

  const onResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();

      const figure = figureRef.current;
      if (!figure) return;

      const startX = event.clientX;
      const startWidth = width ?? figure.getBoundingClientRect().width;
      const maxWidth =
        figure.parentElement?.clientWidth ?? ATTACHMENT_IMAGE_MAX_WIDTH;

      const onPointerMove = (moveEvent: PointerEvent) => {
        const next = clampAttachmentImageWidth(
          startWidth + (moveEvent.clientX - startX),
          maxWidth,
        );
        updateAttributes({ width: next });
      };

      const onPointerUp = () => {
        document.removeEventListener("pointermove", onPointerMove);
        document.removeEventListener("pointerup", onPointerUp);
      };

      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", onPointerUp);
    },
    [updateAttributes, width],
  );

  const onResizeKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      event.stopPropagation();

      const figure = figureRef.current;
      if (!figure) return;

      const maxWidth =
        figure.parentElement?.clientWidth ?? ATTACHMENT_IMAGE_MAX_WIDTH;
      const current = width ?? figure.getBoundingClientRect().width;
      const delta = event.key === "ArrowRight" ? 16 : -16;
      updateAttributes({
        width: clampAttachmentImageWidth(current + delta, maxWidth),
      });
    },
    [updateAttributes, width],
  );

  const imgStyle =
    width !== null ? { width: `${width}px`, maxWidth: "100%" } : undefined;

  return h(
    NodeViewWrapper,
    {
      as: "figure",
      className: cn(
        "attachment-figure",
        selected && "attachment-figure--selected",
      ),
      ref: figureRef,
      onClick: onFigureClick,
      "data-selected": selected ? "true" : undefined,
    },
    resolved
      ? h("img", {
          src: resolved,
          alt,
          loading: "lazy",
          draggable: false,
          style: imgStyle,
          className: width === null ? "attachment-image--default-size" : undefined,
        })
      : h(
          "div",
          {
            className: "attachment-placeholder",
            role: "img",
            "aria-label": alt || "Attachment",
          },
          error ? `Could not load: ${error}` : "Loading image…",
        ),
    selected && resolved
      ? h("button", {
          type: "button",
          className: "attachment-resize-handle",
          "aria-label": "Resize image",
          contentEditable: false,
          onPointerDown: onResizePointerDown,
          onKeyDown: onResizeKeyDown,
        })
      : null,
    selected && resolved
      ? h(
          "label",
          {
            className: "attachment-alt-field",
            contentEditable: false,
          },
          h("span", { className: "sr-only" }, "Image description"),
          h("input", {
            type: "text",
            value: alt,
            placeholder: "Describe image (optional)",
            "aria-label": "Image description",
            onChange: (event: ReactChangeEvent<HTMLInputElement>) => {
              updateAttributes({ alt: event.target.value });
            },
            onKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => {
              event.stopPropagation();
            },
          }),
        )
      : null,
  );
}
