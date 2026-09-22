import { describe, it, expect } from "vitest";
import { DEFAULT_FILTERS, countActiveFilters, filtersToApiParams } from "./filterTypes";

describe("countActiveFilters", () => {
  it("returns 0 for default filters", () => {
    expect(countActiveFilters(DEFAULT_FILTERS)).toBe(0);
  });

  it("counts each non-empty filter field", () => {
    expect(countActiveFilters({ ...DEFAULT_FILTERS, type: "red", country: "France", minPrice: "10" })).toBe(3);
  });
});

describe("filtersToApiParams", () => {
  it("omits empty fields and includes limit/offset/sort", () => {
    const params = filtersToApiParams(DEFAULT_FILTERS, 12, 0);
    expect(params).toEqual({ limit: 12, offset: 0, sort: "winery" });
  });

  it("includes provided fields and parses price strings to numbers", () => {
    const params = filtersToApiParams(
      { ...DEFAULT_FILTERS, q: "caymus", type: "red", minPrice: "10", maxPrice: "50" },
      12,
      24
    );
    expect(params).toEqual({
      limit: 12,
      offset: 24,
      sort: "winery",
      q: "caymus",
      type: "red",
      min_price: 10,
      max_price: 50,
    });
  });
});
