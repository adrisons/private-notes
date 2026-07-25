import { describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { configureAxe } from "vitest-axe";
import { Welcome } from "../Welcome";
import { NotesList } from "../NotesList";
import { CommandPalette } from "../CommandPalette";
import { SpaceDetailView } from "../SpaceDetailView";
import { SpaceTagsEditor } from "../SpaceTagsEditor";
import { NoteHeader } from "../NoteHeader";
import { ConfirmDialog } from "../../ui/ConfirmDialog";
import { VaultIndicator } from "../VaultIndicator";
import type { NoteListItem, SpaceListItem } from "../../application/view-models";
import { GENERAL_SPACE_ID, spaceId, type SpaceId } from "../../domain";

const workId = spaceId("01WORK000000000000000000");

const notes: NoteListItem[] = [
  {
    id: "a",
    title: "Alpha note",
    updatedAt: "2026-05-17T12:00:00Z",
    spaceIds: [workId],
  },
  {
    id: "b",
    title: "Beta note",
    updatedAt: "2026-05-16T12:00:00Z",
    spaceIds: [],
  },
];

const spaceItems: SpaceListItem[] = [
  {
    id: GENERAL_SPACE_ID,
    name: "General",
    colorId: null,
    description: null,
    noteCount: 1,
  },
  {
    id: workId,
    name: "Work",
    colorId: "blue",
    description: "Project notes and planning",
    noteCount: 1,
    createdAt: "2026-05-17T10:00:00.000Z",
    updatedAt: "2026-07-20T09:00:00.000Z",
  },
];

const workSpace = spaceItems[1];

/** jsdom cannot evaluate contrast or pseudo-elements; tokens are checked separately. */
const axe = configureAxe({
  rules: {
    "color-contrast": { enabled: false },
  },
});

function notesListProps(
  overrides: Partial<ComponentProps<typeof NotesList>> = {},
) {
  return {
    notes,
    spaceItems,
    mode: "notes" as const,
    onToggleMode: vi.fn(),
    selectedNoteId: "a" as string | null,
    selectedSpaceId: null as SpaceId | null,
    onSelectNote: vi.fn(),
    onSelectSpace: vi.fn(),
    onCreateNote: vi.fn(),
    onCreateSpace: vi.fn(),
    onDeleteNote: vi.fn(),
    onBulkDeleteNotes: vi.fn(),
    onDeleteSpaces: vi.fn(),
    onDuplicateNote: vi.fn(),
    ...overrides,
  };
}

describe("accessibility", () => {
  it("Welcome has no axe violations", async () => {
    const { container } = render(<Welcome onPickFolder={vi.fn()} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("NotesList has no axe violations", async () => {
    const { container } = render(<NotesList {...notesListProps()} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("NotesList in spaces mode has no axe violations", async () => {
    const { container } = render(
      <NotesList
        {...notesListProps({
          mode: "spaces",
          selectedNoteId: null,
          selectedSpaceId: workId,
        })}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("SpaceDetailView for a custom space has no axe violations", async () => {
    const { container } = render(
      <SpaceDetailView
        space={workSpace}
        notes={notes}
        spaceItems={spaceItems}
        onOpenNote={vi.fn()}
        onUpdateSpace={vi.fn().mockResolvedValue(undefined)}
        onDelete={vi.fn()}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("SpaceDetailView for General has no axe violations", async () => {
    const { container } = render(
      <SpaceDetailView
        space={spaceItems[0]}
        notes={notes}
        spaceItems={spaceItems}
        onOpenNote={vi.fn()}
        onUpdateSpace={vi.fn().mockResolvedValue(undefined)}
        onDelete={vi.fn()}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("SpaceTagsEditor has no axe violations", async () => {
    const { container } = render(
      <SpaceTagsEditor
        spaces={spaceItems}
        value={[workId]}
        onChange={vi.fn()}
        onCreateSpace={vi.fn().mockResolvedValue(null)}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("SpaceTagsEditor with suggestions open has no axe violations", async () => {
    const { container } = render(
      <SpaceTagsEditor
        spaces={spaceItems}
        value={[]}
        onChange={vi.fn()}
        onCreateSpace={vi.fn().mockResolvedValue(null)}
      />,
    );
    fireEvent.change(screen.getByLabelText("Note spaces"), {
      target: { value: "Work" },
    });
    expect(await axe(container)).toHaveNoViolations();
  });

  it("NoteHeader with spaces has no axe violations", async () => {
    const { container } = render(
      <NoteHeader
        title="Alpha note"
        spaceIds={[workId]}
        spaces={spaceItems}
        onTitleChange={vi.fn()}
        onSpacesChange={vi.fn()}
        onCreateSpace={vi.fn().mockResolvedValue(null)}
        onDelete={vi.fn()}
        createdAt="2026-05-17T10:00:00.000Z"
        updatedAt="2026-07-20T09:00:00.000Z"
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
