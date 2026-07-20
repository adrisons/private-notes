import { useCallback, useEffect, useMemo, useState } from "react";
import {
  noteId as toNoteId,
  type CustomSpace,
  type SpaceDraft,
  type SpaceId,
  type SpacePatch,
} from "../../domain";
import type { VaultSession } from "../vault-session";
import { createSpace as createSpaceUseCase } from "../use-cases/create-space";
import { updateSpace as updateSpaceUseCase } from "../use-cases/update-space";
import { deleteSpaces as deleteSpacesUseCase } from "../use-cases/delete-space";
import { assignNoteSpaces } from "../use-cases/assign-note-spaces";
import {
  buildSpaceListItems,
  type NoteListItem,
  type SpaceListItem,
} from "../view-models";

export interface UseSpacesOptions {
  session: VaultSession | null;
  noteItems: NoteListItem[];
  refreshSummaries: () => Promise<void>;
  onError: (error: unknown) => void;
}

export interface UseSpacesResult {
  spaceItems: SpaceListItem[];
  createSpace: (input: SpaceDraft) => Promise<SpaceId | null>;
  updateSpace: (id: SpaceId, patch: SpacePatch) => Promise<void>;
  /** Deletes one or many in a single pass — one refresh, not one per space. */
  deleteSpaces: (ids: readonly SpaceId[]) => Promise<void>;
  setNoteSpaces: (noteId: string, spaceIds: SpaceId[]) => Promise<void>;
}

export function useSpaces({
  session,
  noteItems,
  refreshSummaries,
  onError,
}: UseSpacesOptions): UseSpacesResult {
  const [customSpaces, setCustomSpaces] = useState<CustomSpace[]>([]);

  const refreshSpaces = useCallback(async () => {
    if (!session) {
      setCustomSpaces([]);
      return;
    }
    try {
      setCustomSpaces(await session.listSpaces());
    } catch (error) {
      onError(error);
    }
  }, [session, onError]);

  useEffect(() => {
    void refreshSpaces();
  }, [refreshSpaces]);

  const spaceItems = useMemo(
    () => buildSpaceListItems(customSpaces, noteItems),
    [customSpaces, noteItems],
  );

  const createSpace = useCallback(
    async (input: SpaceDraft) => {
      if (!session) return null;
      try {
        const created = await createSpaceUseCase(session, input);
        await refreshSpaces();
        return created.id;
      } catch (error) {
        onError(error);
        return null;
      }
    },
    [session, refreshSpaces, onError],
  );

  const updateSpace = useCallback(
    async (id: SpaceId, patch: SpacePatch) => {
      if (!session) return;
      try {
        await updateSpaceUseCase(session, id, patch);
        await refreshSpaces();
      } catch (error) {
        onError(error);
      }
    },
    [session, refreshSpaces, onError],
  );

  const deleteSpaces = useCallback(
    async (ids: readonly SpaceId[]) => {
      if (!session) return;
      try {
        const { deleted, notesChanged } = await deleteSpacesUseCase(
          session,
          ids,
        );
        if (deleted.length === 0 && !notesChanged) return;
        await refreshSpaces();
        if (notesChanged) await refreshSummaries();
      } catch (error) {
        onError(error);
      }
    },
    [session, refreshSpaces, refreshSummaries, onError],
  );

  const setNoteSpaces = useCallback(
    async (noteId: string, spaceIds: SpaceId[]) => {
      if (!session) return;
      try {
        await assignNoteSpaces(session, toNoteId(noteId), spaceIds);
        await refreshSummaries();
      } catch (error) {
        onError(error);
      }
    },
    [session, refreshSummaries, onError],
  );

  return {
    spaceItems,
    createSpace,
    updateSpace,
    deleteSpaces,
    setNoteSpaces,
  };
}
