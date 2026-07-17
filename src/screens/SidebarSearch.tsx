import { formatModKeyShortcut } from "../lib/platform";
import type { ReindexProgress } from "../application/view-models";
import { Kbd } from "../ui/Kbd";
import { IndexStatus } from "./IndexStatus";

interface SidebarSearchProps {
  ready: boolean;
  reindexing: boolean;
  progress: ReindexProgress | null;
  onOpenCommandPalette: () => void;
  onReindex: () => void;
}

function SearchIcon() {
  return (
    <svg
      aria-hidden
      className="h-4 w-4 shrink-0 text-[var(--color-muted-foreground)]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3-3" />
    </svg>
  );
}

/** Top of the sidebar: opens the command palette and shows index status. */
export function SidebarSearch({
  ready,
  reindexing,
  progress,
  onOpenCommandPalette,
  onReindex,
}: SidebarSearchProps) {
  return (
    <div className="border-b border-[var(--color-border)] px-4 py-4">
      <button
        type="button"
        onClick={onOpenCommandPalette}
        className="flex h-10 w-full cursor-pointer items-center gap-2.5 rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-3 text-left text-sm text-[var(--color-muted-foreground)] transition-colors hover:border-[var(--color-foreground)]/20 hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
        aria-label={`Search notes (${formatModKeyShortcut("K")})`}
      >
        <SearchIcon />
        <span className="flex-1 truncate">
          {ready ? "Search…" : "Loading search…"}
        </span>
        <Kbd>{formatModKeyShortcut("K")}</Kbd>
      </button>
      <div className="mt-3">
        <IndexStatus
          ready={ready}
          reindexing={reindexing}
          progress={progress}
          onReindex={onReindex}
        />
      </div>
    </div>
  );
}
