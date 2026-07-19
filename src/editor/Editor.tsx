import { useEditor, EditorContent, type Editor as TiptapEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { AttachmentImage } from "./extensions/AttachmentImage";
import { FencedCodeBlock } from "./extensions/FencedCodeBlock";
import { useEffect, useMemo } from "react";
import { markdownToHtml } from "../infrastructure/markdown/parse";
import { serializeDoc } from "../infrastructure/markdown/serialize";
import type { PMDoc } from "../infrastructure/markdown/types";
import { EditorToolbar } from "./EditorToolbar";

interface EditorProps {
  /** Initial markdown content. Re-applied when this value changes. */
  value: string;
  onChange?: (markdown: string) => void;
  /**
   * Asynchronously upload an image and return the relative `src` to insert as
   * a block-level image. The caller persists the file into the vault.
   */
  onUploadImage?: (file: File) => Promise<string>;
  /**
   * Resolve a relative attachment path into a URL the browser can load
   * (usually a `blob:` URL backed by the vault file handle).
   */
  resolveImageSrc?: (src: string) => Promise<string | null>;
}

export function Editor({
  value,
  onChange,
  onUploadImage,
  resolveImageSrc,
}: EditorProps) {
  const html = useMemo(() => markdownToHtml(value), [value]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        heading: { levels: [1, 2, 3, 4, 5] },
      }),
      FencedCodeBlock,
      Underline,
      AttachmentImage.configure({
        resolveSrc: resolveImageSrc ?? (async (s: string) => s),
      }),
    ],
    content: html,
    onUpdate: ({ editor }) => {
      onChange?.(serializeDoc(editor.getJSON() as PMDoc));
    },
    editorProps: {
      attributes: {
        // Left-aligned, not centered: the body shares the note header's left
        // edge. `--measure` still caps the line length for readability.
        class:
          "prose-like outline-none px-5 sm:px-6 py-8 max-w-[var(--measure)] min-h-[60vh]",
      },
    },
  });

  // Replace content if the source markdown changes from outside (e.g. on
  // switching notes). Avoid the round-trip while the user is typing.
  useEffect(() => {
    if (!editor) return;
    const current = serializeDoc(editor.getJSON() as PMDoc);
    if (current !== value) {
      editor.commands.setContent(html, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, editor]);

  const insertImage = async (file: File) => {
    if (!editor || !onUploadImage) return;
    const src = await onUploadImage(file);
    editor
      .chain()
      .focus()
      .insertContent({
        type: "attachmentImage",
        attrs: { src, alt: file.name },
      })
      .run();
  };

  return (
    <div className="flex h-full flex-col">
      <EditorToolbar
        editor={editor ?? null}
        onPickImage={onUploadImage ? insertImage : undefined}
      />
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

export type { TiptapEditor };
