import { useEffect, useMemo, useRef, useState } from "react";
import { SpaceChip } from "../ui/SpaceChip";
import { spaceChipStyle } from "../ui/space-colors";
import { cn } from "../lib/cn";
import { inlineFieldBorderClass } from "../lib/inline-outline-field";
import {
  addSpaceId,
  isGeneralSpaceId,
  isReservedSpaceName,
  removeSpaceId,
  resolveNoteSpaceChips,
  type SpaceColorId,
  type SpaceId,
  type SpaceListItem,
} from "../application/view-models";

interface SpaceTagsEditorProps {
  spaces: SpaceListItem[];
  value: SpaceId[];
  onChange: (spaceIds: SpaceId[]) => void;
  onCreateSpace: (name: string) => Promise<SpaceId | null>;
}

type Suggestion =
  | { kind: "space"; id: SpaceId; name: string; colorId: SpaceColorId | null }
  | { kind: "create"; name: string };

interface DisplayChip {
  id: SpaceId;
  name: string;
  colorId: SpaceColorId | null;
  removable: boolean;
}

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase();
}

function TagChip({
  name,
  colorId,
  onRemove,
}: {
  name: string;
  colorId: SpaceColorId | null;
  onRemove?: () => void;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full shrink-0 items-center gap-0.5 rounded-[var(--radius-sm)] py-0.5 text-xs font-medium",
        onRemove ? "pl-2 pr-1" : "px-2",
      )}
      style={spaceChipStyle(colorId)}
    >
      <span className="truncate">{name}</span>
      {onRemove ? (
        <button
          type="button"
          aria-label={`Remove ${name} space`}
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          className="u-focus inline-flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-full)] text-[inherit] opacity-70 hover:opacity-100"
        >
          ×
        </button>
      ) : null}
    </span>
  );
}

export function SpaceTagsEditor({
  spaces,
  value,
  onChange,
  onCreateSpace,
}: SpaceTagsEditorProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const displayChips = useMemo(
    (): DisplayChip[] =>
      resolveNoteSpaceChips(value, spaces).map((chip) => ({
        ...chip,
        removable: !isGeneralSpaceId(chip.id),
      })),
    [value, spaces],
  );

  const assignedIds = useMemo(() => new Set(value), [value]);

  const suggestions = useMemo((): Suggestion[] => {
    const q = normalizeQuery(query);
    const customSpaces = spaces.filter((space) => !isGeneralSpaceId(space.id));
    const matches = customSpaces.filter((space) => {
      if (assignedIds.has(space.id)) return false;
      if (!q) return true;
      return space.name.toLowerCase().includes(q);
    });

    const items: Suggestion[] = matches.map((space) => ({
      kind: "space",
      id: space.id,
      name: space.name,
      colorId: space.colorId,
    }));

    if (q.length > 0) {
      const exact = customSpaces.some(
        (space) => space.name.toLowerCase() === q,
      );
      if (!exact && !isReservedSpaceName(query.trim())) {
        items.push({ kind: "create", name: query.trim() });
      }
    }

    return items;
  }, [spaces, query, assignedIds]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, suggestions.length]);

  const applySuggestion = async (item: Suggestion) => {
    if (item.kind === "space") {
      onChange(addSpaceId(value, item.id));
      setQuery("");
      setOpen(false);
      inputRef.current?.focus();
      return;
    }

    const createdId = await onCreateSpace(item.name);
    if (createdId) {
      onChange(addSpaceId(value, createdId));
    }
    setQuery("");
    setOpen(false);
    inputRef.current?.focus();
  };

  const removeChip = (chip: DisplayChip) => {
    if (!chip.removable) return;
    onChange(removeSpaceId(value, chip.id));
    inputRef.current?.focus();
  };

  const removeLastChip = () => {
    if (value.length === 0) return;
    const lastId = value[value.length - 1];
    onChange(removeSpaceId(value, lastId));
  };

  const showMenu =
    open && query.length > 0 && (suggestions.length > 0 || query.trim().length > 0);
  const suggestionsId = "space-tags-suggestions";

  return (
    <div ref={rootRef} className="relative">
      <div
        onClick={() => inputRef.current?.focus()}
        className={cn(
          "u-focus-within flex min-h-11 flex-wrap items-center gap-1.5",
          "rounded-[var(--radius-md)] bg-[var(--surface-raised)]",
          "px-2 py-1.5 shadow-[var(--shadow-rest)]",
          inlineFieldBorderClass,
        )}
      >
        {displayChips.map((chip) => (
          <TagChip
            key={chip.id}
            name={chip.name}
            colorId={chip.colorId}
            onRemove={chip.removable ? () => removeChip(chip) : undefined}
          />
        ))}
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={showMenu}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-label="Note spaces"
          aria-controls={showMenu ? suggestionsId : undefined}
          aria-activedescendant={
            showMenu && suggestions.length > 0
              ? `${suggestionsId}-option-${activeIndex}`
              : undefined
          }
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Backspace" && query.length === 0) {
              event.preventDefault();
              removeLastChip();
              return;
            }
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((index) =>
                Math.min(suggestions.length - 1, index + 1),
              );
              return;
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((index) => Math.max(0, index - 1));
              return;
            }
            if (event.key === "Enter") {
              event.preventDefault();
              const item = suggestions[activeIndex];
              if (item) void applySuggestion(item);
              return;
            }
            if (event.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder={value.length === 0 ? undefined : "Add space…"}
          className="min-w-[6rem] flex-1 border-0 bg-transparent py-1 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--foreground-subtle)]"
        />
      </div>
      {showMenu ? (
        <ul
          id={suggestionsId}
          role="listbox"
          aria-label="Space suggestions"
          className="absolute left-0 top-full z-40 mt-1 min-w-[12rem] overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-raised)] py-1 shadow-[var(--shadow-overlay)]"
        >
          {suggestions.length === 0 ? (
            <li role="presentation">
              <div className="px-3 py-2 text-sm text-[var(--foreground-muted)]">
                No matching spaces
              </div>
            </li>
          ) : (
            suggestions.map((item, index) => {
              const active = index === activeIndex;
              return (
                <li
                  key={item.kind === "space" ? item.id : `create-${item.name}`}
                  role="presentation"
                >
                  <button
                    id={`${suggestionsId}-option-${index}`}
                    type="button"
                    role="option"
                    tabIndex={-1}
                    aria-selected={active}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => void applySuggestion(item)}
                    className={cn(
                      "u-focus flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                      active
                        ? "bg-[var(--surface)] text-[var(--foreground)]"
                        : "text-[var(--foreground-muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]",
                    )}
                  >
                    {item.kind === "space" ? (
                      <SpaceChip name={item.name} colorId={item.colorId} />
                    ) : (
                      <span>Create “{item.name}”</span>
                    )}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}
