import { useCallback, useEffect, useRef } from "react";
import { useDebouncedCallback } from "../../lib/useDebouncedCallback";
import { noteToRecord, type NoteId } from "../../domain";
import type { NoteRecord } from "../../lib/fs/types";
import type { VaultSession } from "../vault-session";
import type { OpenNoteState } from "../view-models";

const AUTOSAVE_MS = 500;

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

  const persist = useCallback(
    async (id: string, title: string, body: string) => {
      if (!session) return;
      const { state, note } = await session.saveNote(
        id as NoteId,
        title,
        body,
      );
      setCurrent(state);
      await refreshSummaries();
      if (embedderReady) {
        scheduleReindex([noteToRecord(note)]);
      }
    },
    [session, setCurrent, refreshSummaries, scheduleReindex, embedderReady],
  );

  const debouncedPersist = useDebouncedCallback(persist, AUTOSAVE_MS);
  const debouncedPersistRef = useRef(debouncedPersist);
  debouncedPersistRef.current = debouncedPersist;

  const flushPersist = useCallback(() => {
    debouncedPersistRef.current.flush();
  }, []);

  useEffect(() => {
    const flush = () => debouncedPersistRef.current.flush();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
    };
  }, []);

  const switchToNote = useCallback(
    async (id: string) => {
      if (!session) return;
      if (currentIdRef.current === id) return;
      debouncedPersistRef.current.flush();
      const state = await session.openNote(id as NoteId);
      if (state) setCurrent(state);
    },
    [session, setCurrent],
  );

  const onTitleChange = useCallback(
    (title: string) => {
      if (!current) return;
      setCurrent({ ...current, title });
      debouncedPersist(current.id, title, current.body);
    },
    [current, setCurrent, debouncedPersist],
  );

  const onBodyChange = useCallback(
    (body: string) => {
      if (!current) return;
      setCurrent({ ...current, body });
      debouncedPersist(current.id, current.title, body);
    },
    [current, setCurrent, debouncedPersist],
  );

  const createNote = useCallback(async () => {
    if (!session) return;
    const state = await session.createNote({ title: "Untitled", body: "" });
    setCurrent(state);
    await refreshSummaries();
  }, [session, setCurrent, refreshSummaries]);

  const duplicateNote = useCallback(
    async (id: string) => {
      if (!session) return;
      const result = await session.duplicateNote(id as NoteId);
      if (!result) return;
      setCurrent(result.state);
      await refreshSummaries();
      if (embedderReady) {
        scheduleReindex([noteToRecord(result.note)]);
      }
    },
    [session, setCurrent, refreshSummaries, scheduleReindex, embedderReady],
  );

  const deleteNote = useCallback(
    async (id: string) => {
      if (!session) return;
      await session.deleteNote(id as NoteId);
      if (current?.id === id) setCurrent(null);
      await refreshSummaries();
    },
    [session, current, setCurrent, refreshSummaries],
  );

  return {
    flushPersist,
    onTitleChange,
    onBodyChange,
    openNoteById: switchToNote,
    createNote,
    duplicateNote,
    deleteNote,
  };
}
