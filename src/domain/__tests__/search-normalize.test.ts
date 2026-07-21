import { describe, it, expect } from "vitest";
import {
  foldInflection,
  foldSearchText,
  tokenizeSearchText,
} from "../search/normalize";

describe("foldSearchText", () => {
  it("folds case and Spanish accents", () => {
    expect(foldSearchText("Limón")).toBe("limon");
    expect(foldSearchText("JAPÓN")).toBe("japon");
    expect(foldSearchText("Reunión")).toBe("reunion");
  });

  it("folds the tilde on ñ, so the query and the note agree", () => {
    expect(foldSearchText("Año")).toBe(foldSearchText("ano"));
  });

  it("leaves unaccented text untouched apart from case", () => {
    expect(foldSearchText("Pescado")).toBe("pescado");
  });
});

describe("foldInflection", () => {
  it("folds number and gender so a query and a note agree", () => {
    expect(foldInflection("vegetariana")).toBe(foldInflection("vegetariano"));
    expect(foldInflection("viajes")).toBe(foldInflection("viaje"));
    expect(foldInflection("recetas")).toBe(foldInflection("receta"));
    expect(foldInflection("garbanzos")).toBe(foldInflection("garbanzo"));
  });

  it("leaves short words alone, where the final vowel is part of the root", () => {
    // Trimming these would merge casa/caso and masa/mas.
    expect(foldInflection("casa")).toBe("casa");
    expect(foldInflection("caso")).toBe("caso");
    expect(foldInflection("masa")).toBe("masa");
    expect(foldInflection("mes")).toBe("mes");
  });

  it("does not merge derivations — that needs a real stemmer", () => {
    expect(foldInflection("trimestral")).not.toBe(foldInflection("trimestre"));
  });

  it("leaves digits and consonant endings untouched", () => {
    expect(foldInflection("2026")).toBe("2026");
    expect(foldInflection("japon")).toBe("japon");
    expect(foldInflection("falafel")).toBe("falafel");
  });
});

describe("tokenizeSearchText", () => {
  it("splits on punctuation, keeps digits and folds inflection", () => {
    expect(tokenizeSearchText("Reunión: 5 de marzo, 2026")).toEqual([
      "reunion",
      "5",
      "de",
      "marz",
      "2026",
    ]);
  });

  it("returns an empty list for punctuation-only input", () => {
    expect(tokenizeSearchText("—…!")).toEqual([]);
  });
});
