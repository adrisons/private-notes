import { useCallback, useRef } from "react";
import type { NoteId } from "../../domain";
import type { NoteRecord } from "../ports/note-record";
import type { VaultSession } from "../vault-session";
import type { OpenNoteState } from "../view-models";
import { noteToReindexRecord } from "../mappers/reindex";
import { useAutosave } from "./useAutosave";
import { createNote } from "../use-cases/create-note";
import { deleteNote } from "../use-cases/delete-note";
import { duplicateNote } from "../use-cases/duplicate-note";
import { openNote } from "../use-cases/open-note";

export interface UseCurrentNoteOptions {
  session: VaultSession | null;
  current: OpenNoteState | null;
  setCurrent: (current: OpenNoteState | null) => void;
  refreshSummaries: () => Promise<void>;
  scheduleReindex: (records: NoteRecord[]) => void;
  embedderReady: boolean;
}

export interface UseCurrentNoteResult {
  flushPersist: () => void;
  onTitleChange: (title: string) => void;
  onBodyChange: (body: string) => void;
  openNoteById: (id: string) => Promise<void>;
  createNote: () => Promise<void>;
  duplicateNote: (id: string) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
}

export function useCurrentNote({
  session,
  current,
  setCurrent,
  refreshSummaries,
  scheduleReindex,
  embedderReady,
}: UseCurrentNoteOptions): UseCurrentNoteResult {
  const currentIdRef = useRef<string | null>(null);
  currentIdRef.current = current?.id ?? null;

  const autosave = useAutosave({
    session,
    setCurrent,
    refreshSummaries,
    scheduleReindex,
    embedderReady,
  });

  const switchToNote = useCallback(
    async (id: string) => {
      if (!session) return;
      if (currentIdRef.current === id) return;
      autosave.flush();
      const state = await openNote(session, id as NoteId);
      if (state) setCurrent(state);
    },
    [session, setCurrent, autosave],
  );

  const onTitleChange = useCallback(
    (title: string) => {
      if (!current) return;
      setCurrent({ ...current, title });
      autosave.schedule(current.id, title, current.body);
    },
    [current, setCurrent, autosave],
  );

  const onBodyChange = useCallback(
    (body: string) => {
      if (!current) return;
      setCurrent({ ...current, body });
      autosave.schedule(current.id, current.title, body);
    },
    [current, setCurrent, autosave],
  );

  const handleCreateNote = useCallback(async () => {
    if (!session) return;
    const state = await createNote(session);
    setCurrent(state);
    await refreshSummaries();
  }, [session, setCurrent, refreshSummaries]);

  const handleDuplicateNote = useCallback(
    async (id: string) => {
      if (!session) return;
      const result = await duplicateNote(session, id as NoteId);
      if (!result) return;
      setCurrent(result.state);
      await refreshSummaries();
      if (embedderReady) {
        scheduleReindex([noteToReindexRecord(result.note)]);
      }
    },
    [session, setCurrent, refreshSummaries, scheduleReindex, embedderReady],
  );

  const handleDeleteNote = useCallback(
    async (id: string) => {
      if (!session) return;
      await deleteNote(session, id as NoteId);
      if (current?.id === id) setCurrent(null);
      await refreshSummaries();
    },
    [session, current, setCurrent, refreshSummaries],
  );

  return {
    flushPersist: autosave.flush,
    onTitleChange,
    onBodyChange,
    openNoteById: switchToNote,
    createNote: handleCreateNote,
    duplicateNote: handleDuplicateNote,
    deleteNote: handleDeleteNote,
  };
}
