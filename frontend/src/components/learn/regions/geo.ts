import { geoGraticule10, geoNaturalEarth1, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { feature, mesh } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import type { LonLat, MapCountry } from "../../../content/learn/regions";
// Loaded as text and parsed once: TypeScript would otherwise infer a type for the whole 340 KB file.
import rawMapData from "./mapData.json?raw";

type Props = { name: string };
type MapTopology = Topology<{
  world: GeometryCollection<Props>;
  detail: GeometryCollection<Props>;
  states: GeometryCollection<Props>;
}>;

export type CountryFeature = Feature<Geometry, Props>;
export type Box = readonly [readonly [number, number], readonly [number, number]];
export interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface ZoomTransform {
  k: number;
  tx: number;
  ty: number;
}

export const MAP_WIDTH = 1200;
export const MAP_HEIGHT = 600;
export const MAX_ZOOM = 12;
/** Share of the map's width the open drawer covers on wide screens. */
export const DRAWER_INSET = 0.32;
export const IDENTITY: ZoomTransform = { k: 1, tx: 0, ty: 0 };

const topo = JSON.parse(rawMapData) as MapTopology;
const world = feature(topo, topo.objects.world) as FeatureCollection<Geometry, Props>;
const detail = feature(topo, topo.objects.detail) as FeatureCollection<Geometry, Props>;

const projection = geoNaturalEarth1().fitExtent(
  [
    [16, 16],
    [MAP_WIDTH - 16, MAP_HEIGHT - 16],
  ],
  world
);
const path = geoPath(projection);

export const WORLD_FEATURES: CountryFeature[] = world.features;

export function detailFeature(atlasName: string): CountryFeature | undefined {
  return detail.features.find((f) => f.properties.name === atlasName);
}

export function pathFor(f: CountryFeature): string {
  return path(f) ?? "";
}

export const GRATICULE_PATH = path(geoGraticule10()) ?? "";
// Only borders shared by two states, so the outer coastline isn't drawn twice.
export const US_STATE_LINES_PATH = path(mesh(topo, topo.objects.states, (a, b) => a !== b)) ?? "";

export function projectPoint([lon, lat]: LonLat): [number, number] {
  const point = projection([lon, lat]);
  if (!point) throw new Error(`Cannot project ${lon}, ${lat}`);
  return point;
}

/** The projected bounding box of a lon/lat box (corners and edge midpoints, since the projection curves edges). */
export function projectedBox([[west, south], [east, north]]: readonly [LonLat, LonLat]): Box {
  const midLon = (west + east) / 2;
  const midLat = (south + north) / 2;
  const points = [
    [west, south],
    [west, north],
    [east, south],
    [east, north],
    [midLon, south],
    [midLon, north],
    [west, midLat],
    [east, midLat],
  ].map(([lon, lat]) => projectPoint([lon, lat]));
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return [
    [Math.min(...xs), Math.min(...ys)],
    [Math.max(...xs), Math.max(...ys)],
  ];
}

export function fitTransform([[x0, y0], [x1, y1]]: Box, viewport: Viewport, maxScale = MAX_ZOOM, padding = 0.85): ZoomTransform {
  const k = Math.min(maxScale, padding * Math.min(viewport.width / (x1 - x0), viewport.height / (y1 - y0)));
  return {
    k,
    tx: viewport.x + viewport.width / 2 - (k * (x0 + x1)) / 2,
    ty: viewport.y + viewport.height / 2 - (k * (y0 + y1)) / 2,
  };
}

export function countryTransform(country: MapCountry, inset: boolean): ZoomTransform {
  const width = inset ? MAP_WIDTH * (1 - DRAWER_INSET) : MAP_WIDTH;
  return fitTransform(projectedBox(country.fitBounds), { x: 0, y: 0, width, height: MAP_HEIGHT });
}
