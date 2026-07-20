import { useLayoutEffect, useRef } from "react";
import { Button } from "../ui/Button";
import type { SpaceColorId, SpaceId } from "../domain";
import type { SpaceListItem } from "../application/view-models";
import { SpaceTagsEditor } from "./SpaceTagsEditor";

interface NoteHeaderProps {
  title: string;
  spaceIds: SpaceId[];
  spaces: SpaceListItem[];
  onTitleChange: (value: string) => void;
  onSpacesChange: (spaceIds: SpaceId[]) => void;
  onCreateSpace: (input: {
    name: string;
    colorId: SpaceColorId;
    description?: string;
  }) => Promise<SpaceId | null>;
  onDelete: () => void;
  savedAt: string | null;
  isSaving?: boolean;
}

export function NoteHeader({
  title,
  spaceIds,
  spaces,
  onTitleChange,
  onSpacesChange,
  onCreateSpace,
  onDelete,
  savedAt,
  isSaving = false,
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

  const saveStatus = isSaving
    ? "Saving…"
    : savedAt
      ? `Saved ${new Date(savedAt).toLocaleTimeString()}`
      : "";

  return (
    // Full width of its container: the title is the page, not a card in it.
    // Left padding matches the toolbar and the editor body so the three line up.
    <div className="w-full px-5 pt-8 sm:px-6 sm:pt-10">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <span
          aria-live="polite"
          aria-atomic="true"
          className="mr-auto text-xs font-medium text-[var(--foreground-muted)]"
        >
          {saveStatus}
        </span>
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
        className="u-focus mt-4 w-full resize-none overflow-hidden break-words bg-transparent text-3xl font-semibold tracking-tight placeholder:text-[var(--foreground-subtle)]"
      />
      <div className="relative z-30 mt-3 pb-1">
        <SpaceTagsEditor
          spaces={spaces}
          value={spaceIds}
          onChange={(ids) => void onSpacesChange(ids)}
          onCreateSpace={async (name) =>
            onCreateSpace({ name, colorId: "blue" })
          }
        />
      </div>
    </div>
  );
}
