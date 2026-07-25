import { useCallback, useRef } from "react";
import type { NoteId, SpaceId } from "../../domain";
import type { ReindexNoteInput } from "../ports/semantic-search";
import type { VaultSession } from "../vault-session";
import type { NoteListItem, OpenNoteState } from "../view-models";
import { toOpenNoteState } from "../view-models";
import { noteToReindexInput } from "../mappers/reindex";
import { useAutosave } from "./useAutosave";
import { createNote } from "../use-cases/create-note";
import { deleteNote } from "../use-cases/delete-note";
import { duplicateNote } from "../use-cases/duplicate-note";
import { openNote } from "../use-cases/open-note";
import { assignNoteSpaces } from "../use-cases/assign-note-spaces";

export interface UseCurrentNoteOptions {
  session: VaultSession | null;
  current: OpenNoteState | null;
  setCurrent: (current: OpenNoteState | null) => void;
  /** In-memory summaries, used to paint a note's header before its body loads. */
  noteItems: NoteListItem[];
  refreshSummaries: () => Promise<void>;
  scheduleReindex: (notes: ReindexNoteInput[]) => void;
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
  deleteNotes: (ids: string[]) => Promise<void>;
  onSpacesChange: (spaceIds: SpaceId[]) => Promise<void>;
}

export function useCurrentNote({
  session,
  current,
  setCurrent,
  noteItems,
  refreshSummaries,
  scheduleReindex,
  embedderReady,
  onError,
}: UseCurrentNoteOptions): UseCurrentNoteResult {
  const currentIdRef = useRef<string | null>(null);
  currentIdRef.current = current?.id ?? null;
  const currentRef = useRef<OpenNoteState | null>(current);
  currentRef.current = current;
  const noteItemsRef = useRef<NoteListItem[]>(noteItems);
  noteItemsRef.current = noteItems;
  // The note the last `switchToNote` intends to land on. Set synchronously so a
  // slow body load can tell it was superseded without waiting on a re-render.
  const openTargetRef = useRef<string | null>(null);

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
      openTargetRef.current = id;

      // Paint from the summary we already hold so the click does not wait on a
      // disk round-trip. The header shows title and spaces immediately; the
      // editor shows a loading state until the body streams in.
      const summary = noteItemsRef.current.find((n) => n.id === id);
      if (summary) {
        setCurrent({
          id: summary.id,
          title: summary.title,
          body: "",
          // Real value arrives with the body; the summary carries no createdAt.
          createdAt: summary.updatedAt,
          updatedAt: summary.updatedAt,
          savedAt: null,
          spaceIds: summary.spaceIds,
          bodyPending: true,
        });
      }

      try {
        const loaded = await openNote(session, id as NoteId);
        // The user may have switched notes while the body loaded.
        if (!loaded || openTargetRef.current !== id) return;
        const state = toOpenNoteState(loaded, loaded.updatedAt);
        // Preserve a title the user edited in the header during the load — its
        // save was deferred while the body was pending, so schedule it now.
        const shown = currentRef.current;
        const editedTitle =
          summary && shown?.id === id && shown.title !== summary.title
            ? shown.title
            : null;
        if (editedTitle !== null) {
          setCurrent({ ...state, title: editedTitle });
          autosave.schedule(id, editedTitle, state.body);
        } else {
          setCurrent(state);
        }
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
      // While the body is still loading, a save would persist the placeholder
      // body over the real note; defer it until the body has arrived.
      if (!current.bodyPending) {
        autosave.schedule(current.id, title, current.body);
      }
    },
    [current, setCurrent, autosave],
  );

  const onBodyChange = useCallback(
    (body: string) => {
      if (!current || current.bodyPending) return;
      setCurrent({ ...current, body });
      autosave.schedule(current.id, current.title, body);
    },
    [current, setCurrent, autosave],
  );

  const handleCreateNote = useCallback(async () => {
    if (!session) return;
    try {
      const note = await createNote(session);
      setCurrent(toOpenNoteState(note, note.updatedAt));
      await refreshSummaries();
    } catch (error) {
      onError(error);
    }
  }, [session, setCurrent, refreshSummaries, onError]);

  const handleDuplicateNote = useCallback(
    async (id: string) => {
      if (!session) return;
      try {
        const note = await duplicateNote(session, id as NoteId);
        if (!note) return;
        setCurrent(toOpenNoteState(note, note.updatedAt));
        await refreshSummaries();
        if (embedderReady) {
          scheduleReindex([noteToReindexInput(note)]);
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

  const handleDeleteNotes = useCallback(
    async (ids: string[]) => {
      if (!session || ids.length === 0) return;
      try {
        for (const id of ids) {
          await deleteNote(session, id as NoteId);
        }
        if (current && ids.includes(current.id)) setCurrent(null);
        await refreshSummaries();
      } catch (error) {
        onError(error);
      }
    },
    [session, current, setCurrent, refreshSummaries, onError],
  );

  const onSpacesChange = useCallback(
    async (spaceIds: SpaceId[]) => {
      if (!session || !current) return;
      try {
        const note = await assignNoteSpaces(
          session,
          current.id as NoteId,
          spaceIds,
        );
        if (note) setCurrent(toOpenNoteState(note, note.updatedAt));
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
    deleteNotes: handleDeleteNotes,
    onSpacesChange,
  };
}
