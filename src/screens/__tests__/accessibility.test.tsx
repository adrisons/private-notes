import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "vitest-axe";
import { Welcome } from "../Welcome";
import { NotesList } from "../NotesList";
import { CommandPalette } from "../CommandPalette";
import { ConfirmDialog } from "../../ui/ConfirmDialog";
import { VaultIndicator } from "../VaultIndicator";
import type { NoteListItem } from "../../application/view-models";
import { GENERAL_SPACE_ID } from "../../domain";

const notes: NoteListItem[] = [
  {
    id: "a",
    title: "Alpha note",
    updatedAt: "2026-05-17T12:00:00Z",
    spaceIds: [],
  },
  {
    id: "b",
    title: "Beta note",
    updatedAt: "2026-05-16T12:00:00Z",
    spaceIds: [],
  },
];

const spaceItems = [
  {
    id: GENERAL_SPACE_ID,
    name: "General",
    colorId: null,
    description: null,
    noteCount: 2,
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
        spaceItems={spaceItems}
        mode="notes"
        onToggleMode={vi.fn()}
        selectedNoteId="a"
        selectedSpaceId={null}
        onSelectNote={vi.fn()}
        onSelectSpace={vi.fn()}
        onCreateNote={vi.fn()}
        onCreateSpace={vi.fn()}
        onDeleteNote={vi.fn()}
        onBulkDeleteNotes={vi.fn()}
        onDeleteSpaces={vi.fn()}
        onDuplicateNote={vi.fn()}
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
        spaceItems={spaceItems}
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
