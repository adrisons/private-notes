import { describe, expect, it } from "vitest";
import { noteId } from "../note/note-id";
import type { NoteSummary } from "../note/note-summary";
import { pickMostRecent, sortSummariesByRecency } from "../vault/vault";

const summaries: NoteSummary[] = [
  {
    id: noteId("a"),
    title: "Older",
    updatedAt: "2026-05-17T10:00:00.000Z",
    spaceIds: [],
  },
  {
    id: noteId("b"),
    title: "Newer",
    updatedAt: "2026-05-19T10:00:00.000Z",
    spaceIds: [],
  },
];

describe("vault helpers", () => {
  it("sorts summaries by updatedAt descending", () => {
    const sorted = sortSummariesByRecency(summaries);
    expect(sorted.map((s) => s.id)).toEqual([noteId("b"), noteId("a")]);
  });

  it("picks the most recently updated summary", () => {
    expect(pickMostRecent(summaries)?.id).toBe(noteId("b"));
    expect(pickMostRecent([])).toBeNull();
  });
});
