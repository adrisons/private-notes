import { Button } from "../ui/Button";
import { cn } from "../lib/cn";
import type { NoteRecord } from "../lib/fs/types";

interface NotesListProps {
  notes: NoteRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
}

function formatRelative(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = Math.max(0, now - then);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function NotesList({
  notes,
  selectedId,
  onSelect,
  onCreate,
}: NotesListProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
          Notes
        </span>
        <Button size="sm" variant="secondary" onClick={onCreate}>
          New
        </Button>
      </div>
      <ul className="flex-1 overflow-y-auto px-2 pb-3">
        {notes.length === 0 ? (
          <li className="px-2 py-6 text-center text-sm text-[var(--color-muted-foreground)]">
            No notes yet
          </li>
        ) : (
          notes.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => onSelect(n.id)}
                className={cn(
                  "w-full rounded-md px-2 py-2 text-left text-sm",
                  "hover:bg-[var(--color-background)]",
                  selectedId === n.id && "bg-[var(--color-background)]",
                )}
              >
                <div className="truncate font-medium">
                  {n.title || "Untitled"}
                </div>
                <div className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                  {formatRelative(n.updatedAt)}
                </div>
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
