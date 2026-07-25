import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { VirtualList } from "../VirtualList";

describe("VirtualList", () => {
  it("renders all rows when below the virtualization threshold", () => {
    render(
      <VirtualList
        items={["Alpha", "Beta", "Gamma"]}
        itemHeight={48}
        ariaLabel="Test list"
        getItemKey={(item) => item}
        renderItem={(item) => <li>{item}</li>}
      />,
    );
    expect(screen.getByRole("list", { name: "Test list" })).toBeInTheDocument();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Gamma")).toBeInTheDocument();
  });

  it("shows an empty state", () => {
    render(
      <VirtualList
        items={[]}
        itemHeight={48}
        ariaLabel="Empty list"
        emptyState={<span>Nothing here</span>}
        getItemKey={() => "x"}
        renderItem={() => null}
      />,
    );
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });

  it("uses an internal scroll container below the virtualization threshold", () => {
    render(
      <VirtualList
        items={["Alpha", "Beta"]}
        itemHeight={48}
        ariaLabel="Scrollable list"
        className="h-24"
        getItemKey={(item) => item}
        renderItem={(item) => <li>{item}</li>}
      />,
    );
    const scrollRoot = screen
      .getByRole("list", { name: "Scrollable list" })
      .closest("[data-virtual-list-scroll]");
    expect(scrollRoot).toHaveClass("overflow-y-auto");
  });

  it("virtualizes when virtualizeThreshold is zero", () => {
    const items = Array.from({ length: 20 }, (_, index) => `Row ${index}`);
    render(
      <div className="h-48 overflow-y-auto">
        <VirtualList
          items={items}
          itemHeight={40}
          gap={8}
          ariaLabel="Windowed list"
          scrollMode="external"
          virtualizeThreshold={0}
          getItemKey={(item) => item}
          renderItem={(item) => <li>{item}</li>}
        />
      </div>,
    );
    expect(screen.getByText("Row 0")).toBeInTheDocument();
    expect(screen.queryByText("Row 19")).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Windowed list, 20 items" })).toHaveStyle({
      height: `${20 * 48 - 8}px`,
    });
  });

  it("threads set size and position onto windowed rows", () => {
    const items = Array.from({ length: 12 }, (_, index) => `Row ${index}`);
    render(
      <div className="h-24 overflow-y-auto">
        <VirtualList
          items={items}
          itemHeight={32}
          gap={0}
          ariaLabel="Sized list"
          scrollMode="external"
          virtualizeThreshold={0}
          getItemKey={(item) => item}
          renderItem={(item, _index, ctx) => (
            <li data-pos={ctx.posInSet} data-size={ctx.setSize}>
              {item}
            </li>
          )}
        />
      </div>,
    );
    const first = screen.getByText("Row 0").closest("li");
    expect(first).toHaveAttribute("aria-setsize", "12");
    expect(first).toHaveAttribute("aria-posinset", "1");
    expect(first).toHaveAttribute("data-size", "12");
    expect(first).toHaveAttribute("data-pos", "1");
  });

  it("clamps the roving tab stop to the rendered window", () => {
    const items = Array.from({ length: 20 }, (_, index) => `Row ${index}`);
    render(
      <div className="h-48 overflow-y-auto">
        <VirtualList
          items={items}
          itemHeight={40}
          gap={8}
          ariaLabel="Focus list"
          scrollMode="external"
          virtualizeThreshold={0}
          focusIndex={19}
          getItemKey={(item) => item}
          renderItem={(item, _index, ctx) => (
            <li>
              <button type="button" tabIndex={ctx.tabStop ? 0 : -1}>
                {item}
              </button>
            </li>
          )}
        />
      </div>,
    );
    const tabStops = screen
      .getAllByRole("button")
      .filter((button) => button.tabIndex === 0);
    expect(tabStops).toHaveLength(1);
    expect(tabStops[0]).not.toHaveAccessibleName("Row 19");
  });
});
