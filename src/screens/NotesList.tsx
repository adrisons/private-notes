import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../ui/Button";
import { ContextMenu } from "../ui/ContextMenu";
import { useTouchActionsEnabled } from "../lib/touch-actions";
import { NoteListRow } from "./NoteListRow";
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
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null);
  const noteRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const touchActionsEnabled = useTouchActionsEnabled();

  const sortedNotes = useMemo(
    () =>
      [...notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [notes],
  );

  const menuNote = menu
    ? sortedNotes.find((n) => n.id === menu.noteId)
    : undefined;

  useEffect(() => {
    if (!selectedId) return;
    const index = sortedNotes.findIndex((note) => note.id === selectedId);
    if (index >= 0) setFocusedIndex(index);
  }, [selectedId, sortedNotes]);

  useEffect(() => {
    if (focusedIndex >= sortedNotes.length) {
      setFocusedIndex(Math.max(0, sortedNotes.length - 1));
    }
  }, [focusedIndex, sortedNotes.length]);

  useEffect(() => {
    const list = listRef.current;
    if (!list || !openSwipeId) return;
    const close = () => setOpenSwipeId(null);
    list.addEventListener("scroll", close, { passive: true });
    return () => list.removeEventListener("scroll", close);
  }, [openSwipeId]);

  const openMenuAt = (
    index: number,
    trigger: HTMLButtonElement,
    coords: { x: number; y: number },
  ) => {
    const note = sortedNotes[index];
    if (!note) return;
    menuTriggerRef.current = trigger;
    setMenu({ x: coords.x, y: coords.y, noteId: note.id });
  };

  const openMenuForIndex = (index: number) => {
    const button = noteRefs.current[index];
    if (!button) return;
    const rect = button.getBoundingClientRect();
    openMenuAt(index, button, { x: rect.left, y: rect.bottom + 4 });
  };

  const handleListKeyDown = (event: React.KeyboardEvent<HTMLUListElement>) => {
    if (menu || sortedNotes.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setFocusedIndex((index) => {
        const next = Math.min(sortedNotes.length - 1, index + 1);
        noteRefs.current[next]?.focus();
        return next;
      });
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setFocusedIndex((index) => {
        const next = Math.max(0, index - 1);
        noteRefs.current[next]?.focus();
        return next;
      });
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      setFocusedIndex(0);
      noteRefs.current[0]?.focus();
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      const last = sortedNotes.length - 1;
      setFocusedIndex(last);
      noteRefs.current[last]?.focus();
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const note = sortedNotes[focusedIndex];
      if (note) onSelect(note.id);
      return;
    }

    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      const note = sortedNotes[focusedIndex];
      if (note) onDelete(note.id);
      return;
    }

    if (event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey)) {
      event.preventDefault();
      openMenuForIndex(focusedIndex);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-xs font-medium uppercase tracking-wider text-[var(--foreground-muted)]">
          Notes
        </span>
        {/* Create: the + rotates a quarter turn and the button pops (§5.7). */}
        <Button
          size="sm"
          variant="secondary"
          onClick={onCreate}
          className="gesture-create"
        >
          <span aria-hidden className="gesture-icon text-base leading-none">
            +
          </span>
          New
        </Button>
      </div>
      <ul
        ref={listRef}
        role="list"
        aria-label="Notes"
        onKeyDown={handleListKeyDown}
        className="flex-1 space-y-1 overflow-y-auto px-3 pt-2 pb-4 outline-none"
      >
        {sortedNotes.length === 0 ? (
          <li className="px-2 py-8 text-center text-sm text-[var(--foreground-muted)]">
            No notes yet
          </li>
        ) : (
          sortedNotes.map((n, index) => (
            <NoteListRow
              key={n.id}
              ref={(el) => {
                noteRefs.current[index] = el;
              }}
              note={n}
              selected={selectedId === n.id}
              focused={index === focusedIndex}
              touchActionsEnabled={touchActionsEnabled}
              swipeOpen={openSwipeId === n.id}
              onSwipeOpenChange={(open) => {
                setOpenSwipeId(open ? n.id : null);
              }}
              onSelect={() => onSelect(n.id)}
              onFocus={() => setFocusedIndex(index)}
              onContextMenu={(e) => {
                e.preventDefault();
                setFocusedIndex(index);
                openMenuAt(index, e.currentTarget, {
                  x: e.clientX,
                  y: e.clientY,
                });
              }}
              onDelete={() => onDelete(n.id)}
              onDuplicate={() => onDuplicate(n.id)}
              formatRelative={formatRelative}
            />
          ))
        )}
      </ul>
      {menu && menuNote ? (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          returnFocusRef={menuTriggerRef}
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
