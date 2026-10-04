import { describe, it, expect } from "vitest";
import { DATASET_ROWS } from "../../test/dataset";
import { MAP_COUNTRIES, MAP_REGIONS, countryById } from "./regions";

describe("Wine Regions against the dataset", () => {
  it.each(MAP_COUNTRIES.map((country) => [country.id, country.exploreCountry] as const))(
    "%s links to a country the catalog has (%s)",
    (_id, exploreCountry) => {
      expect(DATASET_ROWS.some((row) => row.country === exploreCountry)).toBe(true);
    }
  );

  it.each(
    MAP_REGIONS.filter((region) => region.exploreRegion).map((region) => [region.id, region] as const)
  )("%s links to a region the catalog has in that country", (_id, region) => {
    const country = countryById(region.countryId)!;
    expect(DATASET_ROWS.some((row) => row.country === country.exploreCountry && row.region === region.exploreRegion)).toBe(true);
  });
});
