import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "./ui/AppShell";
import { Logo } from "./ui/Logo";
import { Toast } from "./ui/Toast";
import { Welcome } from "./screens/Welcome";
import { NotesList, type SidebarMode } from "./screens/NotesList";
import { NoteHeader } from "./screens/NoteHeader";
import { EmptyState } from "./screens/EmptyState";
import { SidebarSearch } from "./screens/SidebarSearch";
import { VaultIndicator } from "./screens/VaultIndicator";
import { VaultOpenDialogs } from "./screens/VaultOpenDialogs";
import { SpaceDetailView } from "./screens/SpaceDetailView";
import { getCompatibility } from "./lib/compatibility";
import { Unsupported } from "./screens/Unsupported";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { ThemeToggle } from "./ui/ThemeToggle";
import { CommandPalette } from "./screens/CommandPalette";
import { useAppToast } from "./application/hooks/useAppToast";
import { useVaultSession } from "./application/hooks/useVaultSession";
import { useCurrentNote } from "./application/hooks/useCurrentNote";
import { useSemanticIndex } from "./application/hooks/useSemanticIndex";
import { useAttachments } from "./application/hooks/useAttachments";
import { useSpaces } from "./application/hooks/useSpaces";
import {
  FALLBACK_SPACE_NAME,
  type SpaceColorId,
  type SpaceId,
} from "./application/view-models";

const Editor = lazy(() =>
  import("./editor/Editor").then((m) => ({ default: m.Editor })),
);

const compat = getCompatibility();

export function App() {
  const { toast, showError, dismiss } = useAppToast();
  const flushRef = useRef<() => void>(() => {});
  const vault = useVaultSession({
    flushBeforeSwitch: () => flushRef.current(),
  });
  const search = useSemanticIndex({
    session: vault.session,
    onError: showError,
  });
  const note = useCurrentNote({
    session: vault.session,
    current: vault.current,
    setCurrent: vault.setCurrent,
    refreshSummaries: vault.refreshSummaries,
    scheduleReindex: search.scheduleReindex,
    embedderReady: search.embedderReady,
    onError: showError,
  });
  flushRef.current = note.flushPersist;

  const attachments = useAttachments({
    session: vault.session,
    currentNoteId: vault.current?.id ?? null,
    onError: showError,
  });

  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
  const [pendingDeleteSpaceIds, setPendingDeleteSpaceIds] = useState<
    SpaceId[]
  >([]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>("notes");
  const [selectedSpaceId, setSelectedSpaceId] = useState<SpaceId | null>(null);
  const currentNoteId = vault.current?.id ?? null;

  const spaces = useSpaces({
    session: vault.session,
    noteItems: vault.noteItems,
    refreshSummaries: vault.refreshSummaries,
    onError: showError,
  });

  const selectedSpace = selectedSpaceId
    ? spaces.spaceItems.find((space) => space.id === selectedSpaceId) ?? null
    : null;

  const openNote = useCallback(
    (id: string) => {
      setSelectedSpaceId(null);
      void note.openNoteById(id);
    },
    [note],
  );

  const openSpace = useCallback(
    (id: SpaceId) => {
      note.flushPersist();
      setSelectedSpaceId(id);
    },
    [note],
  );

  const handleCreateNote = useCallback(async () => {
    setSelectedSpaceId(null);
    await note.createNote();
  }, [note]);

  const handleCreateSpace = useCallback(async () => {
    note.flushPersist();
    const id = await spaces.createSpace({
      name: FALLBACK_SPACE_NAME,
      colorId: "blue" satisfies SpaceColorId,
    });
    if (id) {
      vault.setCurrent(null);
      setSelectedSpaceId(id);
    }
  }, [note, spaces, vault]);

  const toggleSidebarMode = useCallback(() => {
    setSidebarMode((mode) => (mode === "notes" ? "spaces" : "notes"));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const requestDelete = useCallback(
    (id?: string) => {
      const targetId = id ?? currentNoteId;
      if (targetId) setPendingDeleteIds([targetId]);
    },
    [currentNoteId],
  );

  const requestBulkDelete = useCallback((ids: string[]) => {
    if (ids.length > 0) setPendingDeleteIds(ids);
  }, []);

  const handleDelete = useCallback(async () => {
    if (pendingDeleteIds.length === 0) return;
    const ids = pendingDeleteIds;
    if (ids.length === 1) {
      await note.deleteNote(ids[0]);
    } else {
      await note.deleteNotes(ids);
    }
    setPendingDeleteIds([]);
    if (search.embedderReady) {
      await search.pruneOrphans();
    }
  }, [pendingDeleteIds, note, search]);

  const handleDeleteSpaces = useCallback(
    async (ids: SpaceId[]) => {
      await spaces.deleteSpaces(ids);
      if (selectedSpaceId && ids.includes(selectedSpaceId)) {
        setSelectedSpaceId(null);
      }
    },
    [spaces, selectedSpaceId],
  );

  const pendingDeleteTitle =
    pendingDeleteIds.length === 1
      ? vault.noteItems.find((n) => n.id === pendingDeleteIds[0])?.title ||
        "Untitled"
      : null;
  const deleteDialogTitle =
    pendingDeleteIds.length <= 1
      ? "Delete this note?"
      : `Delete ${pendingDeleteIds.length} notes?`;
  const deleteDialogDescription =
    pendingDeleteIds.length === 0
      ? undefined
      : pendingDeleteIds.length === 1
        ? `“${pendingDeleteTitle}” will be removed permanently from this device.`
        : `These ${pendingDeleteIds.length} notes will be removed permanently from this device.`;

  const headerNode = (
    <div className="flex w-full items-center justify-between">
      <Logo />
      <ThemeToggle />
    </div>
  );

  if (!compat.supported) {
    return (
      <AppShell header={headerNode}>
        <Unsupported reasons={compat.reasons} />
      </AppShell>
    );
  }

  if (vault.booting) {
    return (
      <AppShell header={headerNode}>
        <div
          className="flex h-full items-center justify-center text-sm text-[var(--foreground-muted)]"
          aria-live="polite"
        >
          <span className="u-glow">Loading…</span>
        </div>
      </AppShell>
    );
  }

  if (!vault.session) {
    return (
      <>
        <AppShell header={headerNode}>
          <Welcome
            onPickFolder={vault.handlePick}
            disabledReason={
              vault.openIssue ? undefined : (vault.error ?? undefined)
            }
          />
        </AppShell>
        <VaultOpenDialogs vault={vault} />
      </>
    );
  }

  return (
    <AppShell
      header={headerNode}
      collapseKey={currentNoteId ?? selectedSpaceId}
      sidebar={
        <div className="flex flex-col">
          <VaultIndicator
            name={vault.session.root.name}
            onChange={vault.handlePick}
          />
          <SidebarSearch
            ready={search.embedderReady}
            reindexing={search.reindexing}
            progress={search.reindexProgress}
            indexError={search.indexError}
            onOpenCommandPalette={() => setPaletteOpen(true)}
            onReindex={search.runReindex}
          />
          <NotesList
            notes={vault.noteItems}
            spaceItems={spaces.spaceItems}
            mode={sidebarMode}
            onToggleMode={toggleSidebarMode}
            selectedNoteId={currentNoteId}
            selectedSpaceId={selectedSpaceId}
            onSelectNote={openNote}
            onSelectSpace={openSpace}
            onCreateNote={() => void handleCreateNote()}
            onCreateSpace={() => void handleCreateSpace()}
            onDeleteNote={requestDelete}
            onBulkDeleteNotes={requestBulkDelete}
            onDeleteSpaces={(ids) => void handleDeleteSpaces(ids)}
            onDuplicateNote={note.duplicateNote}
          />
        </div>
      }
    >
      {selectedSpace ? (
        <div key={selectedSpace.id} className="u-content-swap flex h-full min-h-0 flex-col overflow-y-auto">
          <SpaceDetailView
            space={selectedSpace}
            notes={vault.noteItems}
            spaceItems={spaces.spaceItems}
            onOpenNote={openNote}
            onUpdateSpace={spaces.updateSpace}
            onDelete={() => setPendingDeleteSpaceIds([selectedSpace.id])}
          />
        </div>
      ) : vault.current ? (
        <div
          key={vault.current.id}
          className="u-content-swap flex h-full min-h-0 flex-col overflow-y-auto"
        >
          <NoteHeader
            title={vault.current.title}
            spaceIds={vault.current.spaceIds}
            spaces={spaces.spaceItems}
            onTitleChange={note.onTitleChange}
            onSpacesChange={note.onSpacesChange}
            onCreateSpace={spaces.createSpace}
            onDelete={() => requestDelete()}
            createdAt={vault.current.createdAt}
            updatedAt={vault.current.updatedAt}
            isSaving={note.isSaving}
          />
          <div className="flex-1">
            <Suspense
              fallback={
                <div
                  className="flex h-full items-center justify-center text-sm text-[var(--foreground-muted)]"
                  aria-live="polite"
                >
                  <span className="u-glow">Loading editor…</span>
                </div>
              }
            >
              <Editor
                noteId={vault.current.id}
                value={vault.current.body}
                onChange={note.onBodyChange}
                onUploadImage={attachments.onUploadImage}
                resolveImageSrc={attachments.resolveImageSrc}
              />
            </Suspense>
          </div>
        </div>
      ) : (
        <EmptyState key="empty" onCreate={() => void handleCreateNote()} />
      )}
      {toast ? (
        <Toast
          message={toast.message}
          fixHint={toast.fixHint}
          onDismiss={dismiss}
        />
      ) : null}
      <ConfirmDialog
        open={pendingDeleteIds.length > 0}
        title={deleteDialogTitle}
        description={deleteDialogDescription}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setPendingDeleteIds([])}
      />
      <ConfirmDialog
        open={pendingDeleteSpaceIds.length > 0}
        title={
          pendingDeleteSpaceIds.length === 1
            ? `Delete “${spaces.spaceItems.find((s) => s.id === pendingDeleteSpaceIds[0])?.name}” space?`
            : `Delete ${pendingDeleteSpaceIds.length} spaces?`
        }
        description="Notes in deleted spaces will move to General."
        confirmLabel="Delete space"
        destructive
        onConfirm={() => {
          void handleDeleteSpaces(pendingDeleteSpaceIds);
          setPendingDeleteSpaceIds([]);
        }}
        onCancel={() => setPendingDeleteSpaceIds([])}
      />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        notes={vault.noteItems}
        spaceItems={spaces.spaceItems}
        searchReady={search.embedderReady}
        onSearch={search.onSearch}
        onOpenNote={openNote}
        onCreate={() => void handleCreateNote()}
      />
      <VaultOpenDialogs vault={vault} />
    </AppShell>
  );
}
