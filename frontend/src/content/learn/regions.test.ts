import { describe, it, expect } from "vitest";
import {
  MAP_COUNTRIES,
  MAP_REGIONS,
  REGIONS_CHAPTER,
  countryById,
  keyGrapeId,
  regionById,
  regionsOf,
} from "./regions";

describe("Wine Regions content", () => {
  it("has chapter strings", () => {
    expect(REGIONS_CHAPTER.id).toBe("regions");
    expect(REGIONS_CHAPTER.label).toBe("Wine Regions");
    expect(REGIONS_CHAPTER.title).toBe("Where wine comes from");
    expect(REGIONS_CHAPTER.lead.trim()).not.toBe("");
  });

  it("lists 13 countries in catalog-size order", () => {
    expect(MAP_COUNTRIES.map((country) => country.id)).toEqual([
      "united-states",
      "italy",
      "france",
      "germany",
      "portugal",
      "spain",
      "canada",
      "argentina",
      "hungary",
      "chile",
      "australia",
      "new-zealand",
      "south-africa",
    ]);
  });

  it("lists 28 regions grouped by country", () => {
    expect(MAP_REGIONS.map((region) => region.id)).toEqual([
      "napa-sonoma",
      "willamette",
      "washington",
      "piedmont",
      "tuscany",
      "veneto",
      "emilia-romagna",
      "bordeaux",
      "burgundy",
      "champagne",
      "rhone",
      "loire",
      "alsace",
      "provence",
      "mosel",
      "rheingau",
      "douro",
      "madeira",
      "rioja",
      "ribera-del-duero",
      "jerez",
      "niagara",
      "mendoza",
      "tokaj",
      "colchagua",
      "barossa",
      "marlborough",
      "stellenbosch",
    ]);
  });

  it("uses unique, URL-safe ids across countries and regions", () => {
    const ids = [...MAP_COUNTRIES, ...MAP_REGIONS].map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it.each(MAP_COUNTRIES.map((country) => [country.id, country] as const))("%s has copy, a sane fit box and regions", (_id, country) => {
    for (const text of [country.name, country.atlasName, country.exploreCountry, country.overview]) expect(text.trim()).not.toBe("");
    const [[west, south], [east, north]] = country.fitBounds;
    expect(west).toBeLessThan(east);
    expect(south).toBeLessThan(north);
    expect(regionsOf(country.id).length).toBeGreaterThan(0);
    expect(country.source).toBe("general");
  });

  it.each(MAP_REGIONS.map((region) => [region.id, region] as const))("%s is complete and sits inside its country's fit box", (_id, region) => {
    const country = countryById(region.countryId);
    expect(country).toBeDefined();
    for (const text of [region.name, region.about, region.climateLabel, region.fact]) expect(text.trim()).not.toBe("");
    expect([1, 2, 3, 4, 5]).toContain(region.climate);
    expect(region.grapes.length).toBeGreaterThan(0);
    expect(region.styles.length).toBeGreaterThan(0);
    expect(region.source).toBe("general");
    const [lon, lat] = region.coords;
    const [[west, south], [east, north]] = country!.fitBounds;
    expect(lon).toBeGreaterThanOrEqual(west);
    expect(lon).toBeLessThanOrEqual(east);
    expect(lat).toBeGreaterThanOrEqual(south);
    expect(lat).toBeLessThanOrEqual(north);
  });

  it("looks entries up by id", () => {
    expect(countryById("france")!.name).toBe("France");
    expect(regionById("bordeaux")!.countryId).toBe("france");
    expect(regionsOf("germany").map((region) => region.id)).toEqual(["mosel", "rheingau"]);
    expect(countryById("atlantis")).toBeUndefined();
    expect(regionById("atlantis")).toBeUndefined();
  });

  it("maps grape names to Key Grapes ids", () => {
    expect(keyGrapeId("Cabernet Sauvignon")).toBe("cabernet-sauvignon");
    expect(keyGrapeId("Shiraz")).toBe("syrah");
    expect(keyGrapeId("Syrah")).toBe("syrah");
    expect(keyGrapeId("Nebbiolo")).toBeNull();
  });

  it("links catalog-name regions with their catalog wording", () => {
    expect(regionById("napa-sonoma")).toMatchObject({ exploreRegion: "California", exploreLabel: "California" });
    expect(regionById("ribera-del-duero")).toMatchObject({ exploreRegion: "Castilla y Leon", exploreLabel: "Castilla y León" });
    expect(regionById("loire")!.exploreRegion).toBeNull();
  });
});
