import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ComponentProps } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotesList } from "../NotesList";
import { TOUCH_ACTIONS_MEDIA } from "../../lib/touch-actions";
import type { NoteListItem } from "../../application/view-models";

const notes: NoteListItem[] = [
  {
    id: "a",
    title: "Alpha note",
    updatedAt: "2026-05-17T12:00:00Z",
  },
  {
    id: "b",
    title: "Beta note",
    updatedAt: "2026-05-16T12:00:00Z",
  },
  {
    id: "c",
    title: "Gamma note",
    updatedAt: "2026-05-15T12:00:00Z",
  },
];

function renderNotesList(
  props: Partial<ComponentProps<typeof NotesList>> = {},
) {
  const defaults = {
    notes,
    selectedId: null as string | null,
    onSelect: vi.fn(),
    onCreate: vi.fn(),
    onDelete: vi.fn(),
    onBulkDelete: vi.fn(),
    onDuplicate: vi.fn(),
  };
  return render(<NotesList {...defaults} {...props} />);
}

function mockTouchActions(enabled: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
    matches: enabled && query === TOUCH_ACTIONS_MEDIA,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

function swipeLeft(element: HTMLElement, distance = 120) {
  const start = { clientX: 220, clientY: 40 };
  const end = { clientX: 220 - distance, clientY: 40 };

  act(() => {
    fireEvent.touchStart(element, {
      touches: [start],
      changedTouches: [start],
    });
    fireEvent.touchMove(element, {
      touches: [end],
      changedTouches: [end],
    });
    fireEvent.touchEnd(element, {
      touches: [],
      changedTouches: [end],
    });
  });
}

describe("NotesList", () => {
  beforeEach(() => {
    mockTouchActions(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders notes and highlights the selected one", () => {
    renderNotesList({ selectedId: "b" });
    expect(screen.getByText("Alpha note")).toBeInTheDocument();
    expect(screen.getByText("Beta note")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /beta note/i })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByRole("button", { name: /alpha note/i })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("calls onCreate when New is clicked", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    renderNotesList({ notes: [], onCreate });
    await user.click(screen.getByRole("button", { name: /^new$/i }));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it("calls onSelect when a note is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderNotesList({ onSelect });
    await user.click(screen.getByRole("button", { name: /alpha note/i }));
    expect(onSelect).toHaveBeenCalledWith("a");
  });

  it("navigates notes with arrow keys and opens with Enter", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderNotesList({ selectedId: "a", onSelect });

    const alpha = screen.getByRole("button", { name: /alpha note/i });
    alpha.focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: /beta note/i })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith("b");
  });

  it("calls onDelete when Delete is pressed on a focused note", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    renderNotesList({ selectedId: "a", onDelete });

    screen.getByRole("button", { name: /alpha note/i }).focus();
    await user.keyboard("{Delete}");
    expect(onDelete).toHaveBeenCalledWith("a");
  });

  it("calls onDelete from the context menu", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    renderNotesList({ onDelete });
    fireEvent.contextMenu(screen.getByRole("button", { name: /beta note/i }));
    await user.click(screen.getByRole("menuitem", { name: /delete note/i }));
    expect(onDelete).toHaveBeenCalledWith("b");
  });

  it("calls onDuplicate from the context menu", async () => {
    const user = userEvent.setup();
    const onDuplicate = vi.fn();
    renderNotesList({ onDuplicate });
    fireEvent.contextMenu(screen.getByRole("button", { name: /alpha note/i }));
    await user.click(screen.getByRole("menuitem", { name: /duplicate note/i }));
    expect(onDuplicate).toHaveBeenCalledWith("a");
  });

  it("reveals duplicate and delete actions after a left swipe on touch", async () => {
    mockTouchActions(true);
    const user = userEvent.setup();
    const onDuplicate = vi.fn();
    const onDelete = vi.fn();

    renderNotesList({ onDuplicate, onDelete });

    const row = screen.getByRole("button", { name: /alpha note/i });
    swipeLeft(row);

    await user.click(screen.getByRole("button", { name: /duplicate note/i }));
    expect(onDuplicate).toHaveBeenCalledWith("a");
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("calls onDelete from the swipe action on touch", async () => {
    mockTouchActions(true);
    const user = userEvent.setup();
    const onDelete = vi.fn();

    renderNotesList({ onDelete });

    swipeLeft(screen.getByRole("button", { name: /beta note/i }));
    await user.click(screen.getByRole("button", { name: /delete note/i }));
    expect(onDelete).toHaveBeenCalledWith("b");
  });

  it("closes swipe actions instead of selecting when the row is open", async () => {
    mockTouchActions(true);
    const user = userEvent.setup();
    const onSelect = vi.fn();

    renderNotesList({ onSelect });

    const row = screen.getByRole("button", { name: /alpha note/i });
    swipeLeft(row);
    await user.click(row);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("enters selection mode and toggles notes with click", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderNotesList({ onSelect });

    await user.click(screen.getByRole("button", { name: /^select$/i }));
    expect(screen.getByText("Select notes")).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: /select alpha note/i }));
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("selects a consecutive range with Shift+click", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onBulkDelete = vi.fn();
    renderNotesList({ onBulkDelete });

    await user.click(screen.getByRole("button", { name: /^select$/i }));
    await user.click(screen.getByRole("checkbox", { name: /select alpha note/i }));

    fireEvent.click(
      screen.getByRole("checkbox", { name: /select gamma note/i }),
      { shiftKey: true },
    );
    expect(screen.getByText("3 selected")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /delete 3 selected notes/i }),
    );
    expect(onBulkDelete).toHaveBeenCalledWith(["a", "b", "c"]);
  });

  it("exits selection mode with Cancel and Escape", async () => {
    const user = userEvent.setup();
    renderNotesList();

    await user.click(screen.getByRole("button", { name: /^select$/i }));
    await user.click(screen.getByRole("checkbox", { name: /select alpha note/i }));
    expect(screen.getByText("1 selected")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(screen.getByText("Notes")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^select$/i }));
    const alpha = screen.getByRole("checkbox", { name: /select alpha note/i });
    alpha.focus();
    await act(async () => {
      fireEvent.keyDown(screen.getByRole("list", { name: /^notes$/i }), {
        key: "Escape",
      });
    });
    expect(screen.getByText("Notes")).toBeInTheDocument();
  });

  it("toggles selection with Space in selection mode", async () => {
    const user = userEvent.setup();
    renderNotesList({ selectedId: "a" });

    await user.click(screen.getByRole("button", { name: /^select$/i }));
    screen.getByRole("checkbox", { name: /select alpha note/i }).focus();
    await user.keyboard(" ");
    expect(screen.getByText("1 selected")).toBeInTheDocument();
  });
});
