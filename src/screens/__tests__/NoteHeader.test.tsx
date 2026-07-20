import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GENERAL_SPACE_ID, type SpaceId } from "../../domain";
import { NoteHeader } from "../NoteHeader";

const spaces = [
  {
    id: GENERAL_SPACE_ID,
    name: "General",
    colorId: null,
    description: null,
    noteCount: 1,
  },
];

const headerProps = {
  spaceIds: [] as SpaceId[],
  spaces,
  onSpacesChange: vi.fn(),
  onCreateSpace: vi.fn(async () => null),
  onDelete: vi.fn(),
  createdAt: "2026-05-17T10:00:00.000Z",
  updatedAt: "2026-07-20T09:00:00.000Z",
};

/**
 * The title is a textarea so long titles wrap instead of scrolling sideways
 * (docs/design.md §7). It must still behave as one logical line.
 */
describe("NoteHeader", () => {
  const setup = (onTitleChange = vi.fn()) => {
    render(
      <NoteHeader
        title="Welcome"
        {...headerProps}
        onTitleChange={onTitleChange}
      />,
    );
    return { field: screen.getByLabelText("Note title"), onTitleChange };
  };

  it("renders the title in a wrapping field", () => {
    const { field } = setup();
    expect(field.tagName).toBe("TEXTAREA");
    expect(field).toHaveValue("Welcome");
  });

  it("keeps the title on one logical line when text is pasted", () => {
    const { field, onTitleChange } = setup();
    fireEvent.change(field, { target: { value: "Shopping\nlist" } });
    expect(onTitleChange).toHaveBeenCalledWith("Shopping list");
  });

  it("does not insert a newline on Enter", async () => {
    const user = userEvent.setup();
    const { field, onTitleChange } = setup();
    await user.click(field);
    await user.keyboard("{Enter}");
    expect(onTitleChange).not.toHaveBeenCalled();
  });

  it("shows created and edited timestamps", () => {
    setup();
    expect(screen.getByText(/created/i)).toBeInTheDocument();
    expect(screen.getByText(/edited/i)).toBeInTheDocument();
  });

  it("shows saving in place of the edited timestamp", () => {
    const { rerender } = render(
      <NoteHeader
        title="Welcome"
        {...headerProps}
        onTitleChange={vi.fn()}
        isSaving
      />,
    );
    expect(screen.getByText("Saving…")).toBeInTheDocument();
    expect(screen.queryByText(/edited/i)).not.toBeInTheDocument();
    expect(screen.getByText(/created/i)).toBeInTheDocument();

    rerender(
      <NoteHeader
        title="Welcome"
        {...headerProps}
        onTitleChange={vi.fn()}
        updatedAt="2026-07-21T12:00:00Z"
        isSaving={false}
      />,
    );
    expect(screen.getByText(/edited/i)).toBeInTheDocument();
    expect(screen.queryByText(/saved/i)).not.toBeInTheDocument();
  });
});
