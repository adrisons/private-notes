import { useState } from "react";
import {
  formatIndexStatusLabel,
  isIndexStatusInteractive,
} from "../lib/search/index-progress";
import type { ReindexProgress } from "../application/view-models";
import { ActionDialog } from "../ui/ActionDialog";

interface IndexStatusProps {
  ready: boolean;
  reindexing: boolean;
  progress: ReindexProgress | null;
  onReindex: () => void;
}

const INDEX_INFO =
  "Search understands meaning, not just exact words. The app reads your notes on this device and builds a local index — nothing leaves your machine. Reindex if results look stale after large edits.";

/** Sidebar line showing semantic index progress and an optional info dialog. */
export function IndexStatus({
  ready,
  reindexing,
  progress,
  onReindex,
}: IndexStatusProps) {
  const [infoOpen, setInfoOpen] = useState(false);
  const statusLabel = formatIndexStatusLabel(ready, reindexing, progress);
  const statusInteractive = isIndexStatusInteractive(ready, reindexing);

  return (
    <>
      {statusInteractive ? (
        <button
          type="button"
          onClick={() => setInfoOpen(true)}
          className="cursor-pointer text-xs text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)] hover:underline"
          aria-label={`${statusLabel}. Learn about semantic indexing.`}
        >
          {statusLabel}
        </button>
      ) : (
        <span
          className="text-xs text-[var(--color-muted-foreground)]"
          aria-live="polite"
        >
          {statusLabel}
        </span>
      )}
      <ActionDialog
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        title="Semantic index"
        description={INDEX_INFO}
        primaryLabel="Reindex"
        onPrimary={() => {
          onReindex();
          setInfoOpen(false);
        }}
        primaryDisabled={reindexing}
      />
    </>
  );
}
