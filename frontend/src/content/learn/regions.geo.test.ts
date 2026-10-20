import { describe, it, expect } from "vitest";
import { geoContains } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import raw from "../../components/learn/regions/mapData.json?raw";
import { MAP_COUNTRIES, MAP_REGIONS, countryById } from "./regions";

type Props = { name: string };
const topo = (JSON.parse(raw) as { fine: Topology<{ detail: GeometryCollection<Props> }> }).fine;
const detail = (feature(topo, topo.objects.detail) as FeatureCollection<Geometry, Props>).features;
const outline = (atlasName: string): Feature<Geometry, Props> | undefined =>
  detail.find((f) => f.properties.name === atlasName);

describe("Wine Regions against the map", () => {
  it.each(MAP_COUNTRIES.map((country) => [country.id, country.atlasName] as const))("%s has an outline (%s)", (_id, atlasName) => {
    expect(outline(atlasName)).toBeDefined();
  });

  it.each(MAP_REGIONS.map((region) => [region.id, region] as const))("%s's pin is inside its country", (_id, region) => {
    const country = countryById(region.countryId)!;
    expect(geoContains(outline(country.atlasName)!, [region.coords[0], region.coords[1]])).toBe(true);
  });
});
