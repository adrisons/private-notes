import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "../ui/Button";
import { VirtualList, NOTE_LIST_ROW_HEIGHT } from "../ui/VirtualList";
import { cn } from "../lib/cn";
import { formatRelative } from "../lib/format-relative";
import { inlineOutlineFieldClass } from "../lib/inline-outline-field";
import { useDebouncedCallback } from "../lib/useDebouncedCallback";
import type { NoteListItem, SpaceListItem } from "../application/view-models";
import {
  GENERAL_SPACE_DESCRIPTION,
  isGeneralSpaceId,
  isReservedSpaceName,
  noteBelongsToSpace,
  resolveNoteSpaceChips,
  RESERVED_SPACE_NAME_MESSAGE,
  type SpaceColorId,
  type SpaceId,
  type SpacePatch,
} from "../application/view-models";
import { ColorSwatchPicker } from "./ColorSwatchPicker";
import { NoteListRow } from "./NoteListRow";

const AUTOSAVE_MS = 500;

interface SpaceDetailViewProps {
  space: SpaceListItem;
  notes: NoteListItem[];
  spaceItems: SpaceListItem[];
  onOpenNote: (id: string) => void;
  onUpdateSpace: (id: SpaceId, patch: SpacePatch) => Promise<void>;
  onDelete: () => void;
}

export function SpaceDetailView({
  space,
  notes,
  spaceItems,
  onOpenNote,
  onUpdateSpace,
  onDelete,
}: SpaceDetailViewProps) {
  const custom = !isGeneralSpaceId(space.id);

  const [name, setName] = useState(space.name);
  const [description, setDescription] = useState(space.description ?? "");
  const [colorId, setColorId] = useState<SpaceColorId>(
    (space.colorId ?? "blue") as SpaceColorId,
  );
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const titleRef = useRef<HTMLTextAreaElement>(null);
  const inFlightRef = useRef(0);

  useEffect(() => {
    setName(space.name);
    setDescription(space.description ?? "");
    setColorId((space.colorId ?? "blue") as SpaceColorId);
    setSavedAt(null);
    // Reset draft only when opening a different space, not after each autosave refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  }, [space.id]);

  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return;

    const fit = () => {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    };

    fit();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [name, custom]);

  const debouncedSave = useDebouncedCallback(
    async (id: SpaceId, patch: SpacePatch) => {
      inFlightRef.current += 1;
      setIsSaving(true);
      try {
        await onUpdateSpace(id, patch);
        setSavedAt(new Date().toISOString());
      } finally {
        inFlightRef.current -= 1;
        setIsSaving(
          inFlightRef.current > 0 || debouncedSaveRef.current.hasPending(),
        );
      }
    },
    AUTOSAVE_MS,
  );

  const debouncedSaveRef = useRef(debouncedSave);
  debouncedSaveRef.current = debouncedSave;

  const scheduleSave = useCallback(
    (next: { name: string; description: string; colorId: SpaceColorId }) => {
      if (!custom) return;
      const trimmedName = next.name.trim();
      if (!trimmedName || isReservedSpaceName(trimmedName)) return;
      setIsSaving(true);
      debouncedSave(space.id, {
        name: trimmedName,
        colorId: next.colorId,
        // `null` clears the stored description; `undefined` would leave it as-is.
        description: next.description.trim() || null,
      });
    },
    [custom, debouncedSave, space.id],
  );

  useEffect(() => {
    const flushNow = () => debouncedSaveRef.current.flush();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushNow();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flushNow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flushNow);
      flushNow();
    };
  }, []);

  const spaceNotes = useMemo(
    () =>
      [...notes]
        .filter((note) => noteBelongsToSpace(note.spaceIds, space.id))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [notes, space.id],
  );

  const trimmedName = name.trim();
  const reservedName = custom && isReservedSpaceName(trimmedName);
  const displayDescription = custom
    ? description
    : space.description ?? GENERAL_SPACE_DESCRIPTION;

  const saveStatus = isSaving
    ? "Saving…"
    : savedAt
      ? `Saved ${new Date(savedAt).toLocaleTimeString()}`
      : "";

  return (
    <div className="u-content-swap flex h-full min-h-0 flex-col">
      <div className="mx-auto flex w-full max-w-3xl min-h-0 flex-1 flex-col px-5 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-wrap items-center justify-end gap-3">
          {custom ? (
            <>
              <span
                aria-live="polite"
                aria-atomic="true"
                className="mr-auto text-xs font-medium text-[var(--foreground-muted)]"
              >
                {saveStatus}
              </span>
              <Button size="sm" variant="danger" onClick={onDelete}>
                Delete
              </Button>
            </>
          ) : null}
        </div>

        {custom ? (
          <div className="mt-4 space-y-4">
            <textarea
              ref={titleRef}
              rows={1}
              value={name}
              onChange={(event) => {
                const nextName = event.target.value.replace(/\n/g, " ");
                setName(nextName);
                scheduleSave({
                  name: nextName,
                  description,
                  colorId,
                });
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.preventDefault();
              }}
              placeholder="Space name"
              aria-label="Space name"
              className={cn(
                inlineOutlineFieldClass,
                "u-focus w-full resize-none overflow-hidden break-words text-3xl font-semibold tracking-tight placeholder:text-[var(--foreground-subtle)]",
              )}
            />
            {reservedName ? (
              <p className="text-xs text-[var(--foreground-muted)]">
                {RESERVED_SPACE_NAME_MESSAGE}
              </p>
            ) : null}

            <div>
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--foreground-muted)]">
                Color
              </span>
              <ColorSwatchPicker
                value={colorId}
                onChange={(next) => {
                  setColorId(next);
                  scheduleSave({ name, description, colorId: next });
                }}
              />
            </div>

            <textarea
              value={description}
              onChange={(event) => {
                const nextDescription = event.target.value;
                setDescription(nextDescription);
                scheduleSave({
                  name,
                  description: nextDescription,
                  colorId,
                });
              }}
              placeholder="Optional context for this space…"
              aria-label="Space description"
              rows={2}
              className={cn(
                inlineOutlineFieldClass,
                "u-focus w-full resize-none text-sm leading-relaxed text-[var(--foreground-muted)] placeholder:text-[var(--foreground-subtle)]",
              )}
            />
          </div>
        ) : (
          <>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight">
              {space.name}
            </h1>
            <p className="mt-2 max-w-prose text-sm text-[var(--foreground-muted)]">
              {displayDescription}
            </p>
          </>
        )}

        <p className="mt-2 text-xs text-[var(--foreground-muted)]">
          {space.noteCount} {space.noteCount === 1 ? "note" : "notes"}
        </p>

        <VirtualList
          items={spaceNotes}
          itemHeight={NOTE_LIST_ROW_HEIGHT}
          ariaLabel={`Notes in ${space.name}`}
          className="mt-8 min-h-0 flex-1"
          listClassName="space-y-1 pt-2 pb-4"
          getItemKey={(note) => note.id}
          emptyState={
            <div className="px-2 py-8 text-center text-sm text-[var(--foreground-muted)]">
              No notes in this space yet
            </div>
          }
          renderItem={(note) => (
            <NoteListRow
              note={note}
              spaceChips={resolveNoteSpaceChips(note.spaceIds, spaceItems)}
              selected={false}
              checked={false}
              selectionMode={false}
              focused={false}
              touchActionsEnabled={false}
              swipeOpen={false}
              onSwipeOpenChange={() => {}}
              onSelect={() => onOpenNote(note.id)}
              onToggleCheck={() => {}}
              onFocus={() => {}}
              onContextMenu={(event) => event.preventDefault()}
              onDelete={() => {}}
              onDuplicate={() => {}}
              formatRelative={formatRelative}
            />
          )}
        />
      </div>
    </div>
  );
}
