import { describe, it, expect } from "vitest";
import {
  applyRelativeCutoff,
  fuseRankings,
  rankNotes,
  RELEVANCE_BONUS,
  spaceSignal,
  titleBonus,
  type ContentHit,
  type RankableNote,
} from "../search/rank";

describe("fuseRankings", () => {
  it("rewards agreement between the two rankings", () => {
    const fused = fuseRankings([
      ["a", "b"],
      ["b", "c"],
    ]);
    expect(fused[0]?.id).toBe("b");
  });

  it("normalises the best score to 1", () => {
    const fused = fuseRankings([["a", "b"]]);
    expect(fused[0]?.score).toBe(1);
    expect(fused[1]?.score).toBeLessThan(1);
  });

  it("keeps a document that only one ranking found", () => {
    const ids = fuseRankings([["a"], ["b"]]).map((f) => f.id);
    expect(ids.sort()).toEqual(["a", "b"]);
  });

  it("resolves ties to the ranking passed first", () => {
    // Callers depend on this to prefer a literal match over a vector one.
    expect(
      fuseRankings([
        ["a", "b"],
        ["b", "a"],
      ])[0]?.id,
    ).toBe("a");
    expect(
      fuseRankings([
        ["b", "a"],
        ["a", "b"],
      ])[0]?.id,
    ).toBe("b");
  });

  it("returns nothing for empty input", () => {
    expect(fuseRankings([])).toEqual([]);
    expect(fuseRankings([[], []])).toEqual([]);
  });
});

describe("applyRelativeCutoff", () => {
  it("drops hits that are not competitive with the best one", () => {
    const kept = applyRelativeCutoff(
      [{ score: 1 }, { score: 0.7 }, { score: 0.2 }],
      { ratio: 0.6 },
    );
    expect(kept).toEqual([{ score: 1 }, { score: 0.7 }]);
  });

  it("measures the ratio from the floor, not from zero", () => {
    // A compressed band (an E5-style model): from zero everything survives,
    // from the floor only the genuinely close hit does.
    const band = [{ score: 0.9 }, { score: 0.78 }];
    expect(applyRelativeCutoff(band, { ratio: 0.6 })).toHaveLength(2);
    expect(applyRelativeCutoff(band, { ratio: 0.6, floor: 0.75 })).toEqual([
      { score: 0.9 },
    ]);
  });

  it("keeps everything when the ratio is zero or the scores are flat", () => {
    const flat = [{ score: 0.5 }, { score: 0.5 }];
    expect(applyRelativeCutoff(flat, { ratio: 0.6 })).toHaveLength(2);
    expect(applyRelativeCutoff(flat, { ratio: 0 })).toHaveLength(2);
    expect(applyRelativeCutoff([], { ratio: 0.6 })).toEqual([]);
  });
});

describe("titleBonus", () => {
  it("ranks exact, prefix, substring and term-set matches in that order", () => {
    expect(titleBonus("Tiradito de pescado", "Tiradito de pescado")).toBe(
      RELEVANCE_BONUS.exactTitle,
    );
    expect(titleBonus("tiradito", "Tiradito de pescado")).toBe(
      RELEVANCE_BONUS.titleStartsWith,
    );
    expect(titleBonus("pescado", "Tiradito de pescado")).toBe(
      RELEVANCE_BONUS.titleContains,
    );
    expect(titleBonus("pescado tiradito", "Tiradito de pescado")).toBe(
      RELEVANCE_BONUS.titleTerms,
    );
  });

  it("ignores accents, case and surrounding whitespace", () => {
    expect(titleBonus("  LIMON ", "Limonada de menta")).toBe(
      RELEVANCE_BONUS.titleStartsWith,
    );
    expect(titleBonus("japon", "Presupuesto del viaje a Japón")).toBe(
      RELEVANCE_BONUS.titleContains,
    );
  });

  it("gives nothing to an unrelated or empty title", () => {
    expect(titleBonus("pescado", "Raita de pepino")).toBe(0);
    expect(titleBonus("pescado", "")).toBe(0);
    expect(titleBonus("", "Raita de pepino")).toBe(0);
  });
});

describe("spaceSignal", () => {
  it("treats a query that is entirely a space name as a concept query", () => {
    expect(spaceSignal("africa", ["África"])).toEqual({
      bonus: RELEVANCE_BONUS.spaceName,
      whole: true,
    });
  });

  it("folds accents and inflection against the space name", () => {
    expect(spaceSignal("viaje", ["Viajes"]).whole).toBe(true);
    expect(spaceSignal("áfrica", ["Africa"]).whole).toBe(true);
  });

  it("reports a partial match when the space explains only part of the query", () => {
    expect(spaceSignal("receta vegetariana", ["Recetas"])).toEqual({
      bonus: RELEVANCE_BONUS.spaceTerm,
      whole: false,
    });
  });

  it("gives nothing when no term names a space", () => {
    expect(spaceSignal("recetas", ["Bitácora"]).bonus).toBe(0);
    expect(spaceSignal("recetas", []).bonus).toBe(0);
  });
});

describe("rankNotes", () => {
  const notes: RankableNote[] = [
    { id: "tiradito", title: "Tiradito de pescado" },
    { id: "chermoula", title: "Chermoula para pescado" },
    { id: "raita", title: "Raita de pepino", spaceNames: ["Recetas"] },
  ];


  it("puts title matches above comparable cosine scores", () => {
    const content: ContentHit[] = [
      { noteId: "raita", score: 1, matchKind: "semantic" },
      { noteId: "tiradito", score: 0.9, matchKind: "semantic" },
    ];
    const ranked = rankNotes({ query: "pescado", content, notes });
    expect(ranked.map((r) => r.noteId)).toEqual([
      "tiradito",
      "raita",
      "chermoula",
    ]);
    expect(ranked[0]?.matchKind).toBe("title");
  });

  it("lets a top content score outrank a bare substring title match", () => {
    // The deliberate shape of the formula: a substring in the title is worth
    // half a point, not a veto. Only an exact title match is a veto — see the
    // case below. If this ever reads as wrong in practice, the fixture set in
    // relevance.test.ts is where the argument gets settled.
    const content: ContentHit[] = [
      { noteId: "raita", score: 1, matchKind: "semantic" },
      { noteId: "tiradito", score: 0.4, matchKind: "semantic" },
    ];
    const ranked = rankNotes({ query: "pescado", content, notes });
    expect(ranked[0]?.noteId).toBe("raita");
  });

  it("surfaces a title match the index never returned", () => {
    const ranked = rankNotes({ query: "chermoula", content: [], notes });
    expect(ranked.map((r) => r.noteId)).toEqual(["chermoula"]);
  });

  it("makes an exact title match unbeatable by a perfect content score", () => {
    const content: ContentHit[] = [
      { noteId: "raita", score: 1, matchKind: "semantic" },
    ];
    const ranked = rankNotes({
      query: "Tiradito de pescado",
      content,
      notes,
    });
    expect(ranked[0]?.noteId).toBe("tiradito");
  });

  it("keeps one row per note, using its best content score", () => {
    const content: ContentHit[] = [
      { noteId: "raita", score: 0.9, matchKind: "semantic" },
      { noteId: "raita", score: 0.4, matchKind: "semantic" },
    ];
    const ranked = rankNotes({ query: "pepino", content, notes });
    expect(ranked.filter((r) => r.noteId === "raita")).toHaveLength(1);
  });

  it("adds the space bonus on top of the content score", () => {
    const content: ContentHit[] = [
      { noteId: "raita", score: 0.5, matchKind: "semantic" },
    ];
    const [ranked] = rankNotes({ query: "recetas", content, notes });
    expect(ranked?.score).toBeCloseTo(0.5 + RELEVANCE_BONUS.spaceName);
    expect(ranked?.matchKind).toBe("space");
  });

  it("surfaces a whole space for a pure concept query", () => {
    const ranked = rankNotes({ query: "recetas", content: [], notes });
    expect(ranked.map((r) => r.noteId)).toEqual(["raita"]);
    expect(ranked[0]?.matchKind).toBe("space");
  });

  it("does not conjure a space into the list when it explains half the query", () => {
    // "recetas" names the space, "pescado" selects inside it. `raita` is filed
    // in Recetas but is not about fish: filing alone must not surface it, or
    // every recipe in the vault would answer the word "receta".
    const content: ContentHit[] = [
      { noteId: "tiradito", score: 0.9, matchKind: "text" },
    ];
    const ranked = rankNotes({ query: "recetas pescado", content, notes });
    expect(ranked.map((r) => r.noteId)).toEqual(["tiradito"]);
  });

  it("still reorders content hits on a partial space match", () => {
    const content: ContentHit[] = [
      { noteId: "raita", score: 0.5, matchKind: "semantic" },
    ];
    const [ranked] = rankNotes({ query: "recetas pepino", content, notes });
    expect(ranked?.score).toBeCloseTo(0.5 + RELEVANCE_BONUS.spaceTerm);
  });

  it("preserves content order when scores tie", () => {
    const content: ContentHit[] = [
      { noteId: "chermoula", score: 0.5, matchKind: "semantic" },
      { noteId: "raita", score: 0.5, matchKind: "semantic" },
    ];
    const ranked = rankNotes({ query: "algo", content, notes });
    expect(ranked.map((r) => r.noteId)).toEqual(["chermoula", "raita"]);
  });

  it("returns nothing for a blank query and honours the limit", () => {
    expect(rankNotes({ query: "  ", content: [], notes })).toEqual([]);
    expect(
      rankNotes({ query: "pescado", content: [], notes, limit: 1 }),
    ).toHaveLength(1);
  });
});
