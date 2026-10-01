import { describe, it, expect } from "vitest";
import { TASTE_DIMENSIONS, type WinePick } from "./taste";
import { DATASET_ROWS as rows } from "../../test/dataset";

function findRow(pick: WinePick) {
  const vintage = pick.vintage === null ? "" : String(pick.vintage);
  return rows.find((row) => row.winery === pick.winery && row.name === pick.name && row.vintage === vintage);
}

describe("How to Taste picks against the dataset", () => {
  it("parsed the dataset", () => {
    expect(rows.length).toBeGreaterThanOrEqual(200);
  });

  it.each(TASTE_DIMENSIONS.map((entry) => [entry.dimension, entry] as const))(
    "%s: both picks exist and high beats low by at least 2",
    (dimension, entry) => {
      const low = findRow(entry.low);
      const high = findRow(entry.high);
      expect(low, `low pick not found: ${entry.low.name}`).toBeDefined();
      expect(high, `high pick not found: ${entry.high.name}`).toBeDefined();
      expect(Number(high![dimension]) - Number(low![dimension])).toBeGreaterThanOrEqual(2);
    }
  );
});
