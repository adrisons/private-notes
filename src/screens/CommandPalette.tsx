import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog } from "../ui/Dialog";
import {
  dedupeSearchResultsByNote,
  type NoteListItem,
  type SearchResultItem,
} from "../application/view-models";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  notes: NoteListItem[];
  searchReady: boolean;
  onSearch: (query: string) => Promise<SearchResultItem[]>;
  onOpenNote: (id: string) => void;
  onCreate: () => void;
}

type Item =
  | { kind: "create" }
  | { kind: "note"; record: NoteListItem }
  | { kind: "hit"; noteId: string };

function keyFor(item: Item): string {
  if (item.kind === "create") return "create";
  if (item.kind === "note") return `n:${item.record.id}`;
  return `h:${item.noteId}`;
}

export function CommandPalette({
  open,
  onClose,
  notes,
  searchReady,
  onSearch,
  onOpenNote,
  onCreate,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchResultItem[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset state and focus input each time the palette opens.
  useEffect(() => {
    if (open) {
      setQuery("");
      setHits([]);
      setActive(0);
      queueMicrotask(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!searchReady || query.trim().length === 0) {
      setHits([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setHits(await onSearch(query));
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [open, query, searchReady, onSearch]);

  const noteTitleById = useMemo(
    () => new Map(notes.map((note) => [note.id, note.title])),
    [notes],
  );

  // Build the unified list. When the query is empty: a "create" entry and
  // recent notes. When non-empty: semantic hits first, then notes whose title
  // matches as a quick lexical fallback.
  const items: Item[] = useMemo(() => {
    const sorted = [...notes].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
    const trimmed = query.trim().toLowerCase();
    if (trimmed.length === 0) {
      return [
        { kind: "create" as const },
        ...sorted.slice(0, 8).map((n) => ({ kind: "note" as const, record: n })),
      ];
    }
    const semantic = dedupeSearchResultsByNote(hits);
    const hitNoteIds = new Set(semantic.map((hit) => hit.noteId));
    const lexical = sorted
      .filter(
        (note) =>
          note.title.toLowerCase().includes(trimmed) &&
          !hitNoteIds.has(note.id),
      )
      .slice(0, 5);
    return [
      ...semantic.map((hit) => ({
        kind: "hit" as const,
        noteId: hit.noteId,
      })),
      ...lexical.map((n) => ({ kind: "note" as const, record: n })),
    ];
  }, [query, hits, notes]);

  // Clamp the active index any time the list shrinks.
  useEffect(() => {
    if (active >= items.length) setActive(Math.max(0, items.length - 1));
  }, [items, active]);

  const choose = (item: Item) => {
    if (item.kind === "create") onCreate();
    else if (item.kind === "note") onOpenNote(item.record.id);
    else onOpenNote(item.noteId);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} label="Command palette" size="md">
      <div
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(items.length - 1, i + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(0, i - 1));
          } else if (e.key === "Enter") {
            const item = items[active];
            if (item) {
              e.preventDefault();
              choose(item);
            }
          }
        }}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchReady ? "Search or jump to…" : "Loading search…"}
          className="w-full bg-transparent px-4 py-3.5 text-base outline-none placeholder:text-[var(--color-muted-foreground)]"
          aria-label="Search notes"
        />
        <ul className="max-h-[50vh] overflow-y-auto border-t border-[var(--color-border)]">
          {items.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-[var(--color-muted-foreground)]">
              {searchReady ? "No matches." : "Indexing…"}
            </li>
          ) : (
            items.map((item, i) => {
              const isActive = i === active;
              const cls = `flex w-full cursor-pointer items-start gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                isActive
                  ? "bg-[var(--color-muted)] text-[var(--color-foreground)]"
                  : "text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
              }`;
              if (item.kind === "create") {
                return (
                  <li key={keyFor(item)}>
                    <button
                      type="button"
                      onMouseEnter={() => setActive(i)}
                      onClick={() => choose(item)}
                      className={cls}
                    >
                      <span aria-hidden>＋</span>
                      <span>New note</span>
                    </button>
                  </li>
                );
              }
              const title =
                item.kind === "note"
                  ? item.record.title || "Untitled"
                  : noteTitleById.get(item.noteId) || "Untitled";
              const icon = item.kind === "note" ? "◷" : "↦";
              return (
                <li key={keyFor(item)}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(item)}
                    className={cls}
                  >
                    <span aria-hidden>{icon}</span>
                    <span className="truncate">{title}</span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
        <div className="border-t border-[var(--color-border)] px-4 py-2.5 text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">
          ↑↓ navigate · Enter to open · Esc to close
        </div>
      </div>
    </Dialog>
  );
}
