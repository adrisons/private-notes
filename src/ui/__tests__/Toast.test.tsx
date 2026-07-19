import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toast } from "../Toast";

describe("Toast", () => {
  it("renders the user message and fix hint", () => {
    render(
      <Toast
        message="Could not save your note."
        fixHint="Check that the folder is still accessible."
        onDismiss={vi.fn()}
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Could not save your note.");
    expect(alert).toHaveTextContent("Check that the folder is still accessible.");
  });

  it("calls onDismiss when Dismiss is clicked", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <Toast
        message="Could not open this note."
        fixHint="Try reopening the folder."
        onDismiss={onDismiss}
      />,
    );

    await user.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
