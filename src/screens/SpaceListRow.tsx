import { forwardRef, type CSSProperties } from "react";
import { cn } from "../lib/cn";
import type { SpaceColorId } from "../domain";
import type { SpaceListItem } from "../application/view-models";

export const SPACE_LIST_ROW_HEIGHT = 72;

const DESCRIPTION_LIMIT = 96;

function truncateDescription(text: string): string {
  if (text.length <= DESCRIPTION_LIMIT) return text;
  return `${text.slice(0, DESCRIPTION_LIMIT - 1).trimEnd()}…`;
}

function dotStyle(colorId: SpaceColorId | null): CSSProperties {
  if (colorId === null) {
    return { backgroundColor: "var(--surface-sunken)" };
  }
  return { backgroundColor: `var(--chip-${colorId}-fg)` };
}

export interface SpaceListRowProps {
  space: SpaceListItem;
  selected: boolean;
  checked: boolean;
  selectionMode: boolean;
  selectable: boolean;
  focused: boolean;
  onSelect: () => void;
  onToggleCheck: (shiftKey: boolean) => void;
  onFocus: () => void;
  style?: CSSProperties;
  className?: string;
}

export const SpaceListRow = forwardRef<HTMLButtonElement, SpaceListRowProps>(
  function SpaceListRow(
    {
      space,
      selected,
      checked,
      selectionMode,
      selectable,
      focused,
      onSelect,
      onToggleCheck,
      onFocus,
      style,
      className,
    },
    ref,
  ) {
    const noteLabel = space.noteCount === 1 ? "note" : "notes";

    return (
      <li
        style={style}
        className={cn("rounded-[var(--radius-md)]", className)}
      >
        <button
          ref={ref}
          type="button"
          role={selectionMode && selectable ? "checkbox" : undefined}
          aria-checked={selectionMode && selectable ? checked : undefined}
          aria-current={!selectionMode && selected ? "true" : undefined}
          aria-label={
            selectionMode && selectable
              ? `${checked ? "Deselect" : "Select"} ${space.name}`
              : `Open ${space.name}`
          }
          tabIndex={focused ? 0 : -1}
          onFocus={onFocus}
          onClick={(event) => {
            if (selectionMode && selectable) {
              onToggleCheck(event.shiftKey);
              return;
            }
            if (!selectionMode) onSelect();
          }}
          className={cn(
            "gesture-annotate u-press u-lift u-focus h-full w-full cursor-pointer overflow-hidden",
            "rounded-[var(--radius-md)] px-3.5 py-3 text-left max-md:min-h-[var(--hit-touch)]",
            "hover:bg-[var(--surface-raised)]",
            selectionMode &&
              selectable &&
              checked &&
              "bg-[var(--accent-soft)] ring-1 ring-[var(--accent)]/30",
            !selectionMode &&
              selected &&
              "bg-[var(--accent-soft)] ring-1 ring-[var(--accent)]/30",
            !selectionMode && !selected && "bg-[var(--canvas)]",
            selectionMode && selectable && !checked && "bg-[var(--canvas)]",
            selectionMode && !selectable && "cursor-default opacity-70",
          )}
        >
          <div className="flex items-start gap-3">
            {selectionMode && selectable ? (
              <span
                aria-hidden
                className={cn(
                  "mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border",
                  checked
                    ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                    : "border-[var(--border-strong)] bg-[var(--surface)]",
                )}
              >
                {checked ? (
                  <svg
                    className="h-2.5 w-2.5"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M2.5 6.5 5 9l4.5-6" />
                  </svg>
                ) : null}
              </span>
            ) : null}
            <span
              aria-hidden
              className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-[var(--radius-full)]"
              style={dotStyle(space.colorId)}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-medium">{space.name}</span>
                <span className="shrink-0 text-xs tabular-nums text-[var(--foreground-muted)]">
                  {space.noteCount} {noteLabel}
                </span>
              </div>
              {space.description ? (
                <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-[var(--foreground-muted)]">
                  {truncateDescription(space.description)}
                </p>
              ) : null}
            </div>
          </div>
        </button>
      </li>
    );
  },
);

SpaceListRow.displayName = "SpaceListRow";
