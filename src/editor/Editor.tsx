import { useEditor, EditorContent, type Editor as TiptapEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { AttachmentImage } from "./extensions/AttachmentImage";
import { ArrowSubstitutions } from "./extensions/ArrowSubstitutions";
import { FencedCodeBlock } from "./extensions/FencedCodeBlock";
import { useEffect, useMemo, useRef } from "react";
import { markdownToHtml } from "../infrastructure/markdown/parse";
import { serializeDoc } from "../infrastructure/markdown/serialize";
import type { PMDoc } from "../infrastructure/markdown/types";
import { EditorToolbar } from "./EditorToolbar";
import { defaultAttachmentImageWidth } from "./attachment-image-size";
import {
  hasImageFilesInDataTransfer,
  imageFilesFromClipboard,
  imageFilesFromDataTransfer,
} from "./image-files";
import { insertAttachmentImages } from "./insert-attachment-images";

interface EditorProps {
  /** Drives autofocus when the open note changes. */
  noteId: string;
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
  noteId,
  value,
  onChange,
  onUploadImage,
  resolveImageSrc,
}: EditorProps) {
  const html = useMemo(() => markdownToHtml(value), [value]);
  const onUploadImageRef = useRef(onUploadImage);
  onUploadImageRef.current = onUploadImage;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        heading: { levels: [1, 2, 3, 4, 5] },
      }),
      FencedCodeBlock,
      ArrowSubstitutions,
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
      handleDrop(view, event, _slice, moved) {
        if (moved || !onUploadImageRef.current) return false;

        const files = imageFilesFromDataTransfer(event.dataTransfer);
        if (files.length === 0) return false;

        event.preventDefault();

        const coords = view.posAtCoords({
          left: event.clientX,
          top: event.clientY,
        });
        const insertPos = coords?.pos ?? view.state.selection.from;

        void insertAttachmentImages(
          view,
          files,
          onUploadImageRef.current,
          insertPos,
        );

        return true;
      },
      handlePaste(view, event) {
        if (!onUploadImageRef.current) return false;

        const files = imageFilesFromClipboard(event.clipboardData);
        if (files.length === 0) return false;

        event.preventDefault();
        void insertAttachmentImages(view, files, onUploadImageRef.current);
        return true;
      },
      handleDOMEvents: {
        dragover(_view, event) {
          if (!onUploadImageRef.current) return false;
          const dataTransfer = event.dataTransfer;
          if (!dataTransfer || !hasImageFilesInDataTransfer(dataTransfer)) {
            return false;
          }
          event.preventDefault();
          dataTransfer.dropEffect = "copy";
          return true;
        },
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

  // AppShell focuses the main landmark when the note changes; defer so the
  // caret lands in the editor surface instead.
  useEffect(() => {
    if (!editor) return;
    const timeout = window.setTimeout(() => {
      editor.commands.focus("start");
    }, 0);
    return () => clearTimeout(timeout);
  }, [editor, noteId]);

  const insertImage = async (file: File) => {
    if (!editor || !onUploadImage) return;
    const [src, width] = await Promise.all([
      onUploadImage(file),
      defaultAttachmentImageWidth(file),
    ]);
    editor
      .chain()
      .focus()
      .insertContent({
        type: "attachmentImage",
        attrs: { src, alt: file.name, width },
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
