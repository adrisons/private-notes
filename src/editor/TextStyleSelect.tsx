import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import { cn } from "../lib/cn";
import { Tooltip } from "../ui/Tooltip";

export const HEADING_LEVELS = [1, 2, 3, 4, 5] as const;
export type HeadingLevel = (typeof HEADING_LEVELS)[number];
export type TextStyleValue = "text" | `${HeadingLevel}`;

const OPTIONS: { value: TextStyleValue; label: string }[] = [
  { value: "text", label: "Paragraph" },
  ...HEADING_LEVELS.map((level) => ({
    value: String(level) as TextStyleValue,
    label: `Heading ${level}`,
  })),
];

function readActiveStyle(editor: Editor): TextStyleValue {
  for (const level of HEADING_LEVELS) {
    if (editor.isActive("heading", { level })) {
      return String(level) as TextStyleValue;
    }
  }
  return "text";
}

interface TextStyleSelectProps {
  editor: Editor | null;
}

export function TextStyleSelect({ editor }: TextStyleSelectProps) {
  const [value, setValue] = useState<TextStyleValue>("text");

  useEffect(() => {
    if (!editor) {
      setValue("text");
      return;
    }

    const sync = () => setValue(readActiveStyle(editor));
    sync();
    editor.on("selectionUpdate", sync);
    editor.on("transaction", sync);
    return () => {
      editor.off("selectionUpdate", sync);
      editor.off("transaction", sync);
    };
  }, [editor]);

  return (
    // A pill with its own chevron: the native arrow cannot be tokenized, and
    // the default control reads as a form field in a toolbar of soft buttons.
    <Tooltip label="Paragraph style">
    <span className="gesture-select relative inline-flex items-center">
      <select
      aria-label="Paragraph style"
      disabled={!editor}
      value={value}
      onChange={(event) => {
        if (!editor) return;
        const next = event.target.value as TextStyleValue;
        if (next === "text") {
          editor.chain().focus().setParagraph().run();
        } else {
          editor
            .chain()
            .focus()
            .setHeading({ level: Number(next) as HeadingLevel })
            .run();
        }
        setValue(next);
      }}
      className={cn(
        "u-press u-focus h-9 max-w-[8.5rem] cursor-pointer appearance-none max-md:h-11",
        "rounded-[var(--radius-full)] border border-[var(--border)] bg-[var(--surface)]",
        "py-0 pl-3 pr-7 text-sm font-medium text-[var(--foreground)]",
        "hover:border-[var(--border-strong)] hover:bg-[var(--accent-soft)]",
        "hover:text-[var(--accent-soft-foreground)]",
        "disabled:cursor-not-allowed disabled:opacity-40",
      )}
    >
      {OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
      </select>
      <svg
        aria-hidden
        className="gesture-icon pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-[var(--foreground-muted)]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </span>
    </Tooltip>
  );
}
