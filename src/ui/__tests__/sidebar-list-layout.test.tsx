import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NotesList } from "../../screens/NotesList";
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
});
