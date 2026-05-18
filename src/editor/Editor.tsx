import { useEditor, EditorContent, type Editor as TiptapEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { useEffect, useMemo } from "react";
import { markdownToHtml } from "../lib/markdown/parse";
import { serializeDoc } from "../lib/markdown/serialize";
import type { PMDoc } from "../lib/markdown/types";
import { EditorToolbar } from "./EditorToolbar";

interface EditorProps {
  /** Initial markdown content. Re-applied when this value changes. */
  value: string;
  onChange?: (markdown: string) => void;
}

export function Editor({ value, onChange }: EditorProps) {
  const html = useMemo(() => markdownToHtml(value), [value]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // We do not yet support headings/lists/code blocks. Disable the
        // toolbar-less keyboard shortcuts so users do not produce nodes the
        // serializer cannot round-trip yet.
        heading: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Underline,
    ],
    content: html,
    onUpdate: ({ editor }) => {
      onChange?.(serializeDoc(editor.getJSON() as PMDoc));
    },
    editorProps: {
      attributes: {
        class:
          "prose-like outline-none px-6 py-8 max-w-3xl mx-auto min-h-[60vh]",
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

  return (
    <div className="flex h-full flex-col">
      <EditorToolbar editor={editor ?? null} />
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

export type { TiptapEditor };
