import { useEffect, useRef } from "react";
import { cn } from "../lib/cn";

export interface ContextMenuItem {
  label: string;
  onSelect: () => void;
  destructive?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="menu"
      className="u-enter-panel fixed z-50 min-w-44 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-raised)] py-1.5 shadow-[var(--shadow-overlay)]"
      style={{ left: x, top: y }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          className={cn(
            "u-press flex w-full cursor-pointer px-3 py-2.5 text-left text-sm",
            "focus-visible:outline-none focus-visible:bg-[var(--surface)]",
            item.destructive
              ? "gesture-danger text-[var(--danger)]"
              : "text-[var(--foreground)] hover:bg-[var(--surface)]",
          )}
          onClick={() => {
            item.onSelect();
            onClose();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
