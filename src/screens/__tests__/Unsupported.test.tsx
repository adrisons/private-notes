import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Unsupported } from "../Unsupported";

describe("Unsupported", () => {
  it("shows iOS-specific copy for the ios kind", () => {
    render(<Unsupported reasons={["File System Access API is unavailable."]} kind="ios" />);
    expect(
      screen.getByRole("heading", { name: /iphone and ipad aren.t supported/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Chrome on Android/i)).toBeInTheDocument();
  });

  it("defaults to generic browser copy", () => {
    render(<Unsupported reasons={["Some reason"]} />);
    expect(
      screen.getByRole("heading", { name: /this browser isn.t supported/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Some reason")).toBeInTheDocument();
  });
});
