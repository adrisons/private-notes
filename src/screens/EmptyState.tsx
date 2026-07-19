import { Button } from "../ui/Button";

interface EmptyStateProps {
  onCreate: () => void;
}

export function EmptyState({ onCreate }: EmptyStateProps) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="u-enter max-w-sm px-6 text-center">
        <h2 className="text-xl font-semibold tracking-tight">
          No note selected
        </h2>
        <p className="mt-2 text-sm text-[var(--foreground-muted)]">
          Pick a note from the sidebar, or create one to get started.
        </p>
        <div className="mt-4">
          <Button onClick={onCreate}>New note</Button>
        </div>
      </div>
    </div>
  );
}
