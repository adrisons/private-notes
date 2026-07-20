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
});
