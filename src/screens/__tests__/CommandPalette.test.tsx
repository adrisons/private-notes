import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommandPalette } from "../CommandPalette";
import type { NoteRecord } from "../../lib/fs/types";
import type { SearchHit } from "../../lib/search/search";

const notes: NoteRecord[] = [
  {
    id: "n1",
    title: "Cooking pasta",
    path: "notes/2026/01/n1.md",
    createdAt: "2026-05-17T12:00:00Z",
    updatedAt: "2026-05-17T12:00:00Z",
  },
  {
    id: "n2",
    title: "Rocket science",
    path: "notes/2026/01/n2.md",
    createdAt: "2026-05-16T12:00:00Z",
    updatedAt: "2026-05-16T12:00:00Z",
  },
];

function renderPalette(
  overrides: Partial<{
    searchReady: boolean;
    onSearch: (query: string) => Promise<SearchHit[]>;
    onOpenNote: (id: string) => void;
    onOpenHit: (hit: SearchHit) => void;
    onCreate: () => void;
  }> = {},
) {
  const onSearch =
    overrides.onSearch ??
    vi.fn(async (): Promise<SearchHit[]> => [
      {
        noteId: "n1",
        filePath: "notes/2026/01/n1.md",
        chunkIdx: 0,
        score: 0.91,
        snippet: "tomato sauce and pasta",
        offset: 0,
        length: 22,
      },
    ]);
  const onOpenNote = overrides.onOpenNote ?? vi.fn();
  const onOpenHit = overrides.onOpenHit ?? vi.fn();
  const onCreate = overrides.onCreate ?? vi.fn();

  render(
    <CommandPalette
      open
      onClose={vi.fn()}
      notes={notes}
      searchReady={overrides.searchReady ?? true}
      onSearch={onSearch}
      onOpenNote={onOpenNote}
      onOpenHit={onOpenHit}
      onCreate={onCreate}
    />,
  );

  return { onSearch, onOpenNote, onOpenHit, onCreate };
}

describe("CommandPalette", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows create and recent notes when the query is empty", () => {
    renderPalette();
    expect(screen.getByText("New note")).toBeInTheDocument();
    expect(screen.getByText("Cooking pasta")).toBeInTheDocument();
  });

  it("falls back to lexical title matches", async () => {
    const user = userEvent.setup();
    renderPalette({ onSearch: vi.fn(async () => []) });
    const input = screen.getByLabelText("Search notes");
    await user.type(input, "rocket");
    expect(screen.getByText("Rocket science")).toBeInTheDocument();
  });

  it("shows semantic hits after the debounced search", async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn(async () => [
      {
        noteId: "n1",
        filePath: "notes/2026/01/n1.md",
        chunkIdx: 0,
        score: 0.88,
        snippet: "tomato sauce and pasta",
        offset: 0,
        length: 22,
      },
    ]);
    renderPalette({ onSearch });
    const input = screen.getByLabelText("Search notes");
    await user.type(input, "pasta");
    await vi.advanceTimersByTimeAsync(200);
    await waitFor(() => {
      expect(onSearch).toHaveBeenCalledWith("pasta");
      expect(screen.getByText("tomato sauce and pasta")).toBeInTheDocument();
    });
  });
});
