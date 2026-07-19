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
  onError: (error: unknown) => void;
}

export interface UseCurrentNoteResult {
  flushPersist: () => void;
  isSaving: boolean;
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
  onError,
}: UseCurrentNoteOptions): UseCurrentNoteResult {
  const currentIdRef = useRef<string | null>(null);
  currentIdRef.current = current?.id ?? null;

  const autosave = useAutosave({
    session,
    setCurrent,
    refreshSummaries,
    scheduleReindex,
    embedderReady,
    onError,
  });

  const switchToNote = useCallback(
    async (id: string) => {
      if (!session) return;
      if (currentIdRef.current === id) return;
      autosave.flush();
      try {
        const state = await openNote(session, id as NoteId);
        if (state) setCurrent(state);
      } catch (error) {
        onError(error);
      }
    },
    [session, setCurrent, autosave, onError],
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
    try {
      const state = await createNote(session);
      setCurrent(state);
      await refreshSummaries();
    } catch (error) {
      onError(error);
    }
  }, [session, setCurrent, refreshSummaries, onError]);

  const handleDuplicateNote = useCallback(
    async (id: string) => {
      if (!session) return;
      try {
        const result = await duplicateNote(session, id as NoteId);
        if (!result) return;
        setCurrent(result.state);
        await refreshSummaries();
        if (embedderReady) {
          scheduleReindex([noteToReindexRecord(result.note)]);
        }
      } catch (error) {
        onError(error);
      }
    },
    [session, setCurrent, refreshSummaries, scheduleReindex, embedderReady, onError],
  );

  const handleDeleteNote = useCallback(
    async (id: string) => {
      if (!session) return;
      try {
        await deleteNote(session, id as NoteId);
        if (current?.id === id) setCurrent(null);
        await refreshSummaries();
      } catch (error) {
        onError(error);
      }
    },
    [session, current, setCurrent, refreshSummaries, onError],
  );

  return {
    flushPersist: autosave.flush,
    isSaving: autosave.isSaving,
    onTitleChange,
    onBodyChange,
    openNoteById: switchToNote,
    createNote: handleCreateNote,
    duplicateNote: handleDuplicateNote,
    deleteNote: handleDeleteNote,
  };
}
