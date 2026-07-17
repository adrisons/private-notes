import { describe, it, expect } from "vitest";
import {
  dedupeSearchResultsByNote,
  type SearchResultItem,
} from "../view-models";

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
