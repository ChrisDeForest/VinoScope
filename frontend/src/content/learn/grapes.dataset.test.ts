import { describe, it, expect } from "vitest";
import { DATASET_ROWS } from "../../test/dataset";
import { GRAPES } from "./grapes";

// Mirrors Explore's grape filter: a case-insensitive "contains" match against any grape in a wine.
function matches(grapeFilter: string) {
  const needle = grapeFilter.toLowerCase();
  return DATASET_ROWS.filter((row) =>
    row.grape
      .split(";")
      .map((grape) => grape.trim().toLowerCase())
      .some((grape) => grape.includes(needle))
  );
}

describe("Key Grapes against the dataset", () => {
  it.each(GRAPES.map((grape) => [grape.name, grape.exploreGrape] as const))(
    "%s has at least 3 catalog wines for its Explore link",
    (_name, exploreGrape) => {
      expect(matches(exploreGrape).length).toBeGreaterThanOrEqual(3);
    }
  );
});
