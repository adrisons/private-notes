import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { App } from "./App";

describe("App", () => {
  // jsdom lacks `showDirectoryPicker`, so the compatibility gate kicks in.
  it("renders the unsupported screen under jsdom", () => {
    render(<App />);
    expect(
      screen.getByRole("heading", { name: /this browser isn.t supported/i }),
    ).toBeInTheDocument();
  });
});
