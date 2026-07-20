import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DetailTimestamps } from "../DetailTimestamps";

describe("DetailTimestamps", () => {
  it("shows created and edited dates when idle", () => {
    render(
      <DetailTimestamps
        createdAt="2026-05-17T10:00:00.000Z"
        updatedAt="2026-07-20T09:00:00.000Z"
      />,
    );
    expect(screen.getByText(/created/i)).toBeInTheDocument();
    expect(screen.getByText(/edited/i)).toBeInTheDocument();
  });

  it("replaces edited with saving while persisting", () => {
    render(
      <DetailTimestamps
        createdAt="2026-05-17T10:00:00.000Z"
        updatedAt="2026-07-20T09:00:00.000Z"
        isSaving
      />,
    );
    expect(screen.getByText("Saving…")).toBeInTheDocument();
    expect(screen.queryByText(/edited/i)).not.toBeInTheDocument();
  });
});
