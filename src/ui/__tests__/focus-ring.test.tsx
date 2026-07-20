import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "../Button";
import { Input } from "../Input";

describe("focus ring utilities", () => {
  it("defines tokenized focus ring styles that follow border-radius", () => {
    const css = readFileSync(
      resolve(import.meta.dirname, "../../styles.css"),
      "utf8",
    );

    expect(css).toMatch(
      /\.u-focus:focus-visible\s*\{[^}]*outline:\s*var\(--focus-ring-width\)/s,
    );
    expect(css).toMatch(
      /\.u-focus-inset:focus-visible\s*\{[^}]*box-shadow:\s*inset/s,
    );
  });

  it("applies u-focus to Button and Input primitives", () => {
    render(
      <>
        <Button>Save</Button>
        <Input aria-label="Title" />
      </>,
    );

    expect(screen.getByRole("button", { name: "Save" })).toHaveClass("u-focus");
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveClass(
      "u-focus",
    );
  });
});
