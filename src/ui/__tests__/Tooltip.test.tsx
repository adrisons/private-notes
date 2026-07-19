import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tooltip } from "../Tooltip";

describe("Tooltip", () => {
  it("stays hidden until the trigger is hovered", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip label="Code block" shortcut="⌥⌘C">
        <button type="button" aria-label="Code block (⌥⌘C)">
          {"{ }"}
        </button>
      </Tooltip>,
    );

    expect(screen.queryByRole("tooltip", { hidden: true })).toBeNull();

    await user.hover(screen.getByRole("button"));
    expect(
      screen.getByRole("tooltip", { hidden: true }),
    ).toHaveTextContent("Code block");

    await user.unhover(screen.getByRole("button"));
    expect(screen.queryByRole("tooltip", { hidden: true })).toBeNull();
  });

  it("shows on keyboard focus and hides on Escape", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip label="Insert image">
        <button type="button">Image</button>
      </Tooltip>,
    );

    await user.tab();
    expect(screen.getByRole("tooltip", { hidden: true })).toHaveTextContent(
      "Insert image",
    );

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip", { hidden: true })).toBeNull();
  });

  it("is hidden from assistive tech — the trigger already carries the name", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip label="Bold">
        <button type="button" aria-label="Bold (⌘B)">
          B
        </button>
      </Tooltip>,
    );

    await user.hover(screen.getByRole("button"));
    expect(screen.getByRole("tooltip", { hidden: true })).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    // Not exposed in the accessible tree, so it is never announced twice.
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("lays out the label and shortcut as separate flex children", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip label="Numbered list" shortcut="⇧⌘7">
        <button type="button" aria-label="Numbered list (⇧⌘7)">
          1.
        </button>
      </Tooltip>,
    );

    await user.hover(screen.getByRole("button"));
    const tooltip = screen.getByRole("tooltip", { hidden: true });
    expect(tooltip.querySelector(".u-tooltip-label")).toHaveTextContent(
      "Numbered list",
    );
    expect(tooltip.querySelector(".u-tooltip-shortcut")).toHaveTextContent(
      "⇧⌘7",
    );
  });

  it("shows the divider markdown shortcut separated from the label", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip label="Divider" shortcut="---">
        <button type="button" aria-label="Divider (---)">
          —
        </button>
      </Tooltip>,
    );

    await user.hover(screen.getByRole("button"));
    const tooltip = screen.getByRole("tooltip", { hidden: true });
    expect(tooltip.querySelector(".u-tooltip-label")).toHaveTextContent("Divider");
    expect(tooltip.querySelector(".u-tooltip-shortcut")).toHaveTextContent("---");
  });
});
