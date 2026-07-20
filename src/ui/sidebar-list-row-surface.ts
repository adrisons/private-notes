import { cn } from "../lib/cn";

export type SidebarListRowKind = "note" | "space";

export interface SidebarListRowSurfaceState {
  kind: SidebarListRowKind;
  selected: boolean;
  checked: boolean;
  selectionMode: boolean;
  /** When false (e.g. General space), the row is visible but not interactive. */
  selectable?: boolean;
}

const restingCard =
  "bg-[var(--surface-raised)] shadow-[var(--shadow-rest)]";

/** Card surface for sidebar note/space rows — one resting look, two selected accents. */
export function sidebarListRowSurfaceClass({
  kind,
  selected,
  checked,
  selectionMode,
  selectable = true,
}: SidebarListRowSurfaceState): string {
  if (selectionMode) {
    if (!selectable) {
      return cn(restingCard, "cursor-default opacity-70");
    }
    if (checked) {
      return "bg-[var(--accent-soft)] ring-1 ring-[var(--accent)]/30";
    }
    return restingCard;
  }

  if (selected) {
    if (kind === "note") {
      return restingCard;
    }
    return "bg-[var(--accent-soft)] shadow-[var(--shadow-rest)] ring-1 ring-[var(--accent)]/30";
  }

  return restingCard;
}
