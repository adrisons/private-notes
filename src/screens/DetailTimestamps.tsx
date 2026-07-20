import { formatDetailDate } from "../lib/format-detail-date";
import { cn } from "../lib/cn";

interface DetailTimestampsProps {
  createdAt: string;
  updatedAt: string;
  isSaving?: boolean;
  className?: string;
}

export function DetailTimestamps({
  createdAt,
  updatedAt,
  isSaving = false,
  className,
}: DetailTimestampsProps) {
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        "min-w-0 text-xs font-medium text-[var(--foreground-muted)]",
        className,
      )}
    >
      <time dateTime={createdAt} className="block break-words">
        Created {formatDetailDate(createdAt)}
      </time>
      {isSaving ? (
        <span className="mt-0.5 block">Saving…</span>
      ) : (
        <time dateTime={updatedAt} className="mt-0.5 block break-words">
          Edited {formatDetailDate(updatedAt)}
        </time>
      )}
    </div>
  );
}
