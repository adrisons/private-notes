import { useCallback, useEffect, useRef, useState } from "react";
import { useDebouncedCallback } from "../../lib/useDebouncedCallback";
import type { NoteId } from "../../domain";
import type { NoteRecord } from "../ports/note-record";
import type { VaultSession } from "../vault-session";
import type { OpenNoteState } from "../view-models";
import { autosaveNote } from "../use-cases/autosave-note";

const AUTOSAVE_MS = 500;

export interface UseAutosaveOptions {
  session: VaultSession | null;
  setCurrent: (current: OpenNoteState | null) => void;
  refreshSummaries: () => Promise<void>;
  scheduleReindex: (records: NoteRecord[]) => void;
  embedderReady: boolean;
  onError: (error: unknown) => void;
}

export interface UseAutosaveResult {
  flush: () => void;
  schedule: (id: string, title: string, body: string) => void;
  isSaving: boolean;
}

export function useAutosave({
  session,
  setCurrent,
  refreshSummaries,
  scheduleReindex,
  embedderReady,
  onError,
}: UseAutosaveOptions): UseAutosaveResult {
  const [isSaving, setIsSaving] = useState(false);
  const inFlightRef = useRef(0);

  const debouncedPersist = useDebouncedCallback(
    async (id: string, title: string, body: string) => {
      if (!session) return;
      inFlightRef.current += 1;
      setIsSaving(true);
      try {
        await autosaveNote(
          session,
          { id: id as NoteId, title, body },
          {
            onSaved: async (result) => {
              setCurrent(result.state);
              await refreshSummaries();
            },
            onError,
            scheduleReindex,
            embedderReady,
          },
        );
      } finally {
        inFlightRef.current -= 1;
        setIsSaving(
          inFlightRef.current > 0 || debouncedPersistRef.current.hasPending(),
        );
      }
    },
    AUTOSAVE_MS,
  );

  const debouncedPersistRef = useRef(debouncedPersist);
  debouncedPersistRef.current = debouncedPersist;

  const flush = useCallback(() => {
    debouncedPersistRef.current.flush();
  }, []);

  useEffect(() => {
    const flushNow = () => debouncedPersistRef.current.flush();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushNow();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flushNow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flushNow);
    };
  }, []);

  const schedule = useCallback(
    (id: string, title: string, body: string) => {
      setIsSaving(true);
      debouncedPersist(id, title, body);
    },
    [debouncedPersist],
  );

  return { flush, schedule, isSaving };
}
