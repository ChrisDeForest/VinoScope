import { describe, it, expect } from "vitest";
import { FOOD_OPTIONS, foodImage } from "./foodPairings";

// Non-eager glob: only the matching file names are needed, nothing is imported.
const FOOD_FILES = Object.keys(import.meta.glob("../../public/foods/*.webp"));

describe("food photos", () => {
  it("has a photo for every food", () => {
    for (const food of FOOD_OPTIONS) {
      expect(foodImage(food)).toBe(`/foods/${food}.webp`);
      expect(FOOD_FILES).toContain(`../../public/foods/${food}.webp`);
    }
  });
});
