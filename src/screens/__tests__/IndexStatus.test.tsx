import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IndexStatus } from "../IndexStatus";

describe("IndexStatus", () => {
  it("calls onReindex from the info dialog", async () => {
    const user = userEvent.setup();
    const onReindex = vi.fn();
    render(
      <IndexStatus
        ready
        reindexing={false}
        progress={null}
        onReindex={onReindex}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /all indexed/i }),
    );
    await user.click(screen.getByRole("button", { name: /^reindex$/i }));

    expect(onReindex).toHaveBeenCalledTimes(1);
  });

  it("shows indexing progress while reindexing", () => {
    render(
      <IndexStatus
        ready
        reindexing
        progress={{ done: 2, total: 5 }}
        onReindex={vi.fn()}
      />,
    );
    expect(screen.getByText("Indexing 40%")).toBeInTheDocument();
  });
});
