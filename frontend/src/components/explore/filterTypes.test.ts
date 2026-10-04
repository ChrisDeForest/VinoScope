import { describe, it, expect } from "vitest";
import {
  DEFAULT_FILTERS,
  FILTER_PARAM_NAMES,
  countActiveFilters,
  filtersFromSearchParams,
  filtersToApiParams,
  filtersToSearchParams,
} from "./filterTypes";

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

describe("region filter", () => {
  it("defaults to empty and counts as an active filter when set", () => {
    expect(DEFAULT_FILTERS.region).toBe("");
    expect(countActiveFilters({ ...DEFAULT_FILTERS, region: "Bordeaux" })).toBe(1);
  });

  it("round-trips through the URL", () => {
    const params = filtersToSearchParams({ ...DEFAULT_FILTERS, region: "Castilla y Leon" });
    expect(params.get("region")).toBe("Castilla y Leon");
    expect(filtersFromSearchParams(params).region).toBe("Castilla y Leon");
    expect(FILTER_PARAM_NAMES).toContain("region");
  });

  it("is sent to the API only when set", () => {
    expect(filtersToApiParams({ ...DEFAULT_FILTERS, region: "Bordeaux" }, 12, 0)).toMatchObject({ region: "Bordeaux" });
    expect(filtersToApiParams(DEFAULT_FILTERS, 12, 0)).not.toHaveProperty("region");
  });
});
