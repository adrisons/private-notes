import { useCallback, useEffect, useRef, useState } from "react";
import type { NoteRecord } from "../ports/note-record";
import type { Embedder } from "../ports/embedder";
import { createSemanticSearch, loadDefaultEmbedder } from "../composition";
import type { SemanticSearch } from "../ports/semantic-search";
import type { VaultSession } from "../vault-session";
import type { ReindexProgress, SearchResultItem } from "../view-models";
import {
  setBackgroundErrorListener,
  type BackgroundTaskError,
} from "../errors";
import {
  runFullReindex,
  scheduleReindex as scheduleReindexUseCase,
} from "../use-cases/run-full-reindex";
import { searchNotes } from "../use-cases/search-notes";

export interface UseSemanticIndexOptions {
  session: VaultSession | null;
  onError: (error: unknown) => void;
}

export interface UseSemanticIndexResult {
  embedderReady: boolean;
  reindexing: boolean;
  reindexProgress: ReindexProgress | null;
  indexError: boolean;
  runReindex: () => Promise<void>;
  onSearch: (query: string) => Promise<SearchResultItem[]>;
  scheduleReindex: (records: NoteRecord[]) => void;
  pruneOrphans: () => Promise<void>;
}

export function useSemanticIndex({
  session,
  onError,
}: UseSemanticIndexOptions): UseSemanticIndexResult {
  const embedderRef = useRef<Embedder | null>(null);
  const searchRef = useRef<SemanticSearch | null>(null);
  const [embedderReady, setEmbedderReady] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [reindexProgress, setReindexProgress] = useState<ReindexProgress | null>(
    null,
  );
  const [indexError, setIndexError] = useState(false);

  const handleBackgroundError = useCallback((error: BackgroundTaskError) => {
    if (error.task === "reindex") {
      setIndexError(true);
    }
  }, []);

  useEffect(() => {
    setBackgroundErrorListener(handleBackgroundError);
    return () => setBackgroundErrorListener(null);
  }, [handleBackgroundError]);

  useEffect(() => {
    if (!session) {
      setEmbedderReady(false);
      setIndexError(false);
      searchRef.current = null;
      return;
    }
    searchRef.current = createSemanticSearch(session.root);
    let cancelled = false;
    void (async () => {
      try {
        if (!embedderRef.current) {
          embedderRef.current = await loadDefaultEmbedder();
        }
        if (!cancelled) setEmbedderReady(true);
      } catch (err) {
        if (!cancelled) onError(err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, onError]);

  const scheduleReindex = useCallback(
    (records: NoteRecord[]) => {
      if (
        !session ||
        !embedderRef.current ||
        !searchRef.current ||
        !embedderReady
      ) {
        return;
      }
      scheduleReindexUseCase(
        session,
        searchRef.current,
        embedderRef.current,
        records,
        handleBackgroundError,
      );
    },
    [session, embedderReady, handleBackgroundError],
  );

  const runReindex = useCallback(async () => {
    if (!session || !embedderRef.current || !searchRef.current || reindexing) {
      return;
    }
    setReindexing(true);
    setReindexProgress({ done: 0, total: 0 });
    setIndexError(false);
    try {
      const error = await runFullReindex(
        session,
        searchRef.current,
        embedderRef.current,
        {
          onProgress: setReindexProgress,
          onBackgroundError: handleBackgroundError,
        },
      );
      if (error) setIndexError(true);
    } finally {
      setReindexing(false);
      setReindexProgress(null);
    }
  }, [session, reindexing, handleBackgroundError]);

  useEffect(() => {
    if (embedderReady && session) void runReindex();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedderReady, session]);

  const onSearch = useCallback(
    async (query: string): Promise<SearchResultItem[]> => {
      if (!session || !embedderRef.current || !searchRef.current) return [];
      return searchNotes(searchRef.current, embedderRef.current, query);
    },
    [session],
  );

  const pruneOrphans = useCallback(async () => {
    if (!session || !embedderRef.current || !searchRef.current) return;
    const live = await session.listNoteRecords();
    await searchRef.current.pruneOrphans(live.map((n) => n.id));
  }, [session]);

  return {
    embedderReady,
    reindexing,
    reindexProgress,
    indexError,
    runReindex,
    onSearch,
    scheduleReindex,
    pruneOrphans,
  };
}
