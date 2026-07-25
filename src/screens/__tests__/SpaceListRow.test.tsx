import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SpaceListRow, SPACE_LIST_ROW_HEIGHT } from "../SpaceListRow";
import { GENERAL_SPACE_ID } from "../../domain";

const space = {
  id: GENERAL_SPACE_ID,
  name: "Pastas",
  colorId: "amber" as const,
  description:
    "Fresca, seca y todo lo que la acompaña en la mesa, incluso salsas largas.",
  noteCount: 3,
};

describe("SpaceListRow", () => {
  it("keeps the full description in the DOM and clamps it visually", () => {
    render(
      <ul>
        <SpaceListRow
          space={space}
          selected={false}
          checked={false}
          selectionMode={false}
          selectable={false}
          tabStop={false}
          onSelect={vi.fn()}
          onToggleCheck={vi.fn()}
          onFocus={vi.fn()}
        />
      </ul>,
    );

    const description = screen.getByText(space.description);
    expect(description).toHaveClass("line-clamp-2");
    expect(description.textContent).toBe(space.description);
  });

  it("reserves enough virtual row height for two description lines", () => {
    expect(SPACE_LIST_ROW_HEIGHT).toBeGreaterThanOrEqual(96);
  });
});
