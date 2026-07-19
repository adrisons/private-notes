import { useState } from "react";
import {
  formatIndexStatusLabel,
  isIndexStatusInteractive,
  type ReindexProgress,
} from "../application/view-models";
import { ActionDialog } from "../ui/ActionDialog";

interface IndexStatusProps {
  ready: boolean;
  reindexing: boolean;
  progress: ReindexProgress | null;
  indexError?: boolean;
  onReindex: () => void;
}

const INDEX_INFO =
  "Search understands meaning, not just exact words. The app reads your notes on this device and builds a local index — nothing leaves your machine. Reindex if results look stale after large edits.";

const INDEX_ERROR_INFO =
  "The search index could not be updated. Your notes are still saved — only search may be incomplete. Try reindexing. If the problem persists, reopen the folder and check the browser console for details.";

/** Sidebar line showing semantic index progress and an optional info dialog. */
export function IndexStatus({
  ready,
  reindexing,
  progress,
  indexError = false,
  onReindex,
}: IndexStatusProps) {
  const [infoOpen, setInfoOpen] = useState(false);
  const statusLabel = formatIndexStatusLabel(
    ready,
    reindexing,
    progress,
    indexError,
  );
  const statusInteractive = isIndexStatusInteractive(
    ready,
    reindexing,
    indexError,
  );

  return (
    <>
      {statusInteractive ? (
        <button
          type="button"
          onClick={() => setInfoOpen(true)}
          className={
            indexError
              ? "cursor-pointer text-xs text-[var(--color-danger)] transition-colors hover:underline"
              : "cursor-pointer text-xs text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)] hover:underline"
          }
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
        title={indexError ? "Index error" : "Semantic index"}
        description={indexError ? INDEX_ERROR_INFO : INDEX_INFO}
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
