import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ComponentProps } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotesList } from "../NotesList";
import { TOUCH_ACTIONS_MEDIA } from "../../lib/touch-actions";
import type { NoteListItem } from "../../application/view-models";
import { GENERAL_SPACE_ID, spaceId } from "../../domain";

const notes: NoteListItem[] = [
  {
    id: "a",
    title: "Alpha note",
    updatedAt: "2026-05-17T12:00:00Z",
    spaceIds: [],
  },
  {
    id: "b",
    title: "Beta note",
    updatedAt: "2026-05-16T12:00:00Z",
    spaceIds: [],
  },
  {
    id: "c",
    title: "Gamma note",
    updatedAt: "2026-05-15T12:00:00Z",
    spaceIds: [],
  },
];

const workId = spaceId("01WORK000000000000000000");

const spaceItems = [
  {
    id: GENERAL_SPACE_ID,
    name: "General",
    colorId: null,
    description: null,
    noteCount: 3,
  },
  {
    id: workId,
    name: "Work",
    colorId: "blue" as const,
    description: "Project notes and planning",
    noteCount: 2,
  },
];

function renderNotesList(
  props: Partial<ComponentProps<typeof NotesList>> = {},
) {
  const defaults = {
    notes,
    spaceItems,
    mode: "notes" as const,
    onToggleMode: vi.fn(),
    selectedNoteId: null as string | null,
    selectedSpaceId: null,
    onSelectNote: vi.fn(),
    onSelectSpace: vi.fn(),
    onCreateNote: vi.fn(),
    onCreateSpace: vi.fn(),
    onDeleteNote: vi.fn(),
    onBulkDeleteNotes: vi.fn(),
    onDeleteSpaces: vi.fn(),
    onDuplicateNote: vi.fn(),
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

  it("does not show the General space label on notes without custom spaces", () => {
    renderNotesList();
    expect(screen.getByText("Alpha note")).toBeInTheDocument();
    expect(screen.queryByText("General")).not.toBeInTheDocument();
  });

  it("shows custom space chips in the sidebar", () => {
    renderNotesList({
      notes: [
        {
          id: "a",
          title: "In Work",
          updatedAt: "2026-05-17T12:00:00Z",
          spaceIds: [workId],
        },
      ],
    });
    expect(screen.getByText("Work")).toBeInTheDocument();
  });

  it("renders notes and highlights the selected one", () => {
    renderNotesList({ selectedNoteId: "b" });
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

  it("calls onCreateNote when New is clicked in notes mode", async () => {
    const user = userEvent.setup();
    const onCreateNote = vi.fn();
    renderNotesList({ notes: [], onCreateNote });
    await user.click(screen.getByRole("button", { name: /^new$/i }));
    expect(onCreateNote).toHaveBeenCalledTimes(1);
  });

  it("toggles sidebar mode when the header control is clicked", async () => {
    const user = userEvent.setup();
    const onToggleMode = vi.fn();
    renderNotesList({ onToggleMode });
    await user.click(
      screen.getByRole("button", { name: /switch to spaces list/i }),
    );
    expect(onToggleMode).toHaveBeenCalledTimes(1);
  });

  it("shows spaces and calls onSelectSpace when a space is clicked", async () => {
    const user = userEvent.setup();
    const onSelectSpace = vi.fn();
    renderNotesList({ mode: "spaces", onSelectSpace });
    await user.click(screen.getByRole("button", { name: /open work/i }));
    expect(onSelectSpace).toHaveBeenCalledWith(workId);
  });

  it("calls onCreateSpace when New is clicked in spaces mode", async () => {
    const user = userEvent.setup();
    const onCreateSpace = vi.fn();
    renderNotesList({ mode: "spaces", onCreateSpace });
    await user.click(screen.getByRole("button", { name: /^new$/i }));
    expect(onCreateSpace).toHaveBeenCalledTimes(1);
  });

  it("calls onSelectNote when a note is clicked", async () => {
    const user = userEvent.setup();
    const onSelectNote = vi.fn();
    renderNotesList({ onSelectNote });
    await user.click(screen.getByRole("button", { name: /alpha note/i }));
    expect(onSelectNote).toHaveBeenCalledWith("a");
  });

  it("navigates notes with arrow keys and opens with Enter", async () => {
    const user = userEvent.setup();
    const onSelectNote = vi.fn();
    renderNotesList({ selectedNoteId: "a", onSelectNote });

    const alpha = screen.getByRole("button", { name: /alpha note/i });
    alpha.focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: /beta note/i })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onSelectNote).toHaveBeenCalledWith("b");
  });

  it("calls onDeleteNote when Delete is pressed on a focused note", async () => {
    const user = userEvent.setup();
    const onDeleteNote = vi.fn();
    renderNotesList({ selectedNoteId: "a", onDeleteNote });

    screen.getByRole("button", { name: /alpha note/i }).focus();
    await user.keyboard("{Delete}");
    expect(onDeleteNote).toHaveBeenCalledWith("a");
  });

  it("calls onDeleteNote from the context menu", async () => {
    const user = userEvent.setup();
    const onDeleteNote = vi.fn();
    renderNotesList({ onDeleteNote });
    fireEvent.contextMenu(screen.getByRole("button", { name: /beta note/i }));
    await user.click(screen.getByRole("menuitem", { name: /delete note/i }));
    expect(onDeleteNote).toHaveBeenCalledWith("b");
  });

  it("calls onDuplicateNote from the context menu", async () => {
    const user = userEvent.setup();
    const onDuplicateNote = vi.fn();
    renderNotesList({ onDuplicateNote });
    fireEvent.contextMenu(screen.getByRole("button", { name: /alpha note/i }));
    await user.click(screen.getByRole("menuitem", { name: /duplicate note/i }));
    expect(onDuplicateNote).toHaveBeenCalledWith("a");
  });

  it("reveals duplicate and delete actions after a left swipe on touch", async () => {
    mockTouchActions(true);
    const user = userEvent.setup();
    const onDuplicateNote = vi.fn();
    const onDeleteNote = vi.fn();

    renderNotesList({ onDuplicateNote, onDeleteNote });

    const row = screen.getByRole("button", { name: /alpha note/i });
    swipeLeft(row);

    await user.click(screen.getByRole("button", { name: /duplicate note/i }));
    expect(onDuplicateNote).toHaveBeenCalledWith("a");
    expect(onDeleteNote).not.toHaveBeenCalled();
  });

  it("calls onDeleteNote from the swipe action on touch", async () => {
    mockTouchActions(true);
    const user = userEvent.setup();
    const onDeleteNote = vi.fn();

    renderNotesList({ onDeleteNote });

    swipeLeft(screen.getByRole("button", { name: /beta note/i }));
    await user.click(screen.getByRole("button", { name: /delete note/i }));
    expect(onDeleteNote).toHaveBeenCalledWith("b");
  });

  it("closes swipe actions instead of selecting when the row is open", async () => {
    mockTouchActions(true);
    const user = userEvent.setup();
    const onSelectNote = vi.fn();

    renderNotesList({ onSelectNote });

    const row = screen.getByRole("button", { name: /alpha note/i });
    swipeLeft(row);
    await user.click(row);
    expect(onSelectNote).not.toHaveBeenCalled();
  });

  it("enters selection mode and toggles notes with click", async () => {
    const user = userEvent.setup();
    const onSelectNote = vi.fn();
    renderNotesList({ onSelectNote });

    await user.click(screen.getByRole("button", { name: /^select$/i }));
    expect(screen.getByText("Select notes")).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: /select alpha note/i }));
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(onSelectNote).not.toHaveBeenCalled();
  });

  it("selects a consecutive range with Shift+click", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onBulkDeleteNotes = vi.fn();
    renderNotesList({ onBulkDeleteNotes });

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
    expect(onBulkDeleteNotes).toHaveBeenCalledWith(["a", "b", "c"]);
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
    renderNotesList({ selectedNoteId: "a" });

    await user.click(screen.getByRole("button", { name: /^select$/i }));
    screen.getByRole("checkbox", { name: /select alpha note/i }).focus();
    await user.keyboard(" ");
    expect(screen.getByText("1 selected")).toBeInTheDocument();
  });
});
