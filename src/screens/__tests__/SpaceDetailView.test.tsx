import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SpaceDetailView } from "../SpaceDetailView";
import { GENERAL_SPACE_ID, spaceId } from "../../domain";
import type { NoteListItem, SpaceListItem } from "../../application/view-models";

const workSpace: SpaceListItem = {
  id: spaceId("work"),
  name: "Ideas",
  colorId: "red",
  description: "This is the description",
  noteCount: 1,
  createdAt: "2026-05-17T10:00:00.000Z",
  updatedAt: "2026-07-20T09:00:00.000Z",
};

const generalSpace: SpaceListItem = {
  id: GENERAL_SPACE_ID,
  name: "General",
  colorId: null,
  description: null,
  noteCount: 9,
};

const notes: NoteListItem[] = [
  {
    id: "n1",
    title: "Foto personal",
    updatedAt: "2026-07-20T09:00:00.000Z",
    spaceIds: [workSpace.id],
  },
];

describe("SpaceDetailView", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders an editable form for custom spaces with autosave", async () => {
    const user = userEvent.setup();
    const onUpdateSpace = vi.fn().mockResolvedValue(undefined);

    render(
      <SpaceDetailView
        space={workSpace}
        notes={notes}
        spaceItems={[workSpace]}
        onOpenNote={vi.fn()}
        onUpdateSpace={onUpdateSpace}
        onDelete={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("textbox", { name: /space name/i }),
    ).toHaveValue("Ideas");
    expect(
      screen.getByRole("textbox", { name: /space description/i }),
    ).toHaveValue("This is the description");
    expect(screen.queryByRole("button", { name: /^edit$/i })).not.toBeInTheDocument();
    expect(screen.getByText(/created/i)).toBeInTheDocument();
    expect(screen.getByText(/edited/i)).toBeInTheDocument();

    await user.clear(screen.getByRole("textbox", { name: /space name/i }));
    await user.type(
      screen.getByRole("textbox", { name: /space name/i }),
      "Work",
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    await waitFor(() => {
      expect(onUpdateSpace).toHaveBeenCalledWith(workSpace.id, {
        name: "Work",
        colorId: "red",
        description: "This is the description",
      });
    });
  });

  it("sends null when the description is emptied, so the field is cleared", async () => {
    const user = userEvent.setup();
    const onUpdateSpace = vi.fn().mockResolvedValue(undefined);

    render(
      <SpaceDetailView
        space={workSpace}
        notes={notes}
        spaceItems={[workSpace]}
        onOpenNote={vi.fn()}
        onUpdateSpace={onUpdateSpace}
        onDelete={vi.fn()}
      />,
    );

    await user.clear(
      screen.getByRole("textbox", { name: /space description/i }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    await waitFor(() => {
      expect(onUpdateSpace).toHaveBeenCalledWith(
        workSpace.id,
        expect.objectContaining({ description: null }),
      );
    });
  });

  it("renders General without a chip badge", () => {
    render(
      <SpaceDetailView
        space={generalSpace}
        notes={notes}
        spaceItems={[generalSpace]}
        onOpenNote={vi.fn()}
        onUpdateSpace={vi.fn().mockResolvedValue(undefined)}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "General" })).toBeInTheDocument();
    expect(screen.getByText("Notes without another space live here.")).toBeInTheDocument();
    expect(screen.queryByText(/created/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/edited/i)).not.toBeInTheDocument();
    expect(screen.queryByText("General", { selector: "span" })).not.toBeInTheDocument();
  });
});
