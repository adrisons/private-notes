import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "./ui/AppShell";
import { Logo } from "./ui/Logo";
import { Welcome } from "./screens/Welcome";
import { NotesList } from "./screens/NotesList";
import { NoteHeader } from "./screens/NoteHeader";
import { EmptyState } from "./screens/EmptyState";
import { SearchPanel } from "./screens/SearchPanel";
import { Editor } from "./editor/Editor";
import { isFileSystemAccessSupported, pickFolder } from "./lib/fs/picker";
import { openOrInitialize } from "./lib/fs/vault";
import {
  createNote,
  deleteNote,
  listNotes,
  readNote,
  updateNote,
} from "./lib/notes/storage";
import { storeAttachment } from "./lib/attachments/storage";
import type { NoteRecord } from "./lib/fs/types";
import { useDebouncedCallback } from "./lib/useDebouncedCallback";
import {
  DEFAULT_MODEL_ID,
  TransformersEmbedder,
} from "./lib/search/transformers-embedder";
import { reindex, pruneOrphans } from "./lib/search/indexer";
import { searchSemantic, type SearchHit } from "./lib/search/search";

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

const supported = isFileSystemAccessSupported();

export function App() {
  const [vault, setVault] = useState<VaultState | null>(null);
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [current, setCurrent] = useState<CurrentNote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const embedderRef = useRef<TransformersEmbedder | null>(null);
  const [embedderReady, setEmbedderReady] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [reindexProgress, setReindexProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);

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
      await refreshList(handle);
      // Spin up the embedder lazily — the worker downloads the model in the
      // background on first use.
      if (!embedderRef.current) {
        const emb = new TransformersEmbedder(DEFAULT_MODEL_ID);
        embedderRef.current = emb;
        emb
          .ready()
          .then(() => setEmbedderReady(true))
          .catch((err) => setError((err as Error).message));
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }, [refreshList]);

  const runReindex = useCallback(async () => {
    if (!vault || !embedderRef.current) return;
    setReindexing(true);
    setReindexProgress({ done: 0, total: 0 });
    try {
      const live = await listNotes({ root: vault.root });
      await pruneOrphans(vault.root, live.map((n) => n.id));
      await reindex(vault.root, live, embedderRef.current, {
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
      return searchSemantic(vault.root, query, embedderRef.current, {
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

  const handleDelete = useCallback(async () => {
    if (!vault || !current) return;
    await deleteNote({ root: vault.root }, current.record.id);
    setCurrent(null);
    await refreshList(vault.root);
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
    },
    [vault, refreshList],
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

  // If the picked folder/vault changes, drop the active note.
  useEffect(() => {
    if (!vault) setCurrent(null);
  }, [vault]);

  if (!vault) {
    return (
      <AppShell header={<Logo />}>
        <Welcome
          onPickFolder={handlePick}
          disabled={!supported}
          disabledReason={
            !supported
              ? "This browser does not support the File System Access API. Open the app in Chrome, Edge, Brave, Opera, or Arc."
              : (error ?? undefined)
          }
        />
      </AppShell>
    );
  }

  return (
    <AppShell
      header={<Logo />}
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
            onDelete={handleDelete}
            onInsertImage={() => {
              /* the editor toolbar's hidden input handles file selection */
            }}
            savedAt={current.savedAt}
          />
          <div className="flex-1">
            <Editor
              key={current.record.id}
              value={current.body}
              onChange={onBodyChange}
              onUploadImage={onUploadImage}
            />
          </div>
        </div>
      ) : (
        <EmptyState onCreate={handleCreate} />
      )}
    </AppShell>
  );
}
