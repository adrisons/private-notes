import { describe, it, expect } from "vitest";
import {
  rankSearchResults,
  resolveNoteSpaceChips,
  type NoteListItem,
  type SearchResultItem,
  type SpaceListItem,
} from "../view-models";
import { GENERAL_SPACE, GENERAL_SPACE_ID, spaceId } from "../../domain";

describe("rankSearchResults", () => {
  const workId = spaceId("work");
  const spaces: SpaceListItem[] = [
    {
      id: workId,
      name: "Bitácora",
      colorId: null,
      description: null,
      noteCount: 1,
    },
  ];
  const notes: NoteListItem[] = [
    {
      id: "a",
      title: "Tiradito de pescado",
      createdAt: "2026-05-17T12:00:00Z",
      updatedAt: "2026-05-17T12:00:00Z",
      spaceIds: [],
    },
    {
      id: "b",
      title: "Raita de pepino",
      createdAt: "2026-05-16T12:00:00Z",
      updatedAt: "2026-05-16T12:00:00Z",
      spaceIds: [],
    },
    {
      id: "c",
      title: "Reunión de producto",
      createdAt: "2026-05-15T12:00:00Z",
      updatedAt: "2026-05-15T12:00:00Z",
      spaceIds: [workId],
    },
  ];

  it("merges content hits and title matches into one ordered list", () => {
    const hits: SearchResultItem[] = [
      { noteId: "b", score: 0.9, matchKind: "semantic" },
      { noteId: "a", score: 0.85, matchKind: "semantic" },
    ];
    const ranked = rankSearchResults({
      query: "pescado",
      hits,
      notes,
      spaces,
    });
    expect(ranked[0]?.noteId).toBe("a");
    expect(ranked[0]?.matchKind).toBe("title");
  });

  it("keeps one row per note", () => {
    const hits: SearchResultItem[] = [
      { noteId: "a", score: 0.9, matchKind: "semantic" },
      { noteId: "a", score: 0.4, matchKind: "semantic" },
    ];
    const ranked = rankSearchResults({ query: "pescado", hits, notes, spaces });
    expect(ranked.filter((r) => r.noteId === "a")).toHaveLength(1);
  });

  it("resolves space names so they can be matched", () => {
    const ranked = rankSearchResults({
      query: "bitacora",
      hits: [],
      notes,
      spaces,
    });
    expect(ranked.map((r) => r.noteId)).toEqual(["c"]);
  });

  it("returns nothing for an empty query", () => {
    expect(
      rankSearchResults({ query: "  ", hits: [], notes, spaces }),
    ).toEqual([]);
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
