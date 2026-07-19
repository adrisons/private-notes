import { forwardRef, type MouseEvent } from "react";
import { Button } from "../ui/Button";
import { cn } from "../lib/cn";
import { useSwipeReveal } from "../lib/use-swipe-reveal";
import type { NoteListItem } from "../application/view-models";

/** Two touch icon buttons, gap, and trailing padding — must match `.u-swipe-actions`. */
export const NOTE_SWIPE_ACTIONS_WIDTH = 104;

const iconButtonClass =
  "h-11 w-11 min-w-11 shrink-0 rounded-[var(--radius-full)] p-0";

const iconProps = {
  "aria-hidden": true as const,
  className: "gesture-icon h-4 w-4",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function DuplicateIcon() {
  return (
    <svg {...iconProps}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 7h16" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M10 11v6M14 11v6" />
      <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
    </svg>
  );
}

export interface NoteListRowProps {
  note: NoteListItem;
  selected: boolean;
  focused: boolean;
  touchActionsEnabled: boolean;
  swipeOpen: boolean;
  onSwipeOpenChange: (open: boolean) => void;
  onSelect: () => void;
  onFocus: () => void;
  onContextMenu: (event: MouseEvent<HTMLButtonElement>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  formatRelative: (iso: string) => string;
}

export const NoteListRow = forwardRef<HTMLButtonElement, NoteListRowProps>(
  function NoteListRow(
    {
      note,
      selected,
      focused,
      touchActionsEnabled,
      swipeOpen,
      onSwipeOpenChange,
      onSelect,
      onFocus,
      onContextMenu,
      onDelete,
      onDuplicate,
      formatRelative,
    },
    ref,
  ) {
    const { offset, isDragging, close, bind } = useSwipeReveal({
      actionsWidth: NOTE_SWIPE_ACTIONS_WIDTH,
      enabled: touchActionsEnabled,
      open: swipeOpen,
      onOpenChange: onSwipeOpenChange,
    });

    const handleSelectClick = () => {
      if (swipeOpen) {
        close();
        return;
      }
      onSelect();
    };

    const handleDuplicate = () => {
      close();
      onDuplicate();
    };

    const handleDelete = () => {
      close();
      onDelete();
    };

    return (
      <li className="u-swipe-row rounded-[var(--radius-md)]">
        <div
          className="u-swipe-actions u-touch-only items-center justify-end gap-1 pr-3"
          style={{ width: NOTE_SWIPE_ACTIONS_WIDTH }}
          aria-hidden={!swipeOpen}
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Duplicate note"
            onClick={handleDuplicate}
            className={cn(
              iconButtonClass,
              "hover:bg-[var(--accent-soft)] hover:text-[var(--accent-soft-foreground)]",
            )}
          >
            <DuplicateIcon />
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            aria-label="Delete note"
            onClick={handleDelete}
            className={iconButtonClass}
          >
            <DeleteIcon />
          </Button>
        </div>
        <button
          ref={ref}
          type="button"
          aria-current={selected ? "true" : undefined}
          tabIndex={focused ? 0 : -1}
          onFocus={onFocus}
          onClick={handleSelectClick}
          onContextMenu={onContextMenu}
          {...(touchActionsEnabled ? bind : {})}
          data-dragging={isDragging ? "true" : undefined}
          style={
            touchActionsEnabled
              ? { transform: `translateX(${offset}px)` }
              : undefined
          }
          className={cn(
            "u-swipe-panel gesture-annotate u-press u-lift u-focus w-full cursor-pointer overflow-hidden",
            "rounded-[var(--radius-md)] px-3.5 py-3 text-left max-md:min-h-[var(--hit-touch)]",
            "hover:bg-[var(--surface-raised)]",
            selected &&
              "bg-[var(--surface-raised)] shadow-[var(--shadow-rest)]",
            !selected && "bg-[var(--canvas)]",
          )}
        >
          <div className="truncate text-sm font-medium text-[var(--foreground)]">
            {note.title || "Untitled"}
          </div>
          <div className="mt-1 text-xs text-[var(--foreground-muted)]">
            {formatRelative(note.updatedAt)}
          </div>
        </button>
      </li>
    );
  },
);

NoteListRow.displayName = "NoteListRow";
