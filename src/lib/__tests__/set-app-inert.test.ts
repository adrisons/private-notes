import { describe, expect, it } from "vitest";
import { setAppInert } from "../set-app-inert";

describe("setAppInert", () => {
  it("toggles the inert attribute on #root", () => {
    const root = document.createElement("div");
    root.id = "root";
    document.body.appendChild(root);

    setAppInert(true);
    expect(root).toHaveAttribute("inert");

    setAppInert(false);
    expect(root).not.toHaveAttribute("inert");

    root.remove();
  });
});
