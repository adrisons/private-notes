import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type CustomSpace,
  type SpaceColorId,
  type SpaceId,
  type NoteId,
} from "../../domain";
import type { VaultSession } from "../vault-session";
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
  createSpace: (input: {
    name: string;
    colorId: SpaceColorId;
    description?: string;
  }) => Promise<SpaceId | null>;
  updateSpace: (
    id: SpaceId,
    patch: { name?: string; colorId?: SpaceColorId; description?: string },
  ) => Promise<void>;
  deleteSpace: (id: SpaceId) => Promise<void>;
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
    async (input: {
      name: string;
      colorId: SpaceColorId;
      description?: string;
    }) => {
      if (!session) return null;
      try {
        const created = await session.createSpace(input);
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
    async (
      id: SpaceId,
      patch: { name?: string; colorId?: SpaceColorId; description?: string },
    ) => {
      if (!session) return;
      try {
        await session.updateSpace(id, patch);
        await refreshSpaces();
      } catch (error) {
        onError(error);
      }
    },
    [session, refreshSpaces, onError],
  );

  const deleteSpace = useCallback(
    async (id: SpaceId) => {
      if (!session) return;
      try {
        await session.deleteSpace(id);
        await refreshSpaces();
        await refreshSummaries();
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
        await session.assignNoteSpaces(noteId as NoteId, spaceIds);
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
    deleteSpace,
    setNoteSpaces,
  };
}
