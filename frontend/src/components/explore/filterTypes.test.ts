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

describe("ABV, vintage and taste filters", () => {
  const full = {
    ...DEFAULT_FILTERS,
    minAbv: "12",
    maxAbv: "14.5",
    vintageFrom: "2019",
    vintageTo: "2022",
    excludeNv: "1",
    sweetness: "2-4",
    tannin: "3",
  };

  it("default to empty", () => {
    for (const key of ["minAbv", "maxAbv", "vintageFrom", "vintageTo", "excludeNv", "sweetness", "acidity", "tannin", "body", "fruitiness"] as const) {
      expect(DEFAULT_FILTERS[key]).toBe("");
    }
  });

  it("count once each", () => {
    expect(countActiveFilters(full)).toBe(7);
  });

  it("round-trip through the URL with snake_case names", () => {
    const params = filtersToSearchParams(full);
    expect(params.toString()).toBe(
      "min_abv=12&max_abv=14.5&vintage_from=2019&vintage_to=2022&exclude_nv=1&sweetness=2-4&tannin=3"
    );
    expect(filtersFromSearchParams(params)).toEqual(full);
    for (const name of ["min_abv", "max_abv", "vintage_from", "vintage_to", "exclude_nv", "sweetness", "fruitiness"]) {
      expect(FILTER_PARAM_NAMES).toContain(name);
    }
  });

  it("drop junk from hand-edited links", () => {
    const filters = filtersFromSearchParams(
      new URLSearchParams("sweetness=9&acidity=4-2&min_abv=abc&vintage_to=soon&exclude_nv=yes&min_price=x")
    );
    expect(filters).toEqual(DEFAULT_FILTERS);
  });

  it("drops values the API would reject with a 422", () => {
    const filters = filtersFromSearchParams(
      new URLSearchParams("min_abv=-1&max_abv=-2&min_price=-5&max_price=-1&vintage_from=2019.5&vintage_to=2020.1")
    );
    expect(filters).toEqual(DEFAULT_FILTERS);
    expect(filtersFromSearchParams(new URLSearchParams("min_abv=0&min_price=12.5&vintage_from=2019"))).toMatchObject({
      minAbv: "0",
      minPrice: "12.5",
      vintageFrom: "2019",
    });
  });

  it("map to API params", () => {
    expect(filtersToApiParams(full, 12, 0)).toMatchObject({
      min_abv: 12,
      max_abv: 14.5,
      vintage_from: 2019,
      vintage_to: 2022,
      include_nv: false,
      min_sweetness: 2,
      max_sweetness: 4,
      min_tannin: 3,
      max_tannin: 3,
    });
    const plain = filtersToApiParams(DEFAULT_FILTERS, 12, 0);
    for (const key of ["include_nv", "min_abv", "vintage_from", "min_sweetness", "max_body"]) expect(plain).not.toHaveProperty(key);
  });
});
