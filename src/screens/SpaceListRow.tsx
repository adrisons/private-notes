import { forwardRef, type CSSProperties } from "react";
import {
  SidebarListRowButton,
  SidebarListRowCheckbox,
  SidebarListRowItem,
} from "../ui/SidebarListRow";
import { spaceDotStyle } from "../ui/space-colors";
import type { SpaceListItem } from "../application/view-models";

export const SPACE_LIST_ROW_HEIGHT = 72;

const DESCRIPTION_LIMIT = 96;

function truncateDescription(text: string): string {
  if (text.length <= DESCRIPTION_LIMIT) return text;
  return `${text.slice(0, DESCRIPTION_LIMIT - 1).trimEnd()}…`;
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
      <SidebarListRowItem style={style} className={className}>
        <SidebarListRowButton
          ref={ref}
          kind="space"
          selected={selected}
          checked={checked}
          selectionMode={selectionMode}
          selectable={selectable}
          fillHeight
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
        >
          <div className="flex items-start gap-3">
            {selectionMode && selectable ? (
              <SidebarListRowCheckbox checked={checked} />
            ) : null}
            <span
              aria-hidden
              className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-[var(--radius-full)]"
              style={spaceDotStyle(space.colorId)}
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
        </SidebarListRowButton>
      </SidebarListRowItem>
    );
  },
);

SpaceListRow.displayName = "SpaceListRow";
