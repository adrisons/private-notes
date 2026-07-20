import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { ContextMenu } from "../ui/ContextMenu";
import {
  VirtualList,
  NOTE_LIST_ROW_HEIGHT,
  type VirtualListHandle,
} from "../ui/VirtualList";
import {
  SIDEBAR_LIST_GAP_CLASS,
  SIDEBAR_LIST_INSET_CLASS,
} from "../ui/sidebar-list-layout";
import { useTouchActionsEnabled } from "../lib/touch-actions";
import { formatRelative } from "../lib/format-relative";
import { NoteListRow } from "./NoteListRow";
import { SpaceListRow, SPACE_LIST_ROW_HEIGHT } from "./SpaceListRow";
import {
  isGeneralSpaceId,
  resolveNoteSpaceChips,
  type NoteListItem,
  type SpaceId,
  type SpaceListItem,
} from "../application/view-models";
import { cn } from "../lib/cn";

export type SidebarMode = "notes" | "spaces";

interface NotesListProps {
  notes: NoteListItem[];
  spaceItems: SpaceListItem[];
  mode: SidebarMode;
  onToggleMode: () => void;
  selectedNoteId: string | null;
  selectedSpaceId: SpaceId | null;
  onSelectNote: (id: string) => void;
  onSelectSpace: (id: SpaceId) => void;
  onCreateNote: () => void;
  onCreateSpace: () => void;
  onDeleteNote: (id: string) => void;
  onBulkDeleteNotes: (ids: string[]) => void;
  onDeleteSpaces: (ids: SpaceId[]) => void;
  onDuplicateNote: (id: string) => void;
  className?: string;
}

interface OpenMenu {
  x: number;
  y: number;
  noteId: string;
}

function SidebarModeIcon() {
  return (
    <svg
      aria-hidden
      className="gesture-icon h-3.5 w-3.5"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="2" width="5" height="5" rx="1" />
      <rect x="9" y="2" width="5" height="5" rx="1" />
      <rect x="2" y="9" width="5" height="5" rx="1" />
      <rect x="9" y="9" width="5" height="5" rx="1" />
    </svg>
  );
}

export function NotesList({
  notes,
  spaceItems,
  mode,
  onToggleMode,
  selectedNoteId,
  selectedSpaceId,
  onSelectNote,
  onSelectSpace,
  onCreateNote,
  onCreateSpace,
  onDeleteNote,
  onBulkDeleteNotes,
  onDeleteSpaces,
  onDuplicateNote,
  className,
}: NotesListProps) {
  const [menu, setMenu] = useState<OpenMenu | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => new Set());
  const [pendingDeleteSpaceIds, setPendingDeleteSpaceIds] = useState<
    SpaceId[]
  >([]);

  const noteRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const spaceRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const virtualListRef = useRef<VirtualListHandle>(null);
  const anchorIndexRef = useRef(0);
  const touchActionsEnabled = useTouchActionsEnabled();

  const sortedNotes = useMemo(
    () =>
      [...notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [notes],
  );

  const selectableSpaces = useMemo(
    () => spaceItems.filter((space) => !isGeneralSpaceId(space.id)),
    [spaceItems],
  );

  const spaceChipsFor = useCallback(
    (note: NoteListItem) =>
      resolveNoteSpaceChips(note.spaceIds, spaceItems, { omitGeneral: true }),
    [spaceItems],
  );

  const menuNote = menu
    ? sortedNotes.find((n) => n.id === menu.noteId)
    : undefined;

  const checkedCount = checkedIds.size;
  const isNotesMode = mode === "notes";
  const listItemsLength = isNotesMode ? sortedNotes.length : spaceItems.length;

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setCheckedIds(new Set());
    setOpenSwipeId(null);
  }, []);

  const enterSelectionMode = useCallback(() => {
    anchorIndexRef.current = focusedIndex;
    setSelectionMode(true);
    setCheckedIds(new Set());
    setMenu(null);
    setOpenSwipeId(null);
  }, [focusedIndex]);

  useEffect(() => {
    exitSelectionMode();
    setFocusedIndex(0);
  }, [mode, exitSelectionMode]);

  const handleCheckClick = useCallback(
    (index: number, shiftKey: boolean) => {
      if (isNotesMode) {
        const note = sortedNotes[index];
        if (!note) return;

        if (shiftKey) {
          const anchor = anchorIndexRef.current;
          const start = Math.min(anchor, index);
          const end = Math.max(anchor, index);
          setCheckedIds((prev) => {
            const next = new Set(prev);
            for (let i = start; i <= end; i++) {
              next.add(sortedNotes[i].id);
            }
            return next;
          });
          return;
        }

        anchorIndexRef.current = index;
        setCheckedIds((prev) => {
          const next = new Set(prev);
          if (next.has(note.id)) next.delete(note.id);
          else next.add(note.id);
          return next;
        });
        return;
      }

      const space = spaceItems[index];
      if (!space || isGeneralSpaceId(space.id)) return;

      if (shiftKey) {
        const anchor = anchorIndexRef.current;
        const start = Math.min(anchor, index);
        const end = Math.max(anchor, index);
        setCheckedIds((prev) => {
          const next = new Set(prev);
          for (let i = start; i <= end; i++) {
            const candidate = spaceItems[i];
            if (candidate && !isGeneralSpaceId(candidate.id)) {
              next.add(candidate.id);
            }
          }
          return next;
        });
        return;
      }

      anchorIndexRef.current = index;
      setCheckedIds((prev) => {
        const next = new Set(prev);
        if (next.has(space.id)) next.delete(space.id);
        else next.add(space.id);
        return next;
      });
    },
    [isNotesMode, sortedNotes, spaceItems],
  );

  const requestBulkDelete = useCallback(() => {
    if (checkedIds.size === 0) return;
    if (isNotesMode) {
      onBulkDeleteNotes([...checkedIds]);
      exitSelectionMode();
      return;
    }
    setPendingDeleteSpaceIds([...checkedIds] as SpaceId[]);
    exitSelectionMode();
  }, [checkedIds, isNotesMode, onBulkDeleteNotes, exitSelectionMode]);

  const focusRow = useCallback((index: number) => {
    virtualListRef.current?.scrollToIndex(index);
    if (isNotesMode) {
      noteRefs.current[index]?.focus();
    } else {
      spaceRefs.current[index]?.focus();
    }
  }, [isNotesMode]);

  useEffect(() => {
    if (!isNotesMode || !selectedNoteId) return;
    const index = sortedNotes.findIndex((note) => note.id === selectedNoteId);
    if (index >= 0) setFocusedIndex(index);
  }, [isNotesMode, selectedNoteId, sortedNotes]);

  useEffect(() => {
    if (isNotesMode || !selectedSpaceId) return;
    const index = spaceItems.findIndex((space) => space.id === selectedSpaceId);
    if (index >= 0) setFocusedIndex(index);
  }, [isNotesMode, selectedSpaceId, spaceItems]);

  useEffect(() => {
    if (focusedIndex >= listItemsLength) {
      setFocusedIndex(Math.max(0, listItemsLength - 1));
    }
  }, [focusedIndex, listItemsLength]);

  useEffect(() => {
    const list = listRef.current;
    if (!list || !openSwipeId) return;
    const scrollRoot =
      list.closest("[data-virtual-list-scroll]") ?? list;
    const close = () => setOpenSwipeId(null);
    scrollRoot.addEventListener("scroll", close, { passive: true });
    return () => scrollRoot.removeEventListener("scroll", close);
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
    if ((isNotesMode && menu) || listItemsLength === 0) return;

    if (event.key === "Escape" && selectionMode) {
      event.preventDefault();
      exitSelectionMode();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setFocusedIndex((index) => {
        const next = Math.min(listItemsLength - 1, index + 1);
        focusRow(next);
        return next;
      });
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setFocusedIndex((index) => {
        const next = Math.max(0, index - 1);
        focusRow(next);
        return next;
      });
      return;
    }

    if (isNotesMode) {
      if (event.key === "Home") {
        event.preventDefault();
        setFocusedIndex(0);
        focusRow(0);
        return;
      }

      if (event.key === "End") {
        event.preventDefault();
        const last = sortedNotes.length - 1;
        setFocusedIndex(last);
        focusRow(last);
        return;
      }
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (isNotesMode) {
        const note = sortedNotes[focusedIndex];
        if (!note) return;
        if (selectionMode) handleCheckClick(focusedIndex, event.shiftKey);
        else onSelectNote(note.id);
        return;
      }

      const space = spaceItems[focusedIndex];
      if (!space) return;
      if (selectionMode && !isGeneralSpaceId(space.id)) {
        handleCheckClick(focusedIndex, event.shiftKey);
      } else if (!selectionMode) {
        onSelectSpace(space.id);
      }
      return;
    }

    if (isNotesMode) {
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        const note = sortedNotes[focusedIndex];
        if (!note) return;
        if (selectionMode) {
          if (checkedIds.size > 0) requestBulkDelete();
          else handleCheckClick(focusedIndex, false);
        } else {
          onDeleteNote(note.id);
        }
        return;
      }

      if (
        !selectionMode &&
        (event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey))
      ) {
        event.preventDefault();
        openMenuForIndex(focusedIndex);
      }
    }
  };

  const headerLabel = isNotesMode ? "Notes" : "Spaces";
  const selectionLabel = isNotesMode
    ? checkedCount === 0
      ? "Select notes"
      : `${checkedCount} selected`
    : checkedCount === 0
      ? "Select spaces"
      : `${checkedCount} selected`;
  const emptyLabel = isNotesMode ? "No notes yet" : "No spaces yet";
  const listAriaLabel = isNotesMode ? "Notes" : "Spaces";
  const canSelect =
    isNotesMode ? sortedNotes.length > 0 : selectableSpaces.length > 0;

  return (
    <section className={cn("flex flex-col", className)}>
      <div className="flex shrink-0 items-center justify-between gap-2 px-4 py-3">
        {selectionMode ? (
          <span className="min-w-0 truncate text-xs font-medium uppercase tracking-wider text-[var(--foreground-muted)]">
            {selectionLabel}
          </span>
        ) : (
          <button
            type="button"
            onClick={onToggleMode}
            data-mode={mode}
            className="gesture-sidebar-mode u-press u-focus inline-flex min-w-0 cursor-pointer items-center gap-1.5 truncate rounded-[var(--radius-md)] px-2 py-1.5 text-xs font-medium uppercase tracking-wider text-[var(--foreground-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--foreground)]"
            aria-label={
              isNotesMode ? "Switch to spaces list" : "Switch to notes list"
            }
          >
            <SidebarModeIcon />
            {headerLabel}
          </button>
        )}
        <div className="flex shrink-0 items-center gap-1.5">
          {selectionMode ? (
            <>
              <Button
                size="sm"
                variant="danger"
                onClick={requestBulkDelete}
                disabled={checkedCount === 0}
                aria-label={
                  isNotesMode
                    ? checkedCount === 0
                      ? "Delete selected notes"
                      : `Delete ${checkedCount} selected notes`
                    : checkedCount === 0
                      ? "Delete selected spaces"
                      : `Delete ${checkedCount} selected spaces`
                }
              >
                Delete
              </Button>
              <Button size="sm" variant="secondary" onClick={exitSelectionMode}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={enterSelectionMode}
                disabled={!canSelect}
              >
                Select
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={isNotesMode ? onCreateNote : onCreateSpace}
                className="gesture-create"
              >
                <span aria-hidden className="gesture-icon text-base leading-none">
                  +
                </span>
                New
              </Button>
            </>
          )}
        </div>
      </div>
      <div key={mode} className="u-sidebar-list-swap flex flex-col">
        {isNotesMode ? (
          <VirtualList
            ref={virtualListRef}
            items={sortedNotes}
            itemHeight={NOTE_LIST_ROW_HEIGHT}
            ariaLabel={listAriaLabel}
            scrollMode="external"
            className={SIDEBAR_LIST_INSET_CLASS}
            listClassName={SIDEBAR_LIST_GAP_CLASS}
            listRef={listRef}
            ariaMultiselectable={selectionMode || undefined}
            onKeyDown={handleListKeyDown}
            getItemKey={(note) => note.id}
            emptyState={
              <div className="px-2 py-8 text-center text-sm text-[var(--foreground-muted)]">
                {emptyLabel}
              </div>
            }
            renderItem={(n, index) => (
              <NoteListRow
                ref={(el) => {
                  noteRefs.current[index] = el;
                }}
                note={n}
                spaceChips={spaceChipsFor(n)}
                selected={selectedNoteId === n.id}
                checked={checkedIds.has(n.id)}
                selectionMode={selectionMode}
                focused={index === focusedIndex}
                touchActionsEnabled={touchActionsEnabled}
                swipeOpen={openSwipeId === n.id}
                onSwipeOpenChange={(open) => {
                  setOpenSwipeId(open ? n.id : null);
                }}
                onSelect={() => onSelectNote(n.id)}
                onToggleCheck={(shiftKey) => handleCheckClick(index, shiftKey)}
                onFocus={() => setFocusedIndex(index)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setFocusedIndex(index);
                  openMenuAt(index, e.currentTarget, {
                    x: e.clientX,
                    y: e.clientY,
                  });
                }}
                onDelete={() => onDeleteNote(n.id)}
                onDuplicate={() => onDuplicateNote(n.id)}
                formatRelative={formatRelative}
              />
            )}
          />
        ) : (
          <VirtualList
            ref={virtualListRef}
            items={spaceItems}
            itemHeight={SPACE_LIST_ROW_HEIGHT}
            ariaLabel={listAriaLabel}
            scrollMode="external"
            className={SIDEBAR_LIST_INSET_CLASS}
            listClassName={SIDEBAR_LIST_GAP_CLASS}
            listRef={listRef}
            ariaMultiselectable={selectionMode || undefined}
            onKeyDown={handleListKeyDown}
            getItemKey={(space) => space.id}
            emptyState={
              <div className="px-2 py-8 text-center text-sm text-[var(--foreground-muted)]">
                {emptyLabel}
              </div>
            }
            renderItem={(space, index) => (
              <SpaceListRow
                ref={(el) => {
                  spaceRefs.current[index] = el;
                }}
                space={space}
                selected={selectedSpaceId === space.id}
                checked={checkedIds.has(space.id)}
                selectionMode={selectionMode}
                selectable={!isGeneralSpaceId(space.id)}
                focused={index === focusedIndex}
                onSelect={() => onSelectSpace(space.id)}
                onToggleCheck={(shiftKey) => handleCheckClick(index, shiftKey)}
                onFocus={() => setFocusedIndex(index)}
              />
            )}
          />
        )}
      </div>
      {menu && menuNote ? (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          returnFocusRef={menuTriggerRef}
          items={[
            {
              label: "Duplicate note",
              onSelect: () => onDuplicateNote(menu.noteId),
            },
            {
              label: "Delete note",
              destructive: true,
              onSelect: () => onDeleteNote(menu.noteId),
            },
          ]}
        />
      ) : null}
      <ConfirmDialog
        open={pendingDeleteSpaceIds.length > 0}
        title={
          pendingDeleteSpaceIds.length === 1
            ? `Delete “${spaceItems.find((s) => s.id === pendingDeleteSpaceIds[0])?.name}” space?`
            : `Delete ${pendingDeleteSpaceIds.length} spaces?`
        }
        description="Notes in deleted spaces will move to General."
        confirmLabel="Delete space"
        destructive
        onConfirm={() => {
          onDeleteSpaces(pendingDeleteSpaceIds);
          setPendingDeleteSpaceIds([]);
        }}
        onCancel={() => setPendingDeleteSpaceIds([])}
      />
    </section>
  );
}
