import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dialog } from "../Dialog";

describe("Dialog", () => {
  it("closes on Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} label="Test dialog">
        <p>Dialog body</p>
      </Dialog>,
    );

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("restores focus to the element that was active when the dialog opened", async () => {
    const user = userEvent.setup();

    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <div>
          <button type="button" onClick={() => setOpen(true)}>
            Open dialog
          </button>
          <Dialog open={open} onClose={() => setOpen(false)} label="Test dialog">
            <button type="button">Inside</button>
          </Dialog>
        </div>
      );
    }

    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Open dialog" });
    await user.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });

  it("traps Tab focus inside the dialog", async () => {
    const user = userEvent.setup();
    render(
      <Dialog open onClose={vi.fn()} label="Actions">
        <div className="p-4">
          <button type="button">First</button>
          <button type="button">Second</button>
        </div>
      </Dialog>,
    );

    const dialog = screen.getByRole("dialog", { name: "Actions" });
    expect(dialog).toHaveAttribute("aria-modal", "true");

    const first = screen.getByRole("button", { name: "First" });
    const second = screen.getByRole("button", { name: "Second" });
    second.focus();

    await user.tab();
    expect(document.activeElement).toBe(first);

    await user.tab({ shift: true });
    expect(document.activeElement).toBe(second);
  });

  it("marks the app root inert while open", () => {
    const root = document.createElement("div");
    root.id = "root";
    document.body.appendChild(root);

    render(
      <Dialog open onClose={vi.fn()} label="Test dialog">
        <p>Dialog body</p>
      </Dialog>,
    );

    expect(root).toHaveAttribute("inert");
    root.remove();
  });

  it("focuses the initial focus target when provided", async () => {
    function Harness() {
      const inputRef = useRef<HTMLInputElement>(null);
      return (
        <Dialog
          open
          onClose={vi.fn()}
          label="Form"
          initialFocusRef={inputRef}
        >
          <input ref={inputRef} aria-label="Name" />
        </Dialog>
      );
    }

    render(<Harness />);
    await vi.waitFor(() => {
      expect(screen.getByLabelText("Name")).toHaveFocus();
    });
  });
});
