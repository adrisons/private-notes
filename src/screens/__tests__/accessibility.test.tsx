import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "vitest-axe";
import { Welcome } from "../Welcome";
import { NotesList } from "../NotesList";
import { CommandPalette } from "../CommandPalette";
import { ConfirmDialog } from "../../ui/ConfirmDialog";
import { VaultIndicator } from "../VaultIndicator";
import type { NoteListItem } from "../../application/view-models";

const notes: NoteListItem[] = [
  {
    id: "a",
    title: "Alpha note",
    updatedAt: "2026-05-17T12:00:00Z",
  },
  {
    id: "b",
    title: "Beta note",
    updatedAt: "2026-05-16T12:00:00Z",
  },
];

describe("accessibility", () => {
  it("Welcome has no axe violations", async () => {
    const { container } = render(<Welcome onPickFolder={vi.fn()} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("NotesList has no axe violations", async () => {
    const { container } = render(
      <NotesList
        notes={notes}
        selectedId="a"
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onDelete={vi.fn()}
        onBulkDelete={vi.fn()}
        onDuplicate={vi.fn()}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("CommandPalette has no axe violations", async () => {
    const { container } = render(
      <CommandPalette
        open
        onClose={vi.fn()}
        notes={notes}
        searchReady
        onSearch={vi.fn(async () => [])}
        onOpenNote={vi.fn()}
        onCreate={vi.fn()}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("VaultIndicator has no axe violations", async () => {
    const { container } = render(
      <VaultIndicator name="My notes" onChange={vi.fn()} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("ConfirmDialog has no axe violations", async () => {
    const { container } = render(
      <ConfirmDialog
        open
        title="Delete this note?"
        description="This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
