import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "./ui/AppShell";
import { Logo } from "./ui/Logo";
import { Welcome } from "./screens/Welcome";
import { NotesList } from "./screens/NotesList";
import { NoteHeader } from "./screens/NoteHeader";
import { EmptyState } from "./screens/EmptyState";
import { SidebarSearch } from "./screens/SidebarSearch";
import { getCompatibility } from "./lib/compatibility";
import { Unsupported } from "./screens/Unsupported";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { ThemeToggle } from "./ui/ThemeToggle";
import { CommandPalette } from "./screens/CommandPalette";
import { useVaultSession } from "./application/hooks/useVaultSession";
import { useCurrentNote } from "./application/hooks/useCurrentNote";
import { useSemanticIndex } from "./application/hooks/useSemanticIndex";
import { useAttachments } from "./application/hooks/useAttachments";

const Editor = lazy(() =>
  import("./editor/Editor").then((m) => ({ default: m.Editor })),
);

const compat = getCompatibility();

export function App() {
  const flushRef = useRef<() => void>(() => {});
  const vault = useVaultSession({
    flushBeforeSwitch: () => flushRef.current(),
  });
  const search = useSemanticIndex({
    session: vault.session,
    onError: vault.setError,
  });
  const note = useCurrentNote({
    session: vault.session,
    current: vault.current,
    setCurrent: vault.setCurrent,
    refreshSummaries: vault.refreshSummaries,
    scheduleReindex: search.scheduleReindex,
    embedderReady: search.embedderReady,
  });
  flushRef.current = note.flushPersist;

  const attachments = useAttachments({
    session: vault.session,
    currentNoteId: vault.current?.id ?? null,
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
        <div className="flex h-full items-center justify-center text-sm text-[var(--color-muted-foreground)]">
          Loading…
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
      sidebar={
        <div className="flex h-full flex-col">
          <SidebarSearch
            ready={search.embedderReady}
            reindexing={search.reindexing}
            progress={search.reindexProgress}
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
        <div className="flex h-full flex-col">
          <NoteHeader
            title={vault.current.title}
            onTitleChange={note.onTitleChange}
            onDelete={() => requestDelete()}
            onInsertImage={() => {
              /* the editor toolbar's hidden input handles file selection */
            }}
            savedAt={vault.current.savedAt}
          />
          <div className="flex-1">
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center text-sm text-muted">
                  Loading editor…
                </div>
              }
            >
              <Editor
                key={vault.current.id}
                value={vault.current.body}
                onChange={note.onBodyChange}
                onUploadImage={attachments.onUploadImage}
                resolveImageSrc={attachments.resolveImageSrc}
              />
            </Suspense>
          </div>
        </div>
      ) : (
        <EmptyState onCreate={note.createNote} />
      )}
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
        onOpenHit={note.openSearchHit}
        onCreate={note.createNote}
      />
    </AppShell>
  );
}
