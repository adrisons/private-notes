import { useLayoutEffect, useRef } from "react";
import { Button } from "../ui/Button";

interface NoteHeaderProps {
  title: string;
  onTitleChange: (value: string) => void;
  onDelete: () => void;
  savedAt: string | null;
}

export function NoteHeader({
  title,
  onTitleChange,
  onDelete,
  savedAt,
}: NoteHeaderProps) {
  const titleRef = useRef<HTMLTextAreaElement>(null);

  /*
   * The title is a textarea, not an input: an input cannot wrap, so a long
   * title scrolled sideways inside its box and was clipped on narrow screens.
   * It stays a single logical line — newlines are stripped — and grows to fit
   * its content, like the note body it sits above.
   */
  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return;

    const fit = () => {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    };

    fit();
    if (typeof ResizeObserver === "undefined") return;
    // Re-fit when the column width changes, not just when the text does.
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [title]);

  return (
    // Full width of its container: the title is the page, not a card in it.
    // Left padding matches the toolbar and the editor body so the three line up.
    <div className="w-full px-5 pt-8 sm:px-6 sm:pt-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-medium text-[var(--foreground-subtle)]">
          {savedAt ? `Saved ${new Date(savedAt).toLocaleTimeString()}` : ""}
        </span>
        {/* Destructive: same shape as any other button, danger tint on hover. */}
        <Button size="sm" variant="danger" onClick={onDelete}>
          Delete
        </Button>
      </div>
      <textarea
        ref={titleRef}
        rows={1}
        value={title}
        onChange={(e) => onTitleChange(e.target.value.replace(/\n/g, " "))}
        onKeyDown={(e) => {
          // Enter belongs to the body, never to the title.
          if (e.key === "Enter") e.preventDefault();
        }}
        placeholder="Untitled"
        aria-label="Note title"
        className="mt-4 w-full resize-none overflow-hidden break-words bg-transparent text-3xl font-semibold tracking-tight outline-none placeholder:text-[var(--foreground-subtle)]"
      />
    </div>
  );
}
