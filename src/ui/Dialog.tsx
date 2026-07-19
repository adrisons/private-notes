import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { trapFocus } from "../lib/focus-trap";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  /** Accessible label for the dialog container. */
  label: string;
  /** Width hint. Defaults to a centered "sm" size. */
  size?: "sm" | "md";
  /** When set, initial focus lands here instead of the dialog shell. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
}

/**
 * Minimal modal: focus-trapped at the dialog root, Esc closes, click on the
 * scrim closes. Avoids a heavy library — the app only needs a confirm dialog
 * and the command palette.
 */
export function Dialog({
  open,
  onClose,
  label,
  size = "sm",
  initialFocusRef,
  children,
}: DialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === "Tab" && ref.current) {
        trapFocus(ref.current, e);
      }
    };

    window.addEventListener("keydown", onKey);
    queueMicrotask(() => {
      const initial = initialFocusRef?.current;
      if (initial) {
        initial.focus();
        return;
      }
      ref.current?.focus();
    });

    return () => {
      window.removeEventListener("keydown", onKey);
      previousFocusRef.current?.focus?.();
    };
  }, [open, onClose, initialFocusRef]);

  if (!open) return null;

  const width = size === "md" ? "max-w-xl" : "max-w-md";

  // Align the dialog top with the sidebar search input: header + panel padding.
  const dialogTop = "pt-[calc(var(--header-height)+1rem)]";

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={`u-enter-backdrop fixed inset-0 z-50 flex items-start justify-center bg-[var(--backdrop)] px-4 ${dialogTop}`}
    >
      {/* Overlays enter from scale(0.98) with the blur entrance (§5.8). */}
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={`u-enter-panel w-full ${width} rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-raised)] shadow-[var(--shadow-overlay)] outline-none`}
      >
        {children}
      </div>
    </div>
  );
}
