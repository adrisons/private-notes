import { useEffect, useRef, useState } from "react";
import { Input } from "../ui/Input";
import type { SearchHit } from "../lib/search/search";

interface SearchPanelProps {
  ready: boolean;
  reindexing: boolean;
  reindexProgress: { done: number; total: number } | null;
  onSearch: (query: string) => Promise<SearchHit[]>;
  onOpenHit: (hit: SearchHit) => void;
  onReindex: () => void;
}

export function SearchPanel({
  ready,
  reindexing,
  reindexProgress,
  onSearch,
  onOpenHit,
  onReindex,
}: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length === 0) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await onSearch(query));
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, ready, onSearch]);

  return (
    <div className="border-b border-[var(--color-border)] px-3 py-3">
      <Input
        placeholder={ready ? "Search…" : "Loading search…"}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        disabled={!ready}
        aria-label="Search notes"
      />
      <div className="mt-2 flex items-center justify-between text-xs text-[var(--color-muted-foreground)]">
        <span>
          {reindexing && reindexProgress
            ? `Indexing ${reindexProgress.done}/${reindexProgress.total}`
            : searching
              ? "Searching…"
              : ready
                ? "Local · private"
                : "Loading model…"}
        </span>
        <button
          type="button"
          onClick={onReindex}
          className="hover:underline disabled:opacity-50"
          disabled={!ready || reindexing}
        >
          Reindex
        </button>
      </div>
      {results.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {results.map((hit) => (
            <li key={`${hit.noteId}:${hit.chunkIdx}`}>
              <button
                type="button"
                onClick={() => onOpenHit(hit)}
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-left text-sm hover:bg-[var(--color-muted)]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">
                    {hit.filePath.split("/").pop()?.replace(/\.md$/, "")}
                  </span>
                  <span className="text-xs text-[var(--color-muted-foreground)]">
                    {hit.score.toFixed(2)}
                  </span>
                </div>
                <p className="mt-1 line-clamp-3 text-xs text-[var(--color-muted-foreground)]">
                  {hit.snippet}
                </p>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
