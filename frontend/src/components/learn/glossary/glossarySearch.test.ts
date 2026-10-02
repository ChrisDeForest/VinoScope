import { describe, it, expect } from "vitest";
import type { GlossaryTerm } from "../../../content/learn/glossary";
import { GLOSSARY_TERMS } from "../../../content/learn/glossary";
import { filterTerms, normalize } from "./glossarySearch";

const t = (id: string, term: string, category: GlossaryTerm["category"], definition: string): GlossaryTerm => ({
  id,
  term,
  category,
  definition,
  source: "general",
});

const TERMS = [
  t("tannin", "Tannin", "tasting", "Grips your gums like black tea."),
  t("acidity", "Acidity", "tasting", "Makes your mouth water."),
  t("lees", "Lees", "winemaking", 'Spent yeast; aged "sur lie" for a creamy feel.'),
  t("semillon", "Sémillon", "vineyard", "A golden grape."),
];

const ids = (terms: readonly GlossaryTerm[]) => terms.map((term) => term.id);

describe("normalize", () => {
  it("lowercases, trims and strips accents", () => {
    expect(normalize("  Sémillon ")).toBe("semillon");
    expect(normalize("ROSÉ")).toBe("rose");
  });
});

describe("filterTerms", () => {
  it("returns everything A–Z for an empty query and all categories", () => {
    expect(ids(filterTerms(TERMS, "", "all"))).toEqual(["acidity", "lees", "semillon", "tannin"]);
    expect(ids(filterTerms(TERMS, "   ", "all"))).toHaveLength(4);
  });

  it("matches the term case-insensitively", () => {
    expect(ids(filterTerms(TERMS, "TANN", "all"))).toEqual(["tannin"]);
  });

  it("ignores accents both ways", () => {
    expect(ids(filterTerms(TERMS, "semillon", "all"))).toEqual(["semillon"]);
    expect(ids(filterTerms(TERMS, "Tännin", "all"))).toEqual(["tannin"]);
  });

  it("matches inside definitions", () => {
    expect(ids(filterTerms(TERMS, "black tea", "all"))).toEqual(["tannin"]);
    expect(ids(filterTerms(TERMS, "sur lie", "all"))).toEqual(["lees"]);
  });

  it("filters by category, alone and with a query", () => {
    expect(ids(filterTerms(TERMS, "", "tasting"))).toEqual(["acidity", "tannin"]);
    expect(ids(filterTerms(TERMS, "water", "tasting"))).toEqual(["acidity"]);
    expect(ids(filterTerms(TERMS, "water", "winemaking"))).toEqual([]);
  });

  it("does not mutate its input", () => {
    const before = ids(TERMS);
    filterTerms(TERMS, "", "all");
    expect(ids(TERMS)).toEqual(before);
  });

  it("sorts the real glossary alphabetically", () => {
    const names = filterTerms(GLOSSARY_TERMS, "", "all").map((term) => term.term);
    expect(names[0]).toBe("Acidity");
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })));
  });
});
