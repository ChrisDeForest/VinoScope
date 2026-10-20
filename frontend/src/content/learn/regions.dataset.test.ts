import { describe, it, expect } from "vitest";
import { DATASET_ROWS } from "../../test/dataset";
import { MAP_COUNTRIES, MAP_REGIONS, countryById } from "./regions";

function catalogHas(regionId: string): boolean {
  const region = MAP_REGIONS.find((entry) => entry.id === regionId)!;
  const country = countryById(region.countryId)!;
  return DATASET_ROWS.some((row) => row.country === country.exploreCountry && row.region === region.exploreRegion);
}

describe("Wine Regions against the dataset", () => {
  it.each(MAP_COUNTRIES.map((country) => [country.id, country.exploreCountry] as const))(
    "%s links to a country the catalog has (%s)",
    (_id, exploreCountry) => {
      expect(DATASET_ROWS.some((row) => row.country === exploreCountry)).toBe(true);
    }
  );

  it.each(MAP_REGIONS.map((region) => [region.id] as const))(
    "%s links to a region the catalog has in that country",
    (id) => {
      expect(catalogHas(id)).toBe(true);
    }
  );
});
