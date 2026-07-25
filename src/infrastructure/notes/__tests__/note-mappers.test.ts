import { describe, expect, it } from "vitest";
import type { NoteRecord } from "../../fs/schema";
import {
  noteFromRecord,
  summaryFromRecord,
} from "../note-mappers";
import { noteToSummary } from "../../../domain/note/note";
import { noteId } from "../../../domain/note/note-id";

const sampleRecord: NoteRecord = {
  id: "01HNOTE123",
  title: "Hello",
  path: "notes/2026/05/hello.md",
  createdAt: "2026-05-17T10:00:00.000Z",
  updatedAt: "2026-05-18T10:00:00.000Z",
};

describe("note mappers", () => {
  it("maps a persistence record to a domain note", () => {
    const note = noteFromRecord(sampleRecord, "Body text");
    expect(note.id).toBe(noteId("01HNOTE123"));
    expect(note.body).toBe("Body text");
    expect(note.title).toBe("Hello");
  });

  it("projects a summary from record and note", () => {
    expect(summaryFromRecord(sampleRecord)).toEqual({
      id: noteId("01HNOTE123"),
      title: "Hello",
      updatedAt: "2026-05-18T10:00:00.000Z",
      spaceIds: [],
    });
    const note = noteFromRecord(sampleRecord, "x");
    expect(noteToSummary(note)).toEqual(summaryFromRecord(sampleRecord));
  });
});
