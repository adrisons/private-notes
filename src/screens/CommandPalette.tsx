import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog } from "../ui/Dialog";
import type { NoteRecord } from "../lib/fs/types";
import type { SearchHit } from "../lib/search/search";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  notes: NoteRecord[];
  searchReady: boolean;
  onSearch: (query: string) => Promise<SearchHit[]>;
  onOpenNote: (id: string) => void;
  onOpenHit: (hit: SearchHit) => void;
  onCreate: () => void;
}

type Item =
  | { kind: "create" }
  | { kind: "note"; record: NoteRecord }
  | { kind: "hit"; hit: SearchHit };

function keyFor(item: Item): string {
  if (item.kind === "create") return "create";
  if (item.kind === "note") return `n:${item.record.id}`;
  return `h:${item.hit.noteId}:${item.hit.chunkIdx}`;
}

export function CommandPalette({
  open,
  onClose,
  notes,
  searchReady,
  onSearch,
  onOpenNote,
  onOpenHit,
  onCreate,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
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

  // Build the unified list. When the query is empty: a "create" entry and
  // recent notes. When non-empty: semantic hits first, then notes whose title
  // matches as a quick lexical fallback.
  const items: Item[] = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (trimmed.length === 0) {
      return [
        { kind: "create" as const },
        ...notes.slice(0, 8).map((n) => ({ kind: "note" as const, record: n })),
      ];
    }
    const lexical = notes
      .filter((n) => n.title.toLowerCase().includes(trimmed))
      .slice(0, 5);
    return [
      ...hits.map((h) => ({ kind: "hit" as const, hit: h })),
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
    else onOpenHit(item.hit);
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
          className="w-full bg-transparent px-4 py-3 text-base outline-none placeholder:text-[var(--color-muted-foreground)]"
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
              const cls = `flex w-full items-start gap-3 px-4 py-2 text-left text-sm ${
                isActive ? "bg-[var(--color-muted)]" : ""
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
              if (item.kind === "note") {
                return (
                  <li key={keyFor(item)}>
                    <button
                      type="button"
                      onMouseEnter={() => setActive(i)}
                      onClick={() => choose(item)}
                      className={cls}
                    >
                      <span aria-hidden>◷</span>
                      <span className="truncate">{item.record.title || "Untitled"}</span>
                    </button>
                  </li>
                );
              }
              return (
                <li key={keyFor(item)}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(item)}
                    className={cls}
                  >
                    <span aria-hidden>↦</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {item.hit.filePath
                          .split("/")
                          .pop()
                          ?.replace(/\.md$/, "")}
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-xs text-[var(--color-muted-foreground)]">
                        {item.hit.snippet}
                      </span>
                    </span>
                    <span className="text-xs text-[var(--color-muted-foreground)]">
                      {item.hit.score.toFixed(2)}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
        <div className="border-t border-[var(--color-border)] px-4 py-2 text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
          ↑↓ navigate · Enter to open · Esc to close
        </div>
      </div>
    </Dialog>
  );
}
