import { useCallback, useEffect, useRef, useState } from "react";
import type { Embedder } from "../../lib/search/embedder";
import type { NoteRecord } from "../../lib/fs/types";
import { createSemanticSearch } from "../composition";
import type { SemanticSearch } from "../ports/semantic-search";
import type { VaultSession } from "../vault-session";
import type { ReindexProgress, SearchResultItem } from "../view-models";
import { toSearchResultItems } from "../view-models";

export interface UseSemanticIndexOptions {
  session: VaultSession | null;
  onError: (message: string) => void;
}

export interface UseSemanticIndexResult {
  embedderReady: boolean;
  reindexing: boolean;
  reindexProgress: ReindexProgress | null;
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

  useEffect(() => {
    if (!session) {
      setEmbedderReady(false);
      searchRef.current = null;
      return;
    }
    searchRef.current = createSemanticSearch(session.root);
    let cancelled = false;
    void (async () => {
      try {
        if (!embedderRef.current) {
          const { TransformersEmbedder, DEFAULT_MODEL_ID } = await import(
            "../../lib/search/transformers-embedder"
          );
          const emb = new TransformersEmbedder(DEFAULT_MODEL_ID);
          embedderRef.current = emb;
          await emb.ready();
        }
        if (!cancelled) setEmbedderReady(true);
      } catch (err) {
        if (!cancelled) onError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, onError]);

  const scheduleReindex = useCallback(
    (records: NoteRecord[]) => {
      if (!session || !embedderRef.current || !searchRef.current || !embedderReady) {
        return;
      }
      void searchRef.current
        .reindex(records, embedderRef.current)
        .catch(() => {});
    },
    [session, embedderReady],
  );

  const runReindex = useCallback(async () => {
    if (!session || !embedderRef.current || !searchRef.current || reindexing) {
      return;
    }
    setReindexing(true);
    setReindexProgress({ done: 0, total: 0 });
    try {
      const live = await session.listNoteRecords();
      await searchRef.current.pruneOrphans(live.map((n) => n.id));
      await searchRef.current.reindex(live, embedderRef.current, {
        onProgress: setReindexProgress,
      });
    } catch {
      // Non-fatal — the next vault open will retry.
    } finally {
      setReindexing(false);
      setReindexProgress(null);
    }
  }, [session, reindexing]);

  useEffect(() => {
    if (embedderReady && session) void runReindex();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedderReady, session]);

  const onSearch = useCallback(
    async (query: string): Promise<SearchResultItem[]> => {
      if (!session || !embedderRef.current || !searchRef.current) return [];
      const hits = await searchRef.current.searchSemantic(
        query,
        embedderRef.current,
        { topK: 8, minScore: 0.15 },
      );
      return toSearchResultItems(hits);
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
    runReindex,
    onSearch,
    scheduleReindex,
    pruneOrphans,
  };
}
