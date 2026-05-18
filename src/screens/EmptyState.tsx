import { Button } from "../ui/Button";

interface EmptyStateProps {
  onCreate: () => void;
}

export function EmptyState({ onCreate }: EmptyStateProps) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="max-w-sm text-center">
        <h2 className="text-xl font-semibold tracking-tight">
          No note selected
        </h2>
        <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
          Pick a note from the sidebar, or create one to get started.
        </p>
        <div className="mt-4">
          <Button onClick={onCreate}>New note</Button>
        </div>
      </div>
    </div>
  );
}
