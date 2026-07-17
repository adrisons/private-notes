import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeToggle } from "./ThemeToggle";
import { readStoredTheme, THEME_STORAGE_KEY } from "../lib/theme";

describe("ThemeToggle", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("activates dark theme and persists the choice", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    await user.click(screen.getByRole("radio", { name: /dark/i }));

    expect(screen.getByRole("radio", { name: /dark/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(readStoredTheme()).toBe("dark");
  });

  it("activates light theme and persists the choice", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    await user.click(screen.getByRole("radio", { name: /light/i }));

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });
});
