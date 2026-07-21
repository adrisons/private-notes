import { describe, it, expect } from "vitest";
import {
  buildLexicalIndex,
  searchLexicalIndex,
  type LexicalDocument,
} from "../search/lexical-index";

const docs: LexicalDocument[] = [
  {
    id: "tiradito",
    title: "Tiradito de pescado",
    body: "Corta el lomo en láminas finas y sirve con leche de tigre.",
  },
  {
    id: "ceviche",
    title: "Ceviche clásico",
    body: "Dados de pescado blanco con lima, cebolla morada y cilantro.",
  },
  {
    id: "carbonara",
    title: "Pasta a la carbonara",
    body: "Guanciale, huevo y pecorino. Nunca lleva nata.",
  },
];

const index = buildLexicalIndex(docs);

describe("searchLexicalIndex", () => {
  it("returns only documents containing a query term", () => {
    const ids = searchLexicalIndex(index, "pescado").map((m) => m.id);
    expect(ids.sort()).toEqual(["ceviche", "tiradito"]);
  });

  it("weighs a title occurrence above a body occurrence", () => {
    const [best] = searchLexicalIndex(index, "pescado");
    expect(best?.id).toBe("tiradito");
    expect(best?.inTitle).toBe(true);
  });

  it("matches across accents and case", () => {
    const ids = searchLexicalIndex(index, "CLÁSICO").map((m) => m.id);
    expect(ids).toEqual(["ceviche"]);
    expect(searchLexicalIndex(index, "clasico").map((m) => m.id)).toEqual([
      "ceviche",
    ]);
  });

  it("matches prefixes so results appear mid-word", () => {
    expect(searchLexicalIndex(index, "pesca").map((m) => m.id).sort()).toEqual([
      "ceviche",
      "tiradito",
    ]);
  });

  it("expands a prefix to exactly the terms it prefixes, not its neighbours", () => {
    // "cor", "corta", "corte", "coste" sort adjacently; only the first three
    // share the "cort" prefix. A binary-search expansion must stop at the
    // block boundary and not spill into "coste".
    const adjacent = buildLexicalIndex([
      { id: "corta", title: "Corta", body: "" },
      { id: "corte", title: "Corte", body: "" },
      { id: "coste", title: "Coste", body: "" },
    ]);
    expect(
      searchLexicalIndex(adjacent, "cort").map((m) => m.id).sort(),
    ).toEqual(["corta", "corte"]);
  });

  it("ignores prefixes shorter than three characters", () => {
    expect(searchLexicalIndex(index, "pe")).toEqual([]);
  });

  it("ranks a document carrying every query term above one carrying a single term", () => {
    const ids = searchLexicalIndex(index, "pescado blanco").map((m) => m.id);
    expect(ids[0]).toBe("ceviche");
  });

  it("beats a title repetition when the other document covers the whole query", () => {
    // `pasta` sits in carbonara's title (weighted x3) and in ceviche's body
    // only — but ceviche carries both query terms, and coverage decides.
    const withPasta = buildLexicalIndex([
      ...docs,
      { id: "otro", title: "Pasta", body: "Solo pasta." },
    ]);
    const ids = searchLexicalIndex(withPasta, "pasta cilantro").map((m) => m.id);
    expect(ids[0]).toBe("ceviche");
  });

  it("weighs coverage by idf, so a missing common word barely counts", () => {
    // "de" is in every document, so failing to match it must not sink a
    // document that carries the rare term.
    const ids = searchLexicalIndex(index, "carbonara de").map((m) => m.id);
    expect(ids[0]).toBe("carbonara");
  });

  it("folds inflection between the query and the document", () => {
    const inflected = buildLexicalIndex([
      { id: "tagine", title: "Tagine", body: "Guiso vegetariano con verduras." },
    ]);
    expect(searchLexicalIndex(inflected, "vegetariana").map((m) => m.id)).toEqual(
      ["tagine"],
    );
  });

  it("returns nothing for an unknown term or an empty query", () => {
    expect(searchLexicalIndex(index, "rocket")).toEqual([]);
    expect(searchLexicalIndex(index, "   ")).toEqual([]);
  });

  it("honours the limit", () => {
    expect(searchLexicalIndex(index, "de", { limit: 1 })).toHaveLength(1);
  });

  it("scores nothing against an empty index", () => {
    expect(searchLexicalIndex(buildLexicalIndex([]), "pescado")).toEqual([]);
  });
});
