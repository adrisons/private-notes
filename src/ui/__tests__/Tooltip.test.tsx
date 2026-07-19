import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

    const button = screen.getByRole("button");
    const matchSpy = vi.spyOn(button, "matches").mockImplementation((selector) => {
      if (selector === ":focus-visible") return true;
      return HTMLElement.prototype.matches.call(button, selector);
    });

    await user.tab();
    await waitFor(() => {
      expect(screen.getByRole("tooltip", { hidden: true })).toHaveTextContent(
        "Insert image",
      );
    });

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip", { hidden: true })).toBeNull();
    matchSpy.mockRestore();
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

  it("does not show on touch pointer enter", () => {
    render(
      <Tooltip label="More controls">
        <button type="button" aria-label="Show more formatting controls">
          ^
        </button>
      </Tooltip>,
    );

    fireEvent.pointerEnter(screen.getByRole("button"), {
      pointerType: "touch",
    });
    expect(screen.queryByRole("tooltip", { hidden: true })).toBeNull();
  });

  it("does not show after a touch tap", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip label="More controls">
        <button type="button" aria-label="Show more formatting controls">
          ^
        </button>
      </Tooltip>,
    );

    const button = screen.getByRole("button");
    const matchSpy = vi.spyOn(button, "matches").mockImplementation((selector) => {
      if (selector === ":focus-visible") return false;
      return HTMLElement.prototype.matches.call(button, selector);
    });

    await user.click(button);
    expect(screen.queryByRole("tooltip", { hidden: true })).toBeNull();
    matchSpy.mockRestore();
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
