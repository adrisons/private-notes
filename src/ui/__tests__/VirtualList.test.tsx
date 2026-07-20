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
    expect(screen.getByRole("list", { name: "Windowed list" })).toHaveStyle({
      height: `${20 * 48 - 8}px`,
    });
  });
});
