import { describe, it, expect, beforeAll } from "vitest";
import { setupTestVault, type TestVaultIo } from "../../test/vaultFixtures";
import {
  RELEVANCE_CASES,
  RELEVANCE_NOTES,
  type RelevanceCase,
} from "../../test/relevanceFixtures";
import { createNote } from "../../infrastructure/notes/storage";
import { FsNoteRepository } from "../../infrastructure/notes/fs-note-repository";
import { FakeEmbedder } from "../../infrastructure/search/embedder";
import { reindex } from "../../infrastructure/search/indexer";
import { searchSemantic } from "../../infrastructure/search/search";
import { searchNotes } from "../use-cases/search-notes";
import { rankSearchResults } from "../view-models";
import type { SemanticSearch } from "../ports/semantic-search";
import type { NoteListItem, SpaceListItem } from "../view-models";
import { spaceId, type SpaceId } from "../../domain";

/**
 * The relevance regression net described in `test/relevanceFixtures.ts`, run
 * over the real stack: notes on (fake) disk → indexer → hybrid retrieval →
 * the merged palette ranking.
 *
 * The embedder is `FakeEmbedder`, so what is under test is the ranking
 * pipeline, not the production model's semantics. Its dimensionality is
 * raised well above the default here for one reason: feature hashing at 32
 * dimensions collides often enough that unrelated notes score like matches,
 * and the noise would be the test's, not the ranker's. It also declares a
 * score floor, exactly as a real model does — without one, every query drags
 * in whatever collided with it.
 */
const embedder = new FakeEmbedder("fake-hash-1024", 1024, 0.2);

interface Harness {
  io: TestVaultIo;
  noteIdByKey: Map<string, string>;
  notes: NoteListItem[];
  spaces: SpaceListItem[];
  search: SemanticSearch;
}

async function buildHarness(): Promise<Harness> {
  const io = await setupTestVault();
  const noteIdByKey = new Map<string, string>();
  const spaceIdByName = new Map<string, SpaceId>();

  for (const fixture of RELEVANCE_NOTES) {
    for (const name of fixture.spaceNames ?? []) {
      if (!spaceIdByName.has(name)) {
        spaceIdByName.set(name, spaceId(`space-${spaceIdByName.size}`));
      }
    }
    const record = await createNote(io, {
      title: fixture.title,
      body: fixture.body,
    });
    noteIdByKey.set(fixture.key, record.id);
  }

  await reindex(io.root, await new FsNoteRepository(io.root).listForReindex(), embedder);

  const notes: NoteListItem[] = RELEVANCE_NOTES.map((fixture) => ({
    id: noteIdByKey.get(fixture.key)!,
    title: fixture.title,
    updatedAt: "2026-05-17T10:00:00.000Z",
    spaceIds: (fixture.spaceNames ?? []).map(
      (name) => spaceIdByName.get(name)!,
    ),
  }));
  const spaces: SpaceListItem[] = [...spaceIdByName].map(([name, id]) => ({
    id,
    name,
    colorId: null,
    description: null,
    noteCount: 0,
  }));

  const search: SemanticSearch = {
    searchSemantic: (query, e, options) =>
      searchSemantic(io.root, query, e, options),
    reindex: async () => {},
    pruneOrphans: async () => {},
  };

  return { io, noteIdByKey, notes, spaces, search };
}

let harness: Harness;

/** Run one fixture query through the same path the palette uses. */
async function rank(query: string): Promise<string[]> {
  const hits = await searchNotes(harness.search, embedder, query);
  const keyById = new Map(
    [...harness.noteIdByKey].map(([key, id]) => [id, key]),
  );
  return rankSearchResults({
    query,
    hits,
    notes: harness.notes,
    spaces: harness.spaces,
  }).map((result) => keyById.get(result.noteId) ?? result.noteId);
}

function describeFailure(fixture: RelevanceCase, actual: string[]): string {
  return `query "${fixture.query}" — ${fixture.reason}\nranking: ${
    actual.join(", ") || "(empty)"
  }`;
}

describe("search relevance fixtures", () => {
  beforeAll(async () => {
    harness = await buildHarness();
  });

  it.each(RELEVANCE_CASES.map((c) => [c.query, c] as const))(
    "%s",
    async (_query, fixture) => {
      const ranking = await rank(fixture.query);
      const context = describeFailure(fixture, ranking);
      const top3 = ranking.slice(0, 3);

      if (fixture.first !== undefined) {
        expect(ranking[0], context).toBe(fixture.first);
      }
      for (const key of fixture.expectedTop ?? []) {
        expect(top3, context).toContain(key);
      }
      for (const key of fixture.expectedAll ?? []) {
        expect(ranking, context).toContain(key);
      }
      for (const key of fixture.excluded ?? []) {
        expect(ranking, context).not.toContain(key);
      }
      for (const key of fixture.rankedBelow ?? []) {
        const position = ranking.indexOf(key);
        if (position === -1) continue;
        for (const better of fixture.expectedTop ?? []) {
          expect(position, context).toBeGreaterThan(ranking.indexOf(better));
        }
      }
      if (fixture.maxResults !== undefined) {
        expect(ranking.length, context).toBeLessThanOrEqual(
          fixture.maxResults,
        );
      }
    },
  );

  it("retrieves a title-only word from the index alone", async () => {
    // Without the palette's title bonus: "chermoula" and "tiradito" appear in
    // no body anywhere in the corpus, so this passes only if titles are
    // actually indexed.
    for (const key of ["chermoula", "tiradito"]) {
      const hits = await searchNotes(harness.search, embedder, key);
      expect(hits.map((h) => h.noteId), key).toContain(
        harness.noteIdByKey.get(key),
      );
    }
  });

  it("answers a title query before a single vector exists", async () => {
    // A fresh vault has no index; the merged ranking still has the note list.
    const ranked = rankSearchResults({
      query: "chermoula",
      hits: [],
      notes: harness.notes,
      spaces: harness.spaces,
    });
    expect(ranked[0]?.noteId).toBe(harness.noteIdByKey.get("chermoula"));
  });
});
