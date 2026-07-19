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
        "fixed bottom-4 left-1/2 z-50 w-[min(100%-2rem,28rem)] -translate-x-1/2",
        "rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-background)]",
        "px-4 py-3 shadow-lg",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[var(--color-foreground)]">
            {message}
          </p>
          {fixHint ? (
            <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
              {fixHint}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 cursor-pointer rounded-md px-2 py-1 text-xs text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)]"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
