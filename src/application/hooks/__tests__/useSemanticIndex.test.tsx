import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { noteId } from "../../../domain";
import type { VaultSession } from "../../vault-session";
import { useSemanticIndex } from "../useSemanticIndex";

const mockSearch = vi.hoisted(() => ({
  searchSemantic: vi.fn(),
  reindex: vi.fn().mockResolvedValue(undefined),
  pruneOrphans: vi.fn().mockResolvedValue(undefined),
}));

const fakeEmbedder = vi.hoisted(() => ({
  id: "fake",
  dimensions: 32,
  embed: vi.fn(),
}));

vi.mock("../../composition", () => ({
  loadDefaultEmbedder: vi.fn(async () => fakeEmbedder),
}));

describe("useSemanticIndex", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearch.searchSemantic.mockResolvedValue([
      {
        noteId: "n1",
        score: 0.9,
        matchKind: "semantic",
      },
    ]);
    mockSearch.reindex.mockResolvedValue(undefined);
  });

  function sessionStub(): VaultSession {
    return {
      vaultName: "Notes",
      createSemanticSearch: vi.fn(() => mockSearch),
      listForReindex: vi.fn().mockResolvedValue([
        {
          id: "n1",
          title: "Note",
          body: "hello",
        },
      ]),
      sweepOrphanAttachments: vi.fn().mockResolvedValue([]),
    } as unknown as VaultSession;
  }

  it("reports embedderReady once a session is active", async () => {
    const onError = vi.fn();
    const { result, rerender } = renderHook(
      (props: { session: VaultSession | null }) =>
        useSemanticIndex({ session: props.session, onError }),
      { initialProps: { session: null as VaultSession | null } },
    );

    expect(result.current.embedderReady).toBe(false);

    rerender({ session: sessionStub() });

    await waitFor(() => {
      expect(result.current.embedderReady).toBe(true);
    });
    expect(onError).not.toHaveBeenCalled();
  });

  it("maps semantic hits to SearchResultItem", async () => {
    const { result } = renderHook(() =>
      useSemanticIndex({ session: sessionStub(), onError: vi.fn() }),
    );

    await waitFor(() => expect(result.current.embedderReady).toBe(true));

    let hits: Awaited<ReturnType<typeof result.current.onSearch>> = [];
    await act(async () => {
      hits = await result.current.onSearch("hello");
    });

    expect(mockSearch.searchSemantic).toHaveBeenCalledWith(
      "hello",
      fakeEmbedder,
      // No `minScore`: the floor belongs to the model, not to this call site.
      { topK: 8, minScore: undefined, relativeCutoff: 0.6 },
    );
    expect(hits).toEqual([
      { noteId: "n1", score: 0.9, matchKind: "semantic" },
    ]);
  });

  it("scheduleReindex forwards note records when the embedder is ready", async () => {
    const { result } = renderHook(() =>
      useSemanticIndex({ session: sessionStub(), onError: vi.fn() }),
    );

    await waitFor(() => expect(result.current.embedderReady).toBe(true));

    const note = {
      id: noteId("n1"),
      title: "Note",
      body: "hello",
    };

    act(() => {
      result.current.scheduleReindex([note]);
    });

    await waitFor(() => {
      expect(mockSearch.reindex).toHaveBeenCalledWith(
        [note],
        fakeEmbedder,
      );
    });
  });
});
