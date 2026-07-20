import { describe, it, expect } from "vitest";
import {
  dedupeSearchResultsByNote,
  resolveNoteSpaceChips,
  type SearchResultItem,
} from "../view-models";
import { GENERAL_SPACE, spaceId } from "../../domain";

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
      { name: GENERAL_SPACE.name, colorId: null },
    ]);
  });

  it("can omit General for sidebar lists", () => {
    expect(
      resolveNoteSpaceChips([], spaces, { omitGeneral: true }),
    ).toEqual([]);
    expect(
      resolveNoteSpaceChips([spaceId("work")], spaces, { omitGeneral: true }),
    ).toEqual([{ name: "Work", colorId: "blue" }]);
  });
});
