import { forwardRef, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from "react";
import { cn } from "../lib/cn";
import {
  sidebarListRowSurfaceClass,
  type SidebarListRowKind,
} from "./sidebar-list-row-surface";

export type { SidebarListRowKind, SidebarListRowSurfaceState } from "./sidebar-list-row-surface";

const sidebarListRowButtonBase =
  "gesture-annotate u-press u-lift u-focus-inset w-full cursor-pointer " +
  "rounded-[var(--radius-md)] px-3.5 py-3.5 text-left max-md:min-h-[var(--hit-touch)]";

export interface SidebarListRowButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  kind: SidebarListRowKind;
  selected: boolean;
  checked: boolean;
  selectionMode: boolean;
  selectable?: boolean;
  /** Swipe-reveal panel in the note list on touch devices. */
  swipePanel?: boolean;
  /** Space rows fill the virtualized row height. */
  fillHeight?: boolean;
}

export const SidebarListRowButton = forwardRef<
  HTMLButtonElement,
  SidebarListRowButtonProps
>(function SidebarListRowButton(
  {
    kind,
    selected,
    checked,
    selectionMode,
    selectable = true,
    swipePanel = false,
    fillHeight = false,
    className,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        sidebarListRowButtonBase,
        fillHeight && "h-full",
        swipePanel && "u-swipe-panel",
        sidebarListRowSurfaceClass({
          kind,
          selected,
          checked,
          selectionMode,
          selectable,
        }),
        className,
      )}
      {...props}
    />
  );
});

export interface SidebarListRowCheckboxProps {
  checked: boolean;
  className?: string;
}

export function SidebarListRowCheckbox({
  checked,
  className,
}: SidebarListRowCheckboxProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border",
        checked
          ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
          : "border-[var(--border-strong)] bg-[var(--surface)]",
        className,
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
  );
}

export interface SidebarListRowItemProps {
  style?: CSSProperties;
  className?: string;
  children: ReactNode;
}

/** Shared list item shell for sidebar note/space rows. */
export function SidebarListRowItem({
  style,
  className,
  children,
}: SidebarListRowItemProps) {
  return (
    <li style={style} className={cn("rounded-[var(--radius-md)]", className)}>
      {children}
    </li>
  );
}
