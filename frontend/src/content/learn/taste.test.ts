import { describe, it, expect } from "vitest";
import { DIMENSIONS } from "../../utils/dimensionLabels";
import { TASTE_CHAPTER, TASTE_DIMENSIONS } from "./taste";

describe("How to Taste content", () => {
  it("has chapter strings", () => {
    expect(TASTE_CHAPTER.id).toBe("taste");
    expect(TASTE_CHAPTER.label).toBe("How to Taste");
    expect(TASTE_CHAPTER.title).toBe("Five things your mouth is measuring");
    expect(TASTE_CHAPTER.lead.length).toBeGreaterThan(0);
  });

  it("covers every dimension once, in DIMENSIONS order", () => {
    expect(TASTE_DIMENSIONS.map((entry) => entry.dimension)).toEqual([...DIMENSIONS]);
  });

  it.each(TASTE_DIMENSIONS.map((entry) => [entry.dimension, entry] as const))(
    "%s has copy, a low/high pair, and a source",
    (_dimension, entry) => {
      for (const text of [entry.what, entry.feel, entry.tip, entry.low.reason, entry.high.reason]) {
        expect(text.trim().length).toBeGreaterThan(0);
      }
      for (const pick of [entry.low, entry.high]) {
        expect(pick.winery.trim()).not.toBe("");
        expect(pick.name.trim()).not.toBe("");
      }
      expect(["general", "course"]).toContain(entry.source);
    }
  );

  it("never reuses a wine across pairs", () => {
    const keys = TASTE_DIMENSIONS.flatMap((entry) => [entry.low, entry.high]).map(
      (pick) => `${pick.winery}|${pick.name}|${pick.vintage}`
    );
    expect(new Set(keys).size).toBe(keys.length);
  });
});
