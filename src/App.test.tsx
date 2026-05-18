import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders the welcome screen when no folder has been picked", () => {
    render(<App />);
    expect(
      screen.getByRole("heading", { name: /your notes, on your machine/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /choose folder/i }),
    ).toBeInTheDocument();
  });
});
