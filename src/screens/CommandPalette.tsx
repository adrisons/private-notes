import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog } from "../ui/Dialog";
import { Input } from "../ui/Input";
import { SpaceChip } from "../ui/SpaceChip";
import { cn } from "../lib/cn";
import {
  dedupeSearchResultsByNote,
  resolveNoteSpaceChips,
  type NoteListItem,
  type SearchResultItem,
  type SpaceListItem,
} from "../application/view-models";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  notes: NoteListItem[];
  spaceItems: SpaceListItem[];
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

/** Line icons, 24px grid — never emoji (design.md §1.2). */
function PlusIcon() {
  return (
    <svg
      aria-hidden
      className="gesture-icon h-4 w-4 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      aria-hidden
      className="h-4 w-4 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}

function MatchIcon() {
  return (
    <svg
      aria-hidden
      className="h-4 w-4 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  );
}

export function CommandPalette({
  open,
  onClose,
  notes,
  spaceItems,
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

  const noteById = useMemo(
    () => new Map(notes.map((note) => [note.id, note])),
    [notes],
  );

  const noteTitleById = useMemo(
    () => new Map(notes.map((note) => [note.id, note.title])),
    [notes],
  );

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

  // Re-animate results when a debounced search completes, not on every keystroke.
  const resultsAnimateKey = useMemo(() => {
    const trimmed = query.trim();
    if (trimmed.length === 0) return "recent";
    return `${trimmed}:${hits.map((hit) => hit.noteId).join(",")}`;
  }, [query, hits]);

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

  const itemButtonClass = (isActive: boolean) =>
    cn(
      "u-press u-focus-inset flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left text-sm",
      "transition-[color,background-color] duration-[var(--duration-fast)] ease-[var(--ease-smooth)]",
      isActive
        ? "bg-[var(--surface)] text-[var(--foreground)]"
        : "text-[var(--foreground-muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]",
    );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      label="Command palette"
      size="md"
      initialFocusRef={inputRef}
    >
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
        <Input
          ref={inputRef}
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchReady ? "Search or jump to…" : "Loading search…"}
          className="rounded-t-[var(--radius-lg)] px-4 py-3.5 placeholder:text-[var(--foreground-muted)]"
          aria-label="Search notes"
          aria-controls="command-palette-results"
          aria-activedescendant={
            items.length > 0 ? `command-palette-item-${active}` : undefined
          }
        />
        <ul
          id="command-palette-results"
          key={resultsAnimateKey}
          role="listbox"
          aria-label="Search results"
          className="u-content-swap max-h-[50vh] overflow-y-auto border-y border-[var(--border)] divide-y divide-[var(--border)]"
          aria-live="polite"
        >
          {items.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-[var(--foreground-muted)]">
              {searchReady ? "No matches." : "Indexing…"}
            </li>
          ) : (
            items.map((item, i) => {
              const isActive = i === active;
              if (item.kind === "create") {
                return (
                  <li key={keyFor(item)} role="presentation">
                    <button
                      id={`command-palette-item-${i}`}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => choose(item)}
                      className={cn("gesture-create", itemButtonClass(isActive))}
                    >
                      <PlusIcon />
                      <span>New note</span>
                    </button>
                  </li>
                );
              }
              const title =
                item.kind === "note"
                  ? item.record.title || "Untitled"
                  : noteTitleById.get(item.noteId) || "Untitled";
              const noteId =
                item.kind === "note" ? item.record.id : item.noteId;
              const note = noteById.get(noteId);
              const chips = note
                ? resolveNoteSpaceChips(note.spaceIds, spaceItems)
                : [];
              const icon =
                item.kind === "note" ? <ClockIcon /> : <MatchIcon />;
              return (
                <li key={keyFor(item)} role="presentation">
                  <button
                    id={`command-palette-item-${i}`}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(item)}
                    className={itemButtonClass(isActive)}
                  >
                    {icon}
                    <span className="min-w-0 flex-1 truncate">{title}</span>
                    {chips.length > 0 ? (
                      <span className="hidden shrink-0 items-center gap-1 sm:inline-flex">
                        {chips.map((chip) => (
                          <SpaceChip
                            key={chip.name}
                            name={chip.name}
                            colorId={chip.colorId}
                          />
                        ))}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
        <div className="px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-[var(--foreground-muted)]">
          ↑↓ navigate · Enter to open · Esc to close
        </div>
      </div>
    </Dialog>
  );
}
