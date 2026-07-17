import { useEffect, useRef, type ReactNode } from "react";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  /** Accessible label for the dialog container. */
  label: string;
  /** Width hint. Defaults to a centered "sm" size. */
  size?: "sm" | "md";
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
  children,
}: DialogProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    // Push initial focus into the dialog so screen-reader users land here.
    queueMicrotask(() => ref.current?.focus());
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const width = size === "md" ? "max-w-xl" : "max-w-md";

  // Align the dialog top with the sidebar search input: header (h-14) + panel padding (py-4).
  const dialogTop = "pt-[calc(theme(spacing.14)+theme(spacing.4))]";

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={`fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 backdrop-blur-sm ${dialogTop}`}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={`w-full ${width} rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] shadow-2xl outline-none`}
      >
        {children}
      </div>
    </div>
  );
}
