import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog } from "../ui/Dialog";
import { Input } from "../ui/Input";
import { SpaceChip } from "../ui/SpaceChip";
import { cn } from "../lib/cn";
import {
  rankSearchResults,
  resolveNoteSpaceChips,
  sortNoteListItemsByRecency,
  COMMAND_PALETTE_RECENT_LIMIT,
  type MatchKind,
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
  | { kind: "result"; noteId: string; matchKind: MatchKind };

function keyFor(item: Item): string {
  return item.kind === "create" ? "create" : `r:${item.noteId}`;
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

function SemanticIcon() {
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
      <path d="M12 4l1.8 4.2L18 10l-4.2 1.8L12 16l-1.8-4.2L6 10l4.2-1.8z" />
      <path d="M18 16.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z" />
    </svg>
  );
}

function SpaceIcon() {
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
      <path d="M4 12V5a1 1 0 011-1h7l8 8-8 8z" />
      <circle cx="8.5" cy="8.5" r="1.25" />
    </svg>
  );
}

/**
 * Every row used to carry the clock, so a literal title match looked exactly
 * like "something you opened lately". The icon now names the claim the row is
 * making — and for a space match the chip beside it names which space.
 */
function resultIcon(matchKind: MatchKind) {
  if (matchKind === "recent") return <ClockIcon />;
  if (matchKind === "semantic") return <SemanticIcon />;
  if (matchKind === "space") return <SpaceIcon />;
  return <MatchIcon />;
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
  const listRef = useRef<HTMLUListElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchSeq = useRef(0);

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
      // Invalidate anything in flight: its results describe an older query.
      searchSeq.current++;
      setHits([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const seq = ++searchSeq.current;
      const results = await onSearch(query);
      // The debounce prevents most overlap, but not a slow query resolving
      // after a newer, faster one — which would silently overwrite fresher
      // results with staler ones.
      if (seq === searchSeq.current) setHits(results);
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [open, query, searchReady, onSearch]);

  const noteById = useMemo(
    () => new Map(notes.map((note) => [note.id, note])),
    [notes],
  );

  const byRecency = useMemo(
    () => sortNoteListItemsByRecency(notes),
    [notes],
  );

  const items: Item[] = useMemo(() => {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      return [
        { kind: "create" as const },
        ...byRecency.slice(0, COMMAND_PALETTE_RECENT_LIMIT).map((note) => ({
          kind: "result" as const,
          noteId: note.id,
          matchKind: "recent" as const,
        })),
      ];
    }
    // One ranking, not two lists stapled together: content relevance from the
    // index and title/space matches from the notes already in memory are
    // scored against each other before anything is rendered.
    return rankSearchResults({
      query: trimmed,
      hits,
      notes: byRecency,
      spaces: spaceItems,
    }).map((result) => ({
      kind: "result" as const,
      noteId: result.noteId,
      matchKind: result.matchKind,
    }));
  }, [query, hits, byRecency, spaceItems]);

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

  useEffect(() => {
    if (!open || items.length === 0) return;
    const option = listRef.current?.querySelector<HTMLElement>(
      `#command-palette-item-${active}`,
    );
    option?.scrollIntoView?.({ block: "nearest" });
  }, [open, active, items.length, resultsAnimateKey]);

  const resultStatus =
    query.trim().length === 0
      ? `${items.length} ${items.length === 1 ? "item" : "items"}`
      : items.length === 0
        ? searchReady
          ? "No matches"
          : "Indexing"
        : `${items.length} ${items.length === 1 ? "match" : "matches"}`;

  const pageSize = 10;

  const choose = (item: Item) => {
    if (item.kind === "create") onCreate();
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
          } else if (e.key === "Home") {
            e.preventDefault();
            setActive(0);
          } else if (e.key === "End") {
            e.preventDefault();
            setActive(Math.max(0, items.length - 1));
          } else if (e.key === "PageDown") {
            e.preventDefault();
            setActive((i) => Math.min(items.length - 1, i + pageSize));
          } else if (e.key === "PageUp") {
            e.preventDefault();
            setActive((i) => Math.max(0, i - pageSize));
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
        <span role="status" aria-live="polite" className="sr-only">
          {resultStatus}
        </span>
        <ul
          ref={listRef}
          id="command-palette-results"
          key={resultsAnimateKey}
          role="listbox"
          aria-label="Search results"
          className="u-content-swap max-h-[50vh] overflow-y-auto border-y border-[var(--border)] divide-y divide-[var(--border)]"
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
                      tabIndex={-1}
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
              const note = noteById.get(item.noteId);
              const title = note?.title || "Untitled";
              const chips = note
                ? resolveNoteSpaceChips(note.spaceIds, spaceItems)
                : [];
              const icon = resultIcon(item.matchKind);
              return (
                <li key={keyFor(item)} role="presentation">
                  <button
                    id={`command-palette-item-${i}`}
                    type="button"
                    role="option"
                    tabIndex={-1}
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
