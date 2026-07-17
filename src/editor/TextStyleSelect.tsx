import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import { cn } from "../lib/cn";

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
    <select
      aria-label="Paragraph style"
      title="Paragraph style"
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
        "h-8 max-w-[8.5rem] rounded-md border border-[var(--color-border)] bg-[var(--color-background)]",
        "px-2 text-sm text-[var(--color-foreground)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]",
        "focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)]",
        "disabled:cursor-not-allowed disabled:opacity-40",
      )}
    >
      {OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
