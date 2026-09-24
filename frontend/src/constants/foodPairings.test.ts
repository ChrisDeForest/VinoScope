import { describe, it, expect } from "vitest";
import { FOOD_OPTIONS, FOOD_PAIRINGS, type Dimension } from "./foodPairings";

const DIMENSIONS: Dimension[] = ["sweetness", "acidity", "tannin", "body", "fruitiness"];

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

  it("FOOD_OPTIONS has exactly the same foods as FOOD_PAIRINGS, no more or fewer", () => {
    expect(new Set(FOOD_OPTIONS)).toEqual(new Set(Object.keys(FOOD_PAIRINGS)));
    expect(FOOD_OPTIONS.length).toBe(Object.keys(FOOD_PAIRINGS).length);
  });

  it("has the exact documented vector for every food", () => {
    const expected: Record<(typeof FOOD_OPTIONS)[number], { sweetness: number[]; acidity: number[]; tannin: number[]; body: number[]; fruitiness: number[] }> = {
      steak: { sweetness: [1], acidity: [3, 4], tannin: [4, 5], body: [4, 5], fruitiness: [3, 4] },
      burgers: { sweetness: [1, 2], acidity: [3, 4], tannin: [3, 4], body: [3, 4], fruitiness: [3, 4] },
      chicken: { sweetness: [1, 2], acidity: [3, 4], tannin: [1, 2, 3], body: [2, 3, 4], fruitiness: [2, 3, 4] },
      salmon: { sweetness: [1, 2], acidity: [4, 5], tannin: [1, 2], body: [2, 3], fruitiness: [2, 3] },
      shellfish: { sweetness: [1], acidity: [4, 5], tannin: [1], body: [1, 2], fruitiness: [1, 2] },
      tomato_pasta: { sweetness: [1, 2], acidity: [4, 5], tannin: [2, 3, 4], body: [2, 3, 4], fruitiness: [2, 3, 4] },
      cream_pasta: { sweetness: [1, 2], acidity: [2, 3], tannin: [1, 2], body: [3, 4], fruitiness: [2, 3] },
      pizza: { sweetness: [1, 2], acidity: [4, 5], tannin: [2, 3], body: [2, 3], fruitiness: [3, 4] },
      spicy: { sweetness: [2, 3], acidity: [3, 4], tannin: [1, 2], body: [1, 2, 3], fruitiness: [3, 4, 5] },
      soft_cheese: { sweetness: [1, 2], acidity: [4, 5], tannin: [1], body: [1, 2, 3], fruitiness: [2, 3] },
      aged_cheese: { sweetness: [1, 2, 3], acidity: [2, 3], tannin: [3, 4, 5], body: [4, 5], fruitiness: [2, 3, 4] },
      chocolate: { sweetness: [4, 5], acidity: [1, 2], tannin: [2, 3, 4], body: [4, 5], fruitiness: [4, 5] },
      dessert: { sweetness: [4, 5], acidity: [1, 2, 3], tannin: [1, 2], body: [2, 3, 4], fruitiness: [3, 4, 5] },
    };
    for (const food of FOOD_OPTIONS) {
      expect(FOOD_PAIRINGS[food].vector).toEqual(expected[food]);
    }
  });
});
