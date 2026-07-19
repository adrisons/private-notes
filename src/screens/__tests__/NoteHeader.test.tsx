import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NoteHeader } from "../NoteHeader";

/**
 * The title is a textarea so long titles wrap instead of scrolling sideways
 * (docs/design.md §7). It must still behave as one logical line.
 */
describe("NoteHeader", () => {
  const setup = (onTitleChange = vi.fn()) => {
    render(
      <NoteHeader
        title="Welcome"
        onTitleChange={onTitleChange}
        onDelete={vi.fn()}
        savedAt={null}
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
});
