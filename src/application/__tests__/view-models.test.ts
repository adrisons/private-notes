import { describe, it, expect } from "vitest";
import {
  dedupeSearchResultsByNote,
  resolveNoteSpaceChips,
  type SearchResultItem,
} from "../view-models";
import { GENERAL_SPACE, GENERAL_SPACE_ID, spaceId } from "../../domain";

describe("dedupeSearchResultsByNote", () => {
  it("keeps the first hit per note in global score order", () => {
    const hits: SearchResultItem[] = [
      { noteId: "a", score: 0.9 },
      { noteId: "b", score: 0.85 },
      { noteId: "a", score: 0.8 },
    ];
    expect(dedupeSearchResultsByNote(hits)).toEqual([
      { noteId: "a", score: 0.9 },
      { noteId: "b", score: 0.85 },
    ]);
  });
});

describe("resolveNoteSpaceChips", () => {
  const spaces = [
    {
      id: spaceId("work"),
      name: "Work",
      colorId: "blue" as const,
      description: null,
      noteCount: 1,
    },
  ];

  it("returns General when a note has no custom spaces", () => {
    expect(resolveNoteSpaceChips([], spaces)).toEqual([
      { id: GENERAL_SPACE_ID, name: GENERAL_SPACE.name, colorId: null },
    ]);
  });

  it("can omit General for sidebar lists", () => {
    expect(
      resolveNoteSpaceChips([], spaces, { omitGeneral: true }),
    ).toEqual([]);
    expect(
      resolveNoteSpaceChips([spaceId("work")], spaces, { omitGeneral: true }),
    ).toEqual([{ id: spaceId("work"), name: "Work", colorId: "blue" }]);
  });

  it("omits General by id, so a custom space named General survives", () => {
    const withDecoy = [
      ...spaces,
      {
        id: spaceId("decoy"),
        name: GENERAL_SPACE.name,
        colorId: "red" as const,
        description: null,
        noteCount: 0,
      },
    ];
    expect(
      resolveNoteSpaceChips([spaceId("decoy")], withDecoy, {
        omitGeneral: true,
      }),
    ).toEqual([{ id: spaceId("decoy"), name: "General", colorId: "red" }]);
  });

  it("surfaces a dangling id instead of mislabelling it General", () => {
    expect(resolveNoteSpaceChips([spaceId("gone")], spaces)).toEqual([
      { id: spaceId("gone"), name: "gone", colorId: null },
    ]);
  });
});
