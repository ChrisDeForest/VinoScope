import { describe, it, expect } from "vitest";
import { DATASET_ROWS } from "../../test/dataset";
import { MAP_COUNTRIES, MAP_REGIONS, countryById } from "./regions";

// Regions whose wines haven't been added to the catalog yet. Their Explore links already use the
// region name new wines should carry; take an id out once the catalog has wines there.
const AWAITING_WINES = new Set([
  "loire",
  "finger-lakes",
  "long-island",
  "beaujolais",
  "vinho-verde",
  "salta",
  "casablanca",
  "hunter-valley",
  "hawkes-bay",
  "central-otago",
]);

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

  it.each(MAP_REGIONS.filter((region) => !AWAITING_WINES.has(region.id)).map((region) => [region.id] as const))(
    "%s links to a region the catalog has in that country",
    (id) => {
      expect(catalogHas(id)).toBe(true);
    }
  );

  it.each([...AWAITING_WINES].map((id) => [id] as const))(
    "%s is still awaiting wines (remove it from AWAITING_WINES once added)",
    (id) => {
      expect(MAP_REGIONS.some((region) => region.id === id)).toBe(true);
      expect(catalogHas(id)).toBe(false);
    }
  );
});
