import { describe, expect, it, vi } from "vitest";
import { getFocusableElements, trapFocus } from "../focus-trap";

function mount(html: string): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = html;
  document.body.appendChild(root);
  return root;
}

describe("focus-trap", () => {
  it("lists enabled focusable elements", () => {
    const root = mount(`
      <button>One</button>
      <button disabled>Two</button>
      <a href="#">Three</a>
    `);
    expect(getFocusableElements(root).map((el) => el.textContent)).toEqual([
      "One",
      "Three",
    ]);
    root.remove();
  });

  it("wraps Tab from the last element to the first", () => {
    const root = mount(`
      <button id="a">A</button>
      <button id="b">B</button>
    `);
    const second = root.querySelector("#b") as HTMLButtonElement;
    second.focus();

    const event = new KeyboardEvent("keydown", { key: "Tab", bubbles: true });
    const prevent = vi.spyOn(event, "preventDefault");
    trapFocus(root, event);

    expect(prevent).toHaveBeenCalled();
    expect(document.activeElement?.textContent).toBe("A");
    root.remove();
  });

  it("wraps Shift+Tab from the first element to the last", () => {
    const root = mount(`
      <button id="a">A</button>
      <button id="b">B</button>
    `);
    const first = root.querySelector("#a") as HTMLButtonElement;
    first.focus();

    const event = new KeyboardEvent("keydown", {
      key: "Tab",
      shiftKey: true,
      bubbles: true,
    });
    const prevent = vi.spyOn(event, "preventDefault");
    trapFocus(root, event);

    expect(prevent).toHaveBeenCalled();
    expect(document.activeElement?.textContent).toBe("B");
    root.remove();
  });
});
