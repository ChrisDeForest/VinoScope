import { describe, it, expect } from "vitest";
import { DIMENSIONS } from "../../utils/dimensionLabels";
import { DEFAULT_GRAPE_ID, GRAPES, GRAPES_CHAPTER } from "./grapes";

describe("Key Grapes content", () => {
  it("has chapter strings", () => {
    expect(GRAPES_CHAPTER.id).toBe("grapes");
    expect(GRAPES_CHAPTER.label).toBe("Key Grapes");
    expect(GRAPES_CHAPTER.title).toBe("Seven grapes to know");
    expect(GRAPES_CHAPTER.lead.trim()).not.toBe("");
  });

  it("lists the classic seven, reds then whites", () => {
    expect(GRAPES.map((grape) => grape.id)).toEqual([
      "cabernet-sauvignon",
      "merlot",
      "pinot-noir",
      "syrah",
      "chardonnay",
      "sauvignon-blanc",
      "riesling",
    ]);
    expect(GRAPES.map((grape) => grape.color)).toEqual(["red", "red", "red", "red", "white", "white", "white"]);
    expect(GRAPES[0].id).toBe(DEFAULT_GRAPE_ID);
  });

  it("uses unique, URL-safe slugs", () => {
    const ids = GRAPES.map((grape) => grape.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it.each(GRAPES.map((grape) => [grape.id, grape] as const))("%s has copy, notes, regions and a source", (_id, grape) => {
    for (const text of [grape.name, grape.exploreGrape, grape.tagline, grape.about]) expect(text.trim()).not.toBe("");
    expect(grape.notes.length).toBeGreaterThanOrEqual(3);
    expect(grape.notes.length).toBeLessThanOrEqual(5);
    expect(grape.regions.length).toBeGreaterThanOrEqual(3);
    expect(grape.regions.length).toBeLessThanOrEqual(4);
    expect(["general", "course"]).toContain(grape.source);
  });

  it.each(GRAPES.map((grape) => [grape.id, grape] as const))("%s has a valid profile on all five scales", (_id, grape) => {
    expect(Object.keys(grape.profile).sort()).toEqual([...DIMENSIONS].sort());
    for (const value of Object.values(grape.profile)) {
      const [lo, hi] = typeof value === "number" ? [value, value] : value;
      for (const n of [lo, hi]) {
        expect(Number.isInteger(n)).toBe(true);
        expect(n).toBeGreaterThanOrEqual(1);
        expect(n).toBeLessThanOrEqual(5);
      }
      expect(lo).toBeLessThanOrEqual(hi);
    }
  });

  it("uses ranges where the grape spans the scale", () => {
    expect(GRAPES.find((grape) => grape.id === "riesling")!.profile.sweetness).toEqual([1, 5]);
    expect(GRAPES.find((grape) => grape.id === "chardonnay")!.profile.body).toEqual([2, 4]);
    expect(GRAPES.find((grape) => grape.id === "chardonnay")!.profile.acidity).toEqual([3, 4]);
    expect(GRAPES.find((grape) => grape.id === "syrah")!.profile.body).toEqual([4, 5]);
  });

  it("refines the wine facts", () => {
    const byId = (id: string) => GRAPES.find((grape) => grape.id === id)!;
    expect(byId("cabernet-sauvignon").profile.acidity).toBe(4);
    expect(byId("chardonnay").about).toContain("malolactic");
    expect(byId("sauvignon-blanc").regions).toContain("Bordeaux (blended with Sémillon)");
    expect(byId("syrah").exploreLabel).toBe("Syrah");
  });
});
