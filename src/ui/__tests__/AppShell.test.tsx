import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppShell } from "../AppShell";

/**
 * The mobile disclosure (docs/design.md §8). The desktop/mobile split itself is
 * CSS-only — one sidebar instance, two layouts — so these tests cover the
 * behaviour: toggling, Escape, and collapsing when a note is picked.
 */
describe("AppShell", () => {
  const setup = (collapseKey: string | null = null) =>
    render(
      <AppShell
        header={<span>header</span>}
        sidebar={<button type="button">New</button>}
        collapseKey={collapseKey}
      >
        <p>content</p>
      </AppShell>,
    );

  it("renders the sidebar once so controls are never duplicated", () => {
    setup();
    expect(screen.getAllByRole("button", { name: /^new$/i })).toHaveLength(1);
  });

  it("starts collapsed and toggles the panel", async () => {
    const user = userEvent.setup();
    setup();

    const toggle = screen.getByRole("button", { name: /show notes and search/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle);
    expect(
      screen.getByRole("button", { name: /hide notes and search/i }),
    ).toHaveAttribute("aria-expanded", "true");

    await user.click(screen.getByRole("button", { name: /hide notes/i }));
    expect(
      screen.getByRole("button", { name: /show notes/i }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole("button", { name: /show notes/i }));
    await user.keyboard("{Escape}");

    expect(
      screen.getByRole("button", { name: /show notes/i }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("collapses and focuses the content when the selection changes", async () => {
    const user = userEvent.setup();
    const { rerender } = setup("note-a");

    await user.click(screen.getByRole("button", { name: /show notes/i }));

    rerender(
      <AppShell
        header={<span>header</span>}
        sidebar={<button type="button">New</button>}
        collapseKey="note-b"
      >
        <p>content</p>
      </AppShell>,
    );

    expect(
      screen.getByRole("button", { name: /show notes/i }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("main")).toHaveFocus();
  });

  it("does not render a disclosure when there is no sidebar", () => {
    render(<AppShell header={<span>header</span>}>content</AppShell>);
    expect(
      screen.queryByRole("button", { name: /notes and search/i }),
    ).toBeNull();
  });

  it("exposes a skip link and labeled landmarks", () => {
    setup();
    expect(screen.getByRole("link", { name: /skip to content/i })).toHaveAttribute(
      "href",
      `#${screen.getByRole("main", { name: /note content/i }).id}`,
    );
    expect(
      screen.getByRole("complementary", { name: /notes and search/i }),
    ).toBeInTheDocument();
  });
});
