import { describe, expect, it } from "vitest";
import { sidebarListRowSurfaceClass } from "../sidebar-list-row-surface";

describe("sidebarListRowSurfaceClass", () => {
  it("uses the resting card surface when nothing is selected", () => {
    expect(
      sidebarListRowSurfaceClass({
        kind: "note",
        selected: false,
        checked: false,
        selectionMode: false,
      }),
    ).toContain("shadow-[var(--shadow-rest)]");

    expect(
      sidebarListRowSurfaceClass({
        kind: "space",
        selected: false,
        checked: false,
        selectionMode: false,
      }),
    ).toContain("bg-[var(--surface-raised)]");
  });

  it("keeps note selection on the raised card without an accent ring", () => {
    const classes = sidebarListRowSurfaceClass({
      kind: "note",
      selected: true,
      checked: false,
      selectionMode: false,
    });
    expect(classes).toContain("shadow-[var(--shadow-rest)]");
    expect(classes).not.toContain("ring-1");
  });

  it("uses the accent ring for selected spaces", () => {
    const classes = sidebarListRowSurfaceClass({
      kind: "space",
      selected: true,
      checked: false,
      selectionMode: false,
    });
    expect(classes).toContain("ring-1 ring-[var(--accent)]/30");
  });

  it("marks checked rows in selection mode", () => {
    const classes = sidebarListRowSurfaceClass({
      kind: "note",
      selected: false,
      checked: true,
      selectionMode: true,
    });
    expect(classes).toContain("bg-[var(--accent-soft)]");
  });
});
