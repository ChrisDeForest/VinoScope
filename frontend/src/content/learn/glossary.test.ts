import { describe, it, expect } from "vitest";
import { DIMENSIONS } from "../../utils/dimensionLabels";
import { GRAPES, GRAPES_CHAPTER } from "./grapes";
import { TASTE_CHAPTER } from "./taste";
import { VINE_CHAPTER, VINE_STAGES } from "./vine";
import { GLOSSARY_CATEGORIES, GLOSSARY_CATEGORY_LABELS, GLOSSARY_CHAPTER, GLOSSARY_TERMS, termById } from "./glossary";

// Every element id the Learn page renders that a "See it in" link may target.
const LEARN_ANCHORS = new Set<string>([
  TASTE_CHAPTER.id,
  VINE_CHAPTER.id,
  GRAPES_CHAPTER.id,
  ...DIMENSIONS.map((dimension) => `taste-${dimension}-title`),
  ...VINE_STAGES.map((stage) => `vine-${stage.id}-title`),
  ...GRAPES.map((grape) => `grape-${grape.id}`),
]);

describe("Glossary content", () => {
  it("has chapter strings", () => {
    expect(GLOSSARY_CHAPTER.id).toBe("glossary");
    expect(GLOSSARY_CHAPTER.label).toBe("Glossary");
    expect(GLOSSARY_CHAPTER.title).toBe("Words to know");
    expect(GLOSSARY_CHAPTER.lead.trim()).not.toBe("");
  });

  it("has five labelled categories in order", () => {
    expect(GLOSSARY_CATEGORIES).toEqual(["tasting", "winemaking", "vineyard", "label", "serving"]);
    expect(GLOSSARY_CATEGORIES.map((category) => GLOSSARY_CATEGORY_LABELS[category])).toEqual([
      "Tasting",
      "Winemaking",
      "Vineyard",
      "Label & Law",
      "Serving",
    ]);
  });

  it("has 43 terms with unique, URL-safe ids", () => {
    expect(GLOSSARY_TERMS).toHaveLength(43);
    const ids = GLOSSARY_TERMS.map((term) => term.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it("has terms in every category", () => {
    const counts = Object.fromEntries(
      GLOSSARY_CATEGORIES.map((category) => [category, GLOSSARY_TERMS.filter((term) => term.category === category).length])
    );
    expect(counts).toEqual({ tasting: 11, winemaking: 10, vineyard: 8, label: 8, serving: 6 });
  });

  it.each(GLOSSARY_TERMS.map((term) => [term.id, term] as const))("%s has copy and a source", (_id, term) => {
    expect(term.term.trim()).not.toBe("");
    expect(term.definition.trim()).not.toBe("");
    expect(GLOSSARY_CATEGORIES).toContain(term.category);
    expect(["general", "course"]).toContain(term.source);
  });

  it.each(GLOSSARY_TERMS.filter((term) => term.related).map((term) => [term.id, term] as const))(
    "%s relates to 1–3 other real terms",
    (_id, term) => {
      const related = term.related!;
      expect(related.length).toBeGreaterThanOrEqual(1);
      expect(related.length).toBeLessThanOrEqual(3);
      expect(new Set(related).size).toBe(related.length);
      for (const id of related) {
        expect(id).not.toBe(term.id);
        expect(termById(id), `${term.id} → ${id}`).toBeDefined();
      }
    }
  );

  it.each(
    GLOSSARY_TERMS.flatMap((term) => (term.seeAlso?.kind === "learn" ? [[term.id, term.seeAlso.anchor] as const] : []))
  )("%s links to a Learn anchor that exists (%s)", (_id, anchor) => {
    expect(LEARN_ANCHORS.has(anchor)).toBe(true);
  });

  it("every see-also link has a label and explore links have a filter", () => {
    for (const term of GLOSSARY_TERMS) {
      if (!term.seeAlso) continue;
      expect(term.seeAlso.label.trim()).not.toBe("");
      if (term.seeAlso.kind === "explore") expect(Object.keys(term.seeAlso.params).length).toBeGreaterThan(0);
    }
  });

  it("wires the spec's key links", () => {
    expect(termById("tannin")!.seeAlso).toEqual({ kind: "learn", anchor: "taste-tannin-title", label: "See it in How to Taste" });
    expect(termById("malolactic")!.seeAlso).toMatchObject({ kind: "learn", anchor: "vine-ferment-title" });
    expect(termById("varietal")!.seeAlso).toMatchObject({ kind: "learn", anchor: "grapes", label: "See it in Key Grapes" });
    expect(termById("fortified")!.seeAlso).toEqual({ kind: "explore", params: { type: "fortified" }, label: "Browse fortified wines" });
    expect(termById("new-world")!.seeAlso).toMatchObject({ kind: "explore", params: { country: "United States" } });
    expect(termById("noble-rot")!.seeAlso).toMatchObject({ params: { type: "dessert" } });
  });

  it("keeps the Bordeaux caveat on Grand Cru / Premier Cru", () => {
    expect(termById("cru")!.definition).toMatch(/Bordeaux/);
  });

  it("does not promise a Vine to Glass view for sulfites or serving temperature", () => {
    expect(termById("sulfites")!.seeAlso).toBeUndefined();
    expect(termById("serving-temperature")!.seeAlso).toBeUndefined();
  });

  it("looks terms up by id", () => {
    expect(termById("tannin")!.term).toBe("Tannin");
    expect(termById("nope")).toBeUndefined();
  });
});
