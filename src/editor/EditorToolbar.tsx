import type { Editor } from "@tiptap/react";
import { cn } from "../lib/cn";
import { TextStyleSelect } from "./TextStyleSelect";

interface ToolbarProps {
  editor: Editor | null;
  onPickImage?: (file: File) => void | Promise<void>;
}

interface MarkAction {
  name: "bold" | "italic" | "underline" | "strike" | "codeBlock";
  label: string;
  shortcut: string;
  mono?: boolean;
  isActive: (editor: Editor) => boolean;
  run: (editor: Editor) => boolean;
}

interface BlockAction {
  name: string;
  label: string;
  shortcut: string;
  mono?: boolean;
  isActive: (editor: Editor) => boolean;
  run: (editor: Editor) => boolean;
}

const MARK_ACTIONS: MarkAction[] = [
  {
    name: "bold",
    label: "B",
    shortcut: "⌘B",
    isActive: (e) => e.isActive("bold"),
    run: (e) => e.chain().focus().toggleBold().run(),
  },
  {
    name: "italic",
    label: "I",
    shortcut: "⌘I",
    isActive: (e) => e.isActive("italic"),
    run: (e) => e.chain().focus().toggleItalic().run(),
  },
  {
    name: "underline",
    label: "U",
    shortcut: "⌘U",
    isActive: (e) => e.isActive("underline"),
    run: (e) => e.chain().focus().toggleUnderline().run(),
  },
  {
    name: "strike",
    label: "S",
    shortcut: "⇧⌘X",
    isActive: (e) => e.isActive("strike"),
    run: (e) => e.chain().focus().toggleStrike().run(),
  },
  {
    name: "codeBlock",
    label: "{ }",
    shortcut: "⌥⌘C",
    mono: true,
    isActive: (e) => e.isActive("codeBlock"),
    run: (e) => e.chain().focus().toggleCodeBlock().run(),
  },
];

const BLOCK_ACTIONS: BlockAction[] = [
  {
    name: "bulletList",
    label: "•",
    shortcut: "⇧⌘8",
    isActive: (e) => e.isActive("bulletList"),
    run: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    name: "orderedList",
    label: "1.",
    shortcut: "⇧⌘7",
    mono: true,
    isActive: (e) => e.isActive("orderedList"),
    run: (e) => e.chain().focus().toggleOrderedList().run(),
  },
  {
    name: "blockquote",
    label: "❝",
    shortcut: "⇧⌘B",
    isActive: (e) => e.isActive("blockquote"),
    run: (e) => e.chain().focus().toggleBlockquote().run(),
  },
  {
    name: "horizontalRule",
    label: "—",
    shortcut: "---",
    isActive: (e) => e.isActive("horizontalRule"),
    run: (e) => e.chain().focus().setHorizontalRule().run(),
  },
];

function ToolbarButton({
  label,
  name,
  shortcut,
  active,
  disabled,
  mono,
  onClick,
}: {
  label: string;
  name: string;
  shortcut: string;
  active: boolean;
  disabled: boolean;
  mono?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={`${name} (${shortcut})`}
      title={`${name} (${shortcut})`}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-8 min-w-8 rounded-md px-2 text-sm font-medium",
        "hover:bg-[var(--color-muted)]",
        active && "bg-[var(--color-muted)]",
        name === "italic" && "italic",
        name === "underline" && "underline",
        name === "strike" && "line-through",
        name === "bold" && "font-bold",
        mono && "font-[family-name:var(--font-mono)] text-xs",
        "disabled:opacity-40",
      )}
    >
      {label}
    </button>
  );
}

export function EditorToolbar({ editor, onPickImage }: ToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-[var(--color-border)] px-3 py-2">
      <TextStyleSelect editor={editor} />

      <span
        aria-hidden
        className="mx-1 h-5 w-px bg-[var(--color-border)]"
      />

      {MARK_ACTIONS.map((action) => (
        <ToolbarButton
          key={action.name}
          label={action.label}
          name={action.name}
          shortcut={action.shortcut}
          active={editor ? action.isActive(editor) : false}
          disabled={!editor}
          mono={action.mono}
          onClick={() => editor && action.run(editor)}
        />
      ))}

      <span
        aria-hidden
        className="mx-1 h-5 w-px bg-[var(--color-border)]"
      />

      {BLOCK_ACTIONS.map((action) => (
        <ToolbarButton
          key={action.name}
          label={action.label}
          name={action.name}
          shortcut={action.shortcut}
          active={editor ? action.isActive(editor) : false}
          disabled={!editor}
          mono={action.mono}
          onClick={() => editor && action.run(editor)}
        />
      ))}

      {onPickImage ? (
        <label
          className={cn(
            "ml-2 inline-flex h-8 cursor-pointer items-center gap-1 rounded-md px-2 text-sm",
            "hover:bg-[var(--color-muted)]",
            !editor && "pointer-events-none opacity-40",
          )}
          aria-label="Insert image"
          title="Insert image"
        >
          <span aria-hidden>🖼</span>
          <span>Image</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onPickImage(file);
              e.currentTarget.value = "";
            }}
          />
        </label>
      ) : null}
    </div>
  );
}
