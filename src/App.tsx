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
import { SearchPanel } from "./screens/SearchPanel";
import { pickFolder } from "./lib/fs/picker";
import { getCompatibility } from "./lib/compatibility";
import { Unsupported } from "./screens/Unsupported";
import { openOrInitialize } from "./lib/fs/vault";
import {
  createNote,
  deleteNote,
  listNotes,
  readNote,
  updateNote,
} from "./lib/notes/storage";
import { storeAttachment } from "./lib/attachments/storage";
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const refreshList = useCallback(async (root: FileSystemDirectoryHandle) => {
    setNotes(await listNotes({ root }));
  }, []);

  const handlePick = useCallback(async () => {
    try {
      setError(null);
      const handle = await pickFolder();
      if (!handle) return;
      await openOrInitialize(handle);
      setVault({ root: handle });
      imageCacheRef.current?.dispose();
      imageCacheRef.current = new AttachmentURLCache(handle);
      await refreshList(handle);
      // Spin up search + embedder lazily — the worker downloads the model in
      // the background on first use.
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
            setEmbedderReady(true);
          }
        } catch (err) {
          setError((err as Error).message);
        }
      })();
    } catch (err) {
      setError((err as Error).message);
    }
  }, [refreshList]);

  const runReindex = useCallback(async () => {
    if (!vault || !embedderRef.current) return;
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
    } finally {
      setReindexing(false);
    }
  }, [vault]);

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

  const requestDelete = useCallback(() => setConfirmDelete(true), []);

  const handleDelete = useCallback(async () => {
    if (!vault || !current) return;
    const deletedId = current.record.id;
    await deleteNote({ root: vault.root }, deletedId);
    setCurrent(null);
    setConfirmDelete(false);
    await refreshList(vault.root);
    // Drop the embeddings file too. Cheap and avoids stale hits.
    if (embedderRef.current && searchApiRef.current) {
      const live = await listNotes({ root: vault.root });
      await searchApiRef.current.pruneOrphans(
        vault.root,
        live.map((n) => n.id),
      );
    }
  }, [vault, current, refreshList]);

  const persist = useCallback(
    async (id: string, title: string, body: string) => {
      if (!vault) return;
      const updated = await updateNote({ root: vault.root }, id, { title, body });
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
    [vault, refreshList, embedderReady],
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
      const result = await storeAttachment(vault.root, current.record.id, file);
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
          <SearchPanel
            ready={embedderReady}
            reindexing={reindexing}
            reindexProgress={reindexProgress}
            onSearch={onSearch}
            onOpenHit={openHit}
            onReindex={runReindex}
          />
          <NotesList
            notes={notes}
            selectedId={current?.record.id ?? null}
            onSelect={handleSelect}
            onCreate={handleCreate}
          />
        </div>
      }
    >
      {current ? (
        <div className="flex h-full flex-col">
          <NoteHeader
            title={current.title}
            onTitleChange={onTitleChange}
            onDelete={requestDelete}
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
        open={confirmDelete}
        title="Delete this note?"
        description={
          current
            ? `“${current.title || "Untitled"}” will be removed permanently from this device.`
            : undefined
        }
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
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
