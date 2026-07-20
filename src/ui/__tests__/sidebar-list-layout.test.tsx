import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NotesList } from "../../screens/NotesList";
import { SIDEBAR_LIST_INSET_CLASS, SIDEBAR_LIST_SWAP_CLASS } from "../sidebar-list-layout";
import { GENERAL_SPACE_ID, spaceId } from "../../domain";

const workId = spaceId("01WORK000000000000000000");

const notesListProps = {
  notes: [
    {
      id: "a",
      title: "Alpha",
      updatedAt: "2026-05-17T12:00:00Z",
      spaceIds: [],
    },
  ],
  spaceItems: [
    {
      id: GENERAL_SPACE_ID,
      name: "General",
      colorId: null,
      description: null,
      noteCount: 1,
    },
    {
      id: workId,
      name: "Work",
      colorId: "blue" as const,
      description: null,
      noteCount: 0,
    },
  ],
  mode: "notes" as const,
  onToggleMode: () => {},
  selectedNoteId: null,
  selectedSpaceId: null,
  onSelectNote: () => {},
  onSelectSpace: () => {},
  onCreateNote: () => {},
  onCreateSpace: () => {},
  onDeleteNote: () => {},
  onBulkDeleteNotes: () => {},
  onDeleteSpaces: () => {},
  onDuplicateNote: () => {},
};

describe("sidebar list layout", () => {
  it("applies the shared inset on the notes list wrapper", () => {
    render(<NotesList {...notesListProps} />);
    const list = screen.getByRole("list", { name: "Notes" });
    const wrapper = list.parentElement;
    expect(wrapper?.className).toContain("px-4");
  });

  it("applies the shared inset on the spaces list wrapper", () => {
    render(<NotesList {...notesListProps} mode="spaces" />);
    const list = screen.getByRole("list", { name: "Spaces" });
    const wrapper = list.parentElement;
    expect(wrapper?.className).toContain("px-4");
  });

  it("uses the same swap animation shell for notes and spaces lists", () => {
    const { unmount } = render(<NotesList {...notesListProps} mode="notes" />);
    const notesSwap = screen.getByRole("list", { name: "Notes" }).parentElement
      ?.parentElement;
    expect(notesSwap?.className).toBe(SIDEBAR_LIST_SWAP_CLASS);
    expect(screen.getByRole("list", { name: "Notes" }).parentElement?.className).toBe(
      SIDEBAR_LIST_INSET_CLASS,
    );
    unmount();

    render(<NotesList {...notesListProps} mode="spaces" />);
    const spacesSwap = screen.getByRole("list", { name: "Spaces" }).parentElement
      ?.parentElement;
    expect(spacesSwap?.className).toBe(SIDEBAR_LIST_SWAP_CLASS);
    expect(notesSwap?.className).toBe(spacesSwap?.className);
  });
});
