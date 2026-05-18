import type { Editor } from "@tiptap/react";
import { cn } from "../lib/cn";

interface ToolbarProps {
  editor: Editor | null;
}

interface Action {
  name: "bold" | "italic" | "underline" | "strike";
  label: string;
  shortcut: string;
  toggle: (e: Editor) => boolean;
}

const ACTIONS: Action[] = [
  {
    name: "bold",
    label: "B",
    shortcut: "⌘B",
    toggle: (e) => e.chain().focus().toggleBold().run(),
  },
  {
    name: "italic",
    label: "I",
    shortcut: "⌘I",
    toggle: (e) => e.chain().focus().toggleItalic().run(),
  },
  {
    name: "underline",
    label: "U",
    shortcut: "⌘U",
    toggle: (e) => e.chain().focus().toggleUnderline().run(),
  },
  {
    name: "strike",
    label: "S",
    shortcut: "⇧⌘X",
    toggle: (e) => e.chain().focus().toggleStrike().run(),
  },
];

export function EditorToolbar({ editor }: ToolbarProps) {
  return (
    <div className="flex items-center gap-1 border-b border-[var(--color-border)] px-3 py-2">
      {ACTIONS.map((a) => {
        const active = editor?.isActive(a.name) ?? false;
        return (
          <button
            key={a.name}
            type="button"
            aria-pressed={active}
            aria-label={`${a.name} (${a.shortcut})`}
            title={`${a.name} (${a.shortcut})`}
            disabled={!editor}
            onClick={() => editor && a.toggle(editor)}
            className={cn(
              "h-8 w-8 rounded-md text-sm font-medium",
              "hover:bg-[var(--color-muted)]",
              active && "bg-[var(--color-muted)]",
              a.name === "italic" && "italic",
              a.name === "underline" && "underline",
              a.name === "strike" && "line-through",
              a.name === "bold" && "font-bold",
              "disabled:opacity-40",
            )}
          >
            {a.label}
          </button>
        );
      })}
    </div>
  );
}
