import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotesList } from "../NotesList";
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

describe("NotesList", () => {
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
    // Selection is exposed semantically; the styling hangs off aria-current.
    expect(screen.getByRole("button", { name: /beta note/i })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByRole("button", { name: /alpha note/i })).toHaveAttribute(
      "aria-current",
      "false",
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
});
