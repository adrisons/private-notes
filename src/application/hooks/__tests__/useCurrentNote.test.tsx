import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { noteId } from "../../../domain";
import type { VaultSession } from "../../vault-session";
import type { OpenNoteState } from "../../view-models";
import { useCurrentNote } from "../useCurrentNote";

const NOTE = {
  id: noteId("n1"),
  title: "Draft",
  body: "Hello",
  path: "notes/2026/05/n1.md",
  createdAt: "2026-05-17T10:00:00.000Z",
  updatedAt: "2026-05-17T10:00:00.000Z",
  spaceIds: [],
};

const NOTE_TIMESTAMPS = {
  createdAt: "2026-05-17T10:00:00.000Z",
  updatedAt: "2026-05-17T10:00:00.000Z",
};

function buildSession(overrides: Partial<VaultSession> = {}): VaultSession {
  return {
    saveNote: vi.fn().mockResolvedValue({
      state: {
        id: "n1",
        title: "Draft",
        body: "Hello",
        ...NOTE_TIMESTAMPS,
        savedAt: "2026-05-17T10:00:00.000Z",
        spaceIds: [],
      },
      note: NOTE,
      gcAttachments: [],
    }),
    openNote: vi.fn().mockResolvedValue({
      id: "n2",
      title: "Other",
      body: "Other body",
      ...NOTE_TIMESTAMPS,
      savedAt: null,
      spaceIds: [],
    }),
    createNote: vi.fn(),
    duplicateNote: vi.fn(),
    deleteNote: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as VaultSession;
}

describe("useCurrentNote", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function renderCurrentNote(
    session: VaultSession | null,
    current: OpenNoteState | null,
    extras: Partial<Parameters<typeof useCurrentNote>[0]> = {},
  ) {
    const setCurrent = vi.fn();
    const refreshSummaries = vi.fn().mockResolvedValue(undefined);
    const scheduleReindex = vi.fn();

    const hook = renderHook(
      (props: Parameters<typeof useCurrentNote>[0]) => useCurrentNote(props),
      {
        initialProps: {
          session,
          current,
          setCurrent,
          refreshSummaries,
          scheduleReindex,
          embedderReady: false,
          onError: vi.fn(),
          ...extras,
        },
      },
    );

    return { ...hook, setCurrent, refreshSummaries, scheduleReindex };
  }

  it("debounces disk persist after a title edit", async () => {
    const session = buildSession();
    const current: OpenNoteState = {
      id: "n1",
      title: "Draft",
      body: "Hello",
      ...NOTE_TIMESTAMPS,
      savedAt: null,
      spaceIds: [],
    };
    const { result } = renderCurrentNote(session, current);

    act(() => {
      result.current.onTitleChange("Renamed");
    });

    expect(session.saveNote).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(session.saveNote).toHaveBeenCalledWith("n1", "Renamed", "Hello");
  });

  it("flushPersist saves immediately without waiting for the debounce", async () => {
    const session = buildSession();
    const current: OpenNoteState = {
      id: "n1",
      title: "Draft",
      body: "Hello",
      ...NOTE_TIMESTAMPS,
      savedAt: null,
      spaceIds: [],
    };
    const { result } = renderCurrentNote(session, current);

    await act(async () => {
      result.current.onBodyChange("Updated");
      result.current.flushPersist();
      await Promise.resolve();
    });

    expect(session.saveNote).toHaveBeenCalledWith("n1", "Draft", "Updated");
  });

  it("flushes pending edits before opening another note", async () => {
    const session = buildSession();
    const current: OpenNoteState = {
      id: "n1",
      title: "Draft",
      body: "Hello",
      ...NOTE_TIMESTAMPS,
      savedAt: null,
      spaceIds: [],
    };
    const { result, setCurrent } = renderCurrentNote(session, current);

    act(() => {
      result.current.onBodyChange("Pending");
    });

    await act(async () => {
      await result.current.openNoteById("n2");
    });

    expect(session.saveNote).toHaveBeenCalledWith("n1", "Draft", "Pending");
    expect(session.openNote).toHaveBeenCalledWith("n2");
    expect(setCurrent).toHaveBeenCalledWith({
      id: "n2",
      title: "Other",
      body: "Other body",
      ...NOTE_TIMESTAMPS,
      savedAt: null,
      spaceIds: [],
    });
  });

  it("schedules reindex after a successful save when the embedder is ready", async () => {
    const session = buildSession();
    const current: OpenNoteState = {
      id: "n1",
      title: "Draft",
      body: "Hello",
      ...NOTE_TIMESTAMPS,
      savedAt: null,
      spaceIds: [],
    };
    const { result, scheduleReindex } = renderCurrentNote(session, current, {
      embedderReady: true,
    });

    act(() => {
      result.current.onTitleChange("Saved");
      result.current.flushPersist();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(scheduleReindex).toHaveBeenCalledWith([
      expect.objectContaining({ id: "n1", title: "Draft" }),
    ]);
  });

  it("clears the open note when the active note is deleted", async () => {
    const session = buildSession();
    const current: OpenNoteState = {
      id: "n1",
      title: "Draft",
      body: "Hello",
      ...NOTE_TIMESTAMPS,
      savedAt: null,
      spaceIds: [],
    };
    const { result, setCurrent, refreshSummaries } = renderCurrentNote(
      session,
      current,
    );

    await act(async () => {
      await result.current.deleteNote("n1");
    });

    expect(session.deleteNote).toHaveBeenCalledWith("n1");
    expect(setCurrent).toHaveBeenCalledWith(null);
    expect(refreshSummaries).toHaveBeenCalled();
  });
});
