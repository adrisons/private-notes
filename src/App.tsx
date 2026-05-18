import { useCallback, useEffect, useState } from "react";
import { AppShell } from "./ui/AppShell";
import { Logo } from "./ui/Logo";
import { Welcome } from "./screens/Welcome";
import { NotesList } from "./screens/NotesList";
import { NoteHeader } from "./screens/NoteHeader";
import { EmptyState } from "./screens/EmptyState";
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
    } catch (err) {
      setError((err as Error).message);
    }
  }, [refreshList]);

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
        <NotesList
          notes={notes}
          selectedId={current?.record.id ?? null}
          onSelect={handleSelect}
          onCreate={handleCreate}
        />
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
