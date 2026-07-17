import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppShell } from "./ui/AppShell";
import { Logo } from "./ui/Logo";
import { Welcome } from "./screens/Welcome";
import { NotesList } from "./screens/NotesList";
import { NoteHeader } from "./screens/NoteHeader";
import { EmptyState } from "./screens/EmptyState";
import { SidebarSearch } from "./screens/SidebarSearch";
import { pickFolder } from "./lib/fs/picker";
import { getCompatibility } from "./lib/compatibility";
import { Unsupported } from "./screens/Unsupported";
import { openOrInitialize } from "./lib/fs/vault";
import { ensureReadWritePermission, hasReadWritePermission } from "./lib/fs/permissions";
import {
  clearVaultHandle,
  loadVaultHandle,
  persistVaultHandle,
} from "./lib/fs/vault-handle-store";
import {
  createNote,
  deleteNote,
  duplicateNote,
  listNotes,
  readNote,
  updateNote,
} from "./lib/notes/storage";
import { resolveVaultStartup } from "./lib/notes/startup";
import { storeAttachment } from "./lib/attachments/storage";
import { addRef } from "./lib/attachments/refs";
import { AttachmentURLCache } from "./lib/attachments/cache";
import type { NoteRecord } from "./lib/fs/types";
import { useDebouncedCallback } from "./lib/useDebouncedCallback";
import type { Embedder } from "./lib/search/embedder";
import type { SearchHit } from "./lib/search/search";
import { loadSearchApi, type SearchApi } from "./lib/search/runtime";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { ThemeToggle } from "./ui/ThemeToggle";
import { CommandPalette } from "./screens/CommandPalette";

const Editor = lazy(() =>
  import("./editor/Editor").then((m) => ({ default: m.Editor })),
);

interface VaultState {
  root: FileSystemDirectoryHandle;
}

interface CurrentNote {
  record: NoteRecord;
  title: string;
  body: string;
  /** Last successful save timestamp. */
  savedAt: string | null;
}

const compat = getCompatibility();

export function App() {
  const [vault, setVault] = useState<VaultState | null>(null);
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [current, setCurrent] = useState<CurrentNote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const embedderRef = useRef<Embedder | null>(null);
  const searchApiRef = useRef<SearchApi | null>(null);
  const imageCacheRef = useRef<AttachmentURLCache | null>(null);
  const [embedderReady, setEmbedderReady] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [reindexProgress, setReindexProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [booting, setBooting] = useState(true);

  const refreshList = useCallback(async (root: FileSystemDirectoryHandle) => {
    setNotes(await listNotes({ root }));
  }, []);

  const activateVault = useCallback(
    async (handle: FileSystemDirectoryHandle) => {
      await ensureReadWritePermission(handle);
      await openOrInitialize(handle);
      await persistVaultHandle(handle);
      imageCacheRef.current?.dispose();
      imageCacheRef.current = new AttachmentURLCache(handle);
      const startup = await resolveVaultStartup({ root: handle });
      setVault({ root: handle });
      setNotes(startup.notes);
      setCurrent(startup.current);
    },
    [],
  );

  // Re-open the last vault after a dev HMR reload or a normal page refresh.
  useEffect(() => {
    if (!compat.supported) {
      setBooting(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const handle = await loadVaultHandle();
        if (!handle || cancelled) return;
        if (!(await hasReadWritePermission(handle))) return;
        await activateVault(handle);
      } catch {
        await clearVaultHandle();
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activateVault]);

  const handlePick = useCallback(async () => {
    try {
      setError(null);
      const handle = await pickFolder();
      if (!handle) return;
      await activateVault(handle);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [activateVault]);

  // Spin up search + embedder when a vault is active. Kept out of the folder
  // picker path so a dev HMR cycle after the first dynamic import cannot race
  // with `setVault` and strand the UI on the welcome screen.
  useEffect(() => {
    if (!vault) {
      setEmbedderReady(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        if (!searchApiRef.current) {
          searchApiRef.current = await loadSearchApi();
        }
        if (!embedderRef.current) {
          const { TransformersEmbedder, DEFAULT_MODEL_ID } = await import(
            "./lib/search/transformers-embedder"
          );
          const emb = new TransformersEmbedder(DEFAULT_MODEL_ID);
          embedderRef.current = emb;
          await emb.ready();
        }
        if (!cancelled) setEmbedderReady(true);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vault]);

  const runReindex = useCallback(async () => {
    if (!vault || !embedderRef.current || reindexing) return;
    const search = searchApiRef.current ?? (await loadSearchApi());
    searchApiRef.current = search;
    setReindexing(true);
    setReindexProgress({ done: 0, total: 0 });
    try {
      const live = await listNotes({ root: vault.root });
      await search.pruneOrphans(vault.root, live.map((n) => n.id));
      await search.reindex(vault.root, live, embedderRef.current, {
        onProgress: setReindexProgress,
      });
    } catch {
      // Non-fatal — the next vault open will retry.
    } finally {
      setReindexing(false);
      setReindexProgress(null);
    }
  }, [vault, reindexing]);

  // Kick off a background reindex once the embedder is ready and we know
  // about the notes.
  useEffect(() => {
    if (embedderReady && vault) void runReindex();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedderReady, vault]);

  const onSearch = useCallback(
    async (query: string): Promise<SearchHit[]> => {
      if (!vault || !embedderRef.current) return [];
      const search = searchApiRef.current ?? (await loadSearchApi());
      searchApiRef.current = search;
      return search.searchSemantic(vault.root, query, embedderRef.current, {
        topK: 8,
        minScore: 0.15,
      });
    },
    [vault],
  );

  const openHit = useCallback(
    async (hit: SearchHit) => {
      if (!vault) return;
      const result = await readNote({ root: vault.root }, hit.noteId);
      if (!result) return;
      setCurrent({
        record: result.record,
        title: result.parsed.frontmatter.title,
        body: result.parsed.body,
        savedAt: result.record.updatedAt,
      });
    },
    [vault],
  );

  const handleSelect = useCallback(
    async (id: string) => {
      if (!vault) return;
      const result = await readNote({ root: vault.root }, id);
      if (!result) return;
      setCurrent({
        record: result.record,
        title: result.parsed.frontmatter.title,
        body: result.parsed.body,
        savedAt: result.record.updatedAt,
      });
    },
    [vault],
  );

  const handleCreate = useCallback(async () => {
    if (!vault) return;
    const rec = await createNote(
      { root: vault.root },
      { title: "Untitled", body: "" },
    );
    await refreshList(vault.root);
    setCurrent({ record: rec, title: rec.title, body: "", savedAt: rec.updatedAt });
  }, [vault, refreshList]);

  const requestDelete = useCallback(
    (id?: string) => {
      const targetId = id ?? current?.record.id;
      if (targetId) setPendingDeleteId(targetId);
    },
    [current],
  );

  const invalidateAttachmentCache = useCallback((paths: string[]) => {
    for (const path of paths) {
      imageCacheRef.current?.invalidate(path);
    }
  }, []);

  const handleDelete = useCallback(async () => {
    if (!vault || !pendingDeleteId) return;
    const deletedId = pendingDeleteId;
    const gcAttachments = await deleteNote({ root: vault.root }, deletedId);
    invalidateAttachmentCache(gcAttachments);
    if (current?.record.id === deletedId) setCurrent(null);
    setPendingDeleteId(null);
    await refreshList(vault.root);
    // Drop the embeddings file too. Cheap and avoids stale hits.
    if (embedderRef.current && searchApiRef.current) {
      const live = await listNotes({ root: vault.root });
      await searchApiRef.current.pruneOrphans(
        vault.root,
        live.map((n) => n.id),
      );
    }
  }, [vault, pendingDeleteId, current, refreshList, invalidateAttachmentCache]);

  const handleDuplicate = useCallback(
    async (id: string) => {
      if (!vault) return;
      const rec = await duplicateNote({ root: vault.root }, id);
      if (!rec) return;
      await refreshList(vault.root);
      const result = await readNote({ root: vault.root }, rec.id);
      if (!result) return;
      setCurrent({
        record: result.record,
        title: result.parsed.frontmatter.title,
        body: result.parsed.body,
        savedAt: result.record.updatedAt,
      });
      if (embedderRef.current && embedderReady && searchApiRef.current) {
        void searchApiRef.current
          .reindex(vault.root, [rec], embedderRef.current)
          .catch(() => {});
      }
    },
    [vault, refreshList, embedderReady],
  );

  const persist = useCallback(
    async (id: string, title: string, body: string) => {
      if (!vault) return;
      const { gcAttachments, ...updated } = await updateNote(
        { root: vault.root },
        id,
        { title, body },
      );
      invalidateAttachmentCache(gcAttachments);
      setCurrent((prev) =>
        prev && prev.record.id === id
          ? { ...prev, record: updated, savedAt: updated.updatedAt }
          : prev,
      );
      await refreshList(vault.root);
      // Re-embed just this note in the background so semantic search stays
      // current. Errors are non-fatal — the next full reindex will recover.
      if (embedderRef.current && embedderReady && searchApiRef.current) {
        void searchApiRef.current
          .reindex(vault.root, [updated], embedderRef.current)
          .catch(() => {});
      }
    },
    [vault, refreshList, embedderReady, invalidateAttachmentCache],
  );

  const debouncedPersist = useDebouncedCallback(persist, 500);

  const onTitleChange = (title: string) => {
    if (!current) return;
    setCurrent({ ...current, title });
    debouncedPersist(current.record.id, title, current.body);
  };

  const onBodyChange = (body: string) => {
    if (!current) return;
    setCurrent({ ...current, body });
    debouncedPersist(current.record.id, current.title, body);
  };

  const onUploadImage = useCallback(
    async (file: File): Promise<string> => {
      if (!vault || !current) throw new Error("No active note");
      const result = await storeAttachment(vault.root, file);
      await addRef(vault.root, current.record.id, result.path);
      return result.path;
    },
    [vault, current],
  );

  const resolveImageSrc = useCallback(
    async (src: string): Promise<string | null> => {
      if (!imageCacheRef.current) return null;
      return imageCacheRef.current.resolve(src);
    },
    [],
  );

  // If the picked folder/vault changes, drop the active note.
  useEffect(() => {
    if (!vault) setCurrent(null);
  }, [vault]);

  // Cmd/Ctrl-K opens the command palette.
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

  if (booting) {
    return (
      <AppShell header={headerNode}>
        <div className="flex h-full items-center justify-center text-sm text-[var(--color-muted-foreground)]">
          Loading…
        </div>
      </AppShell>
    );
  }

  if (!vault) {
    return (
      <AppShell header={headerNode}>
        <Welcome
          onPickFolder={handlePick}
          disabledReason={error ?? undefined}
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
            ready={embedderReady}
            reindexing={reindexing}
            progress={reindexProgress}
            onOpenCommandPalette={() => setPaletteOpen(true)}
            onReindex={runReindex}
          />
          <NotesList
            notes={notes}
            selectedId={current?.record.id ?? null}
            onSelect={handleSelect}
            onCreate={handleCreate}
            onDelete={requestDelete}
            onDuplicate={handleDuplicate}
          />
        </div>
      }
    >
      {current ? (
        <div className="flex h-full flex-col">
          <NoteHeader
            title={current.title}
            onTitleChange={onTitleChange}
            onDelete={() => requestDelete()}
            onInsertImage={() => {
              /* the editor toolbar's hidden input handles file selection */
            }}
            savedAt={current.savedAt}
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
                key={current.record.id}
                value={current.body}
                onChange={onBodyChange}
                onUploadImage={onUploadImage}
                resolveImageSrc={resolveImageSrc}
              />
            </Suspense>
          </div>
        </div>
      ) : (
        <EmptyState onCreate={handleCreate} />
      )}
      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Delete this note?"
        description={
          pendingDeleteId
            ? `“${notes.find((n) => n.id === pendingDeleteId)?.title || "Untitled"}” will be removed permanently from this device.`
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
        notes={notes}
        searchReady={embedderReady}
        onSearch={onSearch}
        onOpenNote={handleSelect}
        onOpenHit={openHit}
        onCreate={handleCreate}
      />
    </AppShell>
  );
}
