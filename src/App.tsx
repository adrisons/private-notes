import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "./ui/AppShell";
import { Logo } from "./ui/Logo";
import { Toast } from "./ui/Toast";
import { Welcome } from "./screens/Welcome";
import { NotesList } from "./screens/NotesList";
import { NoteHeader } from "./screens/NoteHeader";
import { EmptyState } from "./screens/EmptyState";
import { SidebarSearch } from "./screens/SidebarSearch";
import { VaultIndicator } from "./screens/VaultIndicator";
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

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const currentNoteId = vault.current?.id ?? null;

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
      if (targetId) setPendingDeleteId(targetId);
    },
    [currentNoteId],
  );

  const handleDelete = useCallback(async () => {
    if (!pendingDeleteId) return;
    const deletedId = pendingDeleteId;
    await note.deleteNote(deletedId);
    setPendingDeleteId(null);
    if (search.embedderReady) {
      await search.pruneOrphans();
    }
  }, [pendingDeleteId, note, search]);

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
      <AppShell header={headerNode}>
        <Welcome
          onPickFolder={vault.handlePick}
          disabledReason={vault.error ?? undefined}
        />
      </AppShell>
    );
  }

  return (
    <AppShell
      header={headerNode}
      // Picking a note collapses the mobile panel (docs/design.md §8).
      collapseKey={currentNoteId}
      sidebar={
        <div className="flex h-full flex-col">
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
            selectedId={vault.current?.id ?? null}
            onSelect={note.openNoteById}
            onCreate={note.createNote}
            onDelete={requestDelete}
            onDuplicate={note.duplicateNote}
          />
        </div>
      }
    >
      {vault.current ? (
        <div
          key={vault.current.id}
          className="u-content-swap flex h-full flex-col"
        >
          <NoteHeader
            title={vault.current.title}
            onTitleChange={note.onTitleChange}
            onDelete={() => requestDelete()}
            savedAt={vault.current.savedAt}
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
                value={vault.current.body}
                onChange={note.onBodyChange}
                onUploadImage={attachments.onUploadImage}
                resolveImageSrc={attachments.resolveImageSrc}
              />
            </Suspense>
          </div>
        </div>
      ) : (
        <EmptyState key="empty" onCreate={note.createNote} />
      )}
      {toast ? (
        <Toast
          message={toast.message}
          fixHint={toast.fixHint}
          onDismiss={dismiss}
        />
      ) : null}
      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Delete this note?"
        description={
          pendingDeleteId
            ? `“${vault.noteItems.find((n) => n.id === pendingDeleteId)?.title || "Untitled"}” will be removed permanently from this device.`
            : undefined
        }
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setPendingDeleteId(null)}
      />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        notes={vault.noteItems}
        searchReady={search.embedderReady}
        onSearch={search.onSearch}
        onOpenNote={note.openNoteById}
        onCreate={note.createNote}
      />
    </AppShell>
  );
}
