import { useEffect, useRef, useState, type RefObject } from "react";
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
  /** Element to restore focus to when the menu closes. */
  returnFocusRef?: RefObject<HTMLElement | null>;
}

export function ContextMenu({
  x,
  y,
  items,
  onClose,
  returnFocusRef,
}: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
    queueMicrotask(() => itemRefs.current[0]?.focus());
  }, [items]);

  useEffect(() => {
    const returnTarget = returnFocusRef?.current ?? null;
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => {
          const next = Math.min(items.length - 1, i + 1);
          itemRefs.current[next]?.focus();
          return next;
        });
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => {
          const next = Math.max(0, i - 1);
          itemRefs.current[next]?.focus();
          return next;
        });
        return;
      }
      if (e.key === "Home") {
        e.preventDefault();
        setActiveIndex(0);
        itemRefs.current[0]?.focus();
        return;
      }
      if (e.key === "End") {
        e.preventDefault();
        const last = items.length - 1;
        setActiveIndex(last);
        itemRefs.current[last]?.focus();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      returnTarget?.focus?.();
    };
  }, [onClose, items.length, returnFocusRef]);

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Note actions"
      className="u-enter-panel fixed z-50 min-w-44 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-raised)] py-1.5 shadow-[var(--shadow-overlay)]"
      style={{ left: x, top: y }}
    >
      {items.map((item, index) => (
        <button
          key={item.label}
          ref={(el) => {
            itemRefs.current[index] = el;
          }}
          type="button"
          role="menuitem"
          tabIndex={index === activeIndex ? 0 : -1}
          className={cn(
            "u-press u-focus flex w-full cursor-pointer px-3 py-2.5 text-left text-sm",
            item.destructive
              ? "gesture-danger text-[var(--danger)]"
              : "text-[var(--foreground)] hover:bg-[var(--surface)]",
          )}
          onFocus={() => setActiveIndex(index)}
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
