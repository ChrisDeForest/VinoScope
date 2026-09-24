import { describe, it, expect } from "vitest";
import { FOOD_OPTIONS, FOOD_PAIRINGS } from "./foodPairings";

const DIMENSIONS = ["sweetness", "acidity", "tannin", "body", "fruitiness"] as const;

describe("foodPairings", () => {
  it("has a FOOD_PAIRINGS entry for every FOOD_OPTIONS key", () => {
    for (const food of FOOD_OPTIONS) {
      expect(FOOD_PAIRINGS[food]).toBeDefined();
    }
  });

  it("has a non-empty label and blurb for every food", () => {
    for (const food of FOOD_OPTIONS) {
      expect(FOOD_PAIRINGS[food].label.length).toBeGreaterThan(0);
      expect(FOOD_PAIRINGS[food].blurb.length).toBeGreaterThan(0);
    }
  });

  it("every vector dimension has at least one level, each within 1-5", () => {
    for (const food of FOOD_OPTIONS) {
      const { vector } = FOOD_PAIRINGS[food];
      for (const dimension of DIMENSIONS) {
        expect(vector[dimension].length).toBeGreaterThan(0);
        for (const level of vector[dimension]) {
          expect(level).toBeGreaterThanOrEqual(1);
          expect(level).toBeLessThanOrEqual(5);
        }
      }
    }
  });

  it("has the documented vector for Steak", () => {
    expect(FOOD_PAIRINGS.steak.vector).toEqual({
      sweetness: [1],
      acidity: [3, 4],
      tannin: [4, 5],
      body: [4, 5],
      fruitiness: [3, 4],
    });
  });
});
