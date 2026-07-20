import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommandPalette } from "../CommandPalette";
import type { NoteListItem, SearchResultItem } from "../../application/view-models";
import { GENERAL_SPACE_ID } from "../../domain";

const notes: NoteListItem[] = [
  {
    id: "n1",
    title: "Cooking pasta",
    updatedAt: "2026-05-17T12:00:00Z",
    spaceIds: [],
  },
  {
    id: "n2",
    title: "Rocket science",
    updatedAt: "2026-05-16T12:00:00Z",
    spaceIds: [],
  },
];

const spaceItems = [
  {
    id: GENERAL_SPACE_ID,
    name: "General",
    colorId: null,
    description: null,
    noteCount: 2,
  },
];

function renderPalette(
  overrides: Partial<{
    searchReady: boolean;
    onSearch: (query: string) => Promise<SearchResultItem[]>;
    onOpenNote: (id: string) => void;
    onCreate: () => void;
  }> = {},
) {
  const onSearch =
    overrides.onSearch ??
    vi.fn(async (): Promise<SearchResultItem[]> => [
      { noteId: "n1", score: 0.91 },
    ]);
  const onOpenNote = overrides.onOpenNote ?? vi.fn();
  const onCreate = overrides.onCreate ?? vi.fn();

  render(
    <CommandPalette
      open
      onClose={vi.fn()}
      notes={notes}
      spaceItems={spaceItems}
      searchReady={overrides.searchReady ?? true}
      onSearch={onSearch}
      onOpenNote={onOpenNote}
      onCreate={onCreate}
    />,
  );

  return { onSearch, onOpenNote, onCreate };
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
    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTimeAsync,
    });
    const onSearch = vi.fn(async () => [{ noteId: "n1", score: 0.88 }]);
    renderPalette({ onSearch });
    const input = screen.getByLabelText("Search notes");
    await act(async () => {
      await user.type(input, "welcome");
      await vi.advanceTimersByTimeAsync(200);
    });
    await waitFor(() => {
      expect(onSearch).toHaveBeenCalledWith("welcome");
      expect(screen.getByText("Cooking pasta")).toBeInTheDocument();
    });
  });

  it("dedupes multiple semantic hits from the same note", async () => {
    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTimeAsync,
    });
    const onSearch = vi.fn(async () => [
      { noteId: "n1", score: 0.91 },
      { noteId: "n1", score: 0.82 },
    ]);
    renderPalette({ onSearch });
    const input = screen.getByLabelText("Search notes");
    await act(async () => {
      await user.type(input, "pasta");
      await vi.advanceTimersByTimeAsync(200);
    });
    await waitFor(() => {
      expect(screen.getAllByText("Cooking pasta")).toHaveLength(1);
    });
  });
});
