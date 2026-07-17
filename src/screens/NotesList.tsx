import { useMemo, useState } from "react";
import { Button } from "../ui/Button";
import { ContextMenu } from "../ui/ContextMenu";
import { cn } from "../lib/cn";
import type { NoteListItem } from "../application/view-models";

interface NotesListProps {
  notes: NoteListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}

interface OpenMenu {
  x: number;
  y: number;
  noteId: string;
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
  onDelete,
  onDuplicate,
}: NotesListProps) {
  const [menu, setMenu] = useState<OpenMenu | null>(null);

  const sortedNotes = useMemo(
    () =>
      [...notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [notes],
  );

  const menuNote = menu
    ? sortedNotes.find((n) => n.id === menu.noteId)
    : undefined;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-xs font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">
          Notes
        </span>
        <Button size="sm" variant="secondary" onClick={onCreate}>
          New
        </Button>
      </div>
      <ul className="flex-1 space-y-1 overflow-y-auto px-3 pt-2 pb-4">
        {sortedNotes.length === 0 ? (
          <li className="px-2 py-8 text-center text-sm text-[var(--color-muted-foreground)]">
            No notes yet
          </li>
        ) : (
          sortedNotes.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => onSelect(n.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setMenu({ x: e.clientX, y: e.clientY, noteId: n.id });
                }}
                className={cn(
                  "w-full cursor-pointer rounded-md border px-3 py-2.5 text-left transition-colors",
                  "border-transparent hover:border-[var(--color-border)] hover:bg-[var(--color-background)]",
                  selectedId === n.id &&
                    "border-[var(--color-border)] bg-[var(--color-background)]",
                )}
              >
                <div className="truncate text-sm font-medium text-[var(--color-foreground)]">
                  {n.title || "Untitled"}
                </div>
                <div className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                  {formatRelative(n.updatedAt)}
                </div>
              </button>
            </li>
          ))
        )}
      </ul>
      {menu && menuNote ? (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            {
              label: "Duplicate note",
              onSelect: () => onDuplicate(menu.noteId),
            },
            {
              label: "Delete note",
              destructive: true,
              onSelect: () => onDelete(menu.noteId),
            },
          ]}
        />
      ) : null}
    </div>
  );
}
