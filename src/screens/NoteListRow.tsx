import { forwardRef, type CSSProperties, type MouseEvent } from "react";
import { Button } from "../ui/Button";
import { CondensedSpaceChips } from "../ui/CondensedSpaceChips";
import {
  SidebarListRowButton,
  SidebarListRowCheckbox,
  SidebarListRowItem,
} from "../ui/SidebarListRow";
import { cn } from "../lib/cn";
import { useSwipeReveal } from "../lib/use-swipe-reveal";
import type { NoteListItem, SpaceChipDisplay } from "../application/view-models";

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
  spaceChips: SpaceChipDisplay[];
  selected: boolean;
  checked: boolean;
  selectionMode: boolean;
  focused: boolean;
  touchActionsEnabled: boolean;
  swipeOpen: boolean;
  onSwipeOpenChange: (open: boolean) => void;
  onSelect: () => void;
  onToggleCheck: (shiftKey: boolean) => void;
  onFocus: () => void;
  onContextMenu: (event: MouseEvent<HTMLButtonElement>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  formatRelative: (iso: string) => string;
  style?: CSSProperties;
  className?: string;
}

interface NoteRowContentProps {
  note: NoteListItem;
  spaceChips: SpaceChipDisplay[];
  selectionMode: boolean;
  checked: boolean;
  formatRelative: (iso: string) => string;
}

function NoteRowContent({
  note,
  spaceChips,
  selectionMode,
  checked,
  formatRelative,
}: NoteRowContentProps) {
  return (
    <div className="flex items-start gap-3">
      {selectionMode ? <SidebarListRowCheckbox checked={checked} /> : null}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-[var(--foreground)]">
          {note.title || "Untitled"}
        </div>
        <div className="mt-1 flex items-center gap-2">
          {spaceChips.length > 0 ? (
            <CondensedSpaceChips chips={spaceChips} />
          ) : (
            <span className="min-w-0 flex-1" aria-hidden />
          )}
          <span className="shrink-0 whitespace-nowrap text-xs text-[var(--foreground-muted)]">
            {formatRelative(note.updatedAt)}
          </span>
        </div>
      </div>
    </div>
  );
}

export const NoteListRow = forwardRef<HTMLButtonElement, NoteListRowProps>(
  function NoteListRow(
    {
      note,
      spaceChips,
      selected,
      checked,
      selectionMode,
      focused,
      touchActionsEnabled,
      swipeOpen,
      onSwipeOpenChange,
      onSelect,
      onToggleCheck,
      onFocus,
      onContextMenu,
      onDelete,
      onDuplicate,
      formatRelative,
      style,
      className,
    },
    ref,
  ) {
    const swipeEnabled = touchActionsEnabled && !selectionMode;
    const { offset, isDragging, close, bind } = useSwipeReveal({
      actionsWidth: NOTE_SWIPE_ACTIONS_WIDTH,
      enabled: swipeEnabled,
      open: swipeOpen,
      onOpenChange: onSwipeOpenChange,
    });

    const handleDuplicate = () => {
      close();
      onDuplicate();
    };

    const handleDelete = () => {
      close();
      onDelete();
    };

    const rowButton = (
      <SidebarListRowButton
        ref={ref}
        kind="note"
        selected={selected}
        checked={checked}
        selectionMode={selectionMode}
        fillHeight
        swipePanel={swipeEnabled}
        role={selectionMode ? "checkbox" : undefined}
        aria-checked={selectionMode ? checked : undefined}
        aria-current={!selectionMode && selected ? "true" : undefined}
        aria-label={
          selectionMode
            ? `${checked ? "Deselect" : "Select"} ${note.title || "Untitled"}`
            : undefined
        }
        tabIndex={focused ? 0 : -1}
        onFocus={onFocus}
        onClick={(event) => {
          if (swipeOpen) {
            close();
            return;
          }
          if (selectionMode) {
            onToggleCheck(event.shiftKey);
            return;
          }
          onSelect();
        }}
        onContextMenu={selectionMode ? undefined : onContextMenu}
        {...(swipeEnabled ? bind : {})}
        data-dragging={isDragging ? "true" : undefined}
        style={
          swipeEnabled ? { transform: `translateX(${offset}px)` } : undefined
        }
      >
        <NoteRowContent
          note={note}
          spaceChips={spaceChips}
          selectionMode={selectionMode}
          checked={checked}
          formatRelative={formatRelative}
        />
      </SidebarListRowButton>
    );

    return (
      <SidebarListRowItem style={style} className={className}>
        {swipeEnabled ? (
          <div className="u-swipe-row p-0.5">
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
            {rowButton}
          </div>
        ) : (
          rowButton
        )}
      </SidebarListRowItem>
    );
  },
);

NoteListRow.displayName = "NoteListRow";
