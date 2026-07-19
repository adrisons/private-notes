import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
];

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
    render(
      <NotesList
        notes={notes}
        selectedId="b"
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
      />,
    );
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
    render(
      <NotesList
        notes={[]}
        selectedId={null}
        onSelect={vi.fn()}
        onCreate={onCreate}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: /^new$/i }));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it("calls onSelect when a note is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <NotesList
        notes={notes}
        selectedId={null}
        onSelect={onSelect}
        onCreate={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: /alpha note/i }));
    expect(onSelect).toHaveBeenCalledWith("a");
  });

  it("navigates notes with arrow keys and opens with Enter", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <NotesList
        notes={notes}
        selectedId="a"
        onSelect={onSelect}
        onCreate={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
      />,
    );

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
    render(
      <NotesList
        notes={notes}
        selectedId="a"
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onDelete={onDelete}
        onDuplicate={vi.fn()}
      />,
    );

    screen.getByRole("button", { name: /alpha note/i }).focus();
    await user.keyboard("{Delete}");
    expect(onDelete).toHaveBeenCalledWith("a");
  });

  it("calls onDelete from the context menu", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(
      <NotesList
        notes={notes}
        selectedId={null}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onDelete={onDelete}
        onDuplicate={vi.fn()}
      />,
    );
    fireEvent.contextMenu(screen.getByRole("button", { name: /beta note/i }));
    await user.click(screen.getByRole("menuitem", { name: /delete note/i }));
    expect(onDelete).toHaveBeenCalledWith("b");
  });

  it("calls onDuplicate from the context menu", async () => {
    const user = userEvent.setup();
    const onDuplicate = vi.fn();
    render(
      <NotesList
        notes={notes}
        selectedId={null}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={onDuplicate}
      />,
    );
    fireEvent.contextMenu(screen.getByRole("button", { name: /alpha note/i }));
    await user.click(screen.getByRole("menuitem", { name: /duplicate note/i }));
    expect(onDuplicate).toHaveBeenCalledWith("a");
  });

  it("reveals duplicate and delete actions after a left swipe on touch", async () => {
    mockTouchActions(true);
    const user = userEvent.setup();
    const onDuplicate = vi.fn();
    const onDelete = vi.fn();

    render(
      <NotesList
        notes={notes}
        selectedId={null}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
      />,
    );

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

    render(
      <NotesList
        notes={notes}
        selectedId={null}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onDelete={onDelete}
        onDuplicate={vi.fn()}
      />,
    );

    swipeLeft(screen.getByRole("button", { name: /beta note/i }));
    await user.click(screen.getByRole("button", { name: /delete note/i }));
    expect(onDelete).toHaveBeenCalledWith("b");
  });

  it("closes swipe actions instead of selecting when the row is open", async () => {
    mockTouchActions(true);
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <NotesList
        notes={notes}
        selectedId={null}
        onSelect={onSelect}
        onCreate={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
      />,
    );

    const row = screen.getByRole("button", { name: /alpha note/i });
    swipeLeft(row);
    await user.click(row);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
