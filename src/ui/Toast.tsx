import { cn } from "../lib/cn";

export interface ToastProps {
  message: string;
  fixHint?: string;
  onDismiss: () => void;
  className?: string;
}

/** Non-blocking error banner fixed to the bottom of the viewport. */
export function Toast({ message, fixHint, onDismiss, className }: ToastProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        // Centered with margins, not a transform: the entrance animation owns
        // `transform` and would otherwise cancel the centering.
        "u-enter-panel fixed inset-x-4 bottom-4 z-50 mx-auto w-auto max-w-[28rem]",
        "rounded-[var(--radius-lg)] border border-[var(--danger-soft)] bg-[var(--surface-raised)]",
        "px-4 py-3 shadow-[var(--shadow-overlay)]",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[var(--foreground)]">
            {message}
          </p>
          {fixHint ? (
            <p className="mt-1 text-xs text-[var(--foreground-muted)]">
              {fixHint}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="u-press u-focus shrink-0 cursor-pointer rounded-[var(--radius-sm)] px-2 py-1 text-xs text-[var(--foreground-muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
