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
/** The open drawer's width on wide screens; keep in sync with `.region-drawer` in `learn.css`. */
export const DRAWER_WIDTH_PX = 340;
/** Screen space the zoom keeps clear on the right for the drawer: its width, its 14px offset and a gap. */
export const DRAWER_CLEARANCE_PX = DRAWER_WIDTH_PX + 14 + 18;
/** Screen space the zoom keeps clear at the top for the "← World" button and breadcrumb overlaid on wide screens. */
export const OVERLAY_CLEARANCE_PX = 52;
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

/** Screen space (CSS px) the zoom must keep clear of the country, because something is drawn over the map there. */
export interface ClearSpace {
  top: number;
  right: number;
}

export const NO_CLEAR_SPACE: ClearSpace = { top: 0, right: 0 };

/**
 * Fits a country into the part of the map that is left visible. `renderedWidth` is the SVG's on-screen
 * width in CSS px, which converts the screen-space clearances into viewBox units.
 */
export function countryTransform(country: MapCountry, renderedWidth: number = MAP_WIDTH, clear: ClearSpace = NO_CLEAR_SPACE): ZoomTransform {
  const unitsPerPx = MAP_WIDTH / (renderedWidth > 0 ? renderedWidth : MAP_WIDTH);
  // Never let the clearances squeeze the country into a sliver, however narrow the map gets.
  const right = Math.min(clear.right * unitsPerPx, MAP_WIDTH * 0.6);
  const top = Math.min(clear.top * unitsPerPx, MAP_HEIGHT * 0.3);
  return fitTransform(projectedBox(country.fitBounds), { x: 0, y: top, width: MAP_WIDTH - right, height: MAP_HEIGHT - top });
}

/** Pin sizes in screen px: the map divides them by its on-screen scale so they look the same at every zoom and width. */
export const PIN = {
  halo: 10,
  haloSelected: 16,
  core: 4.5,
  stroke: 1.3,
  /** An invisible tap target, 28px across. */
  hit: 14,
  font: 12,
  /** Gap between the pin's center and its label. */
  labelGap: 8,
} as const;

/** Where a pin's label sits relative to the pin. Content picks left or right; placement may fall back to below or above. */
export type LabelSide = "left" | "right" | "below" | "above";

/**
 * Where a label's text is anchored, in the same units as the pin's `[x, y]`. `unit` is the size of one
 * screen px in those units.
 */
export function labelAnchor([x, y]: readonly [number, number], side: LabelSide, unit: number): { x: number; y: number; anchor: "start" | "end" | "middle" } {
  switch (side) {
    case "left":
      return { x: x - PIN.labelGap * unit, y: y + 4 * unit, anchor: "end" };
    case "below":
      return { x, y: y + (PIN.halo + 0.85 * PIN.font) * unit, anchor: "middle" };
    case "above":
      return { x, y: y - (PIN.halo + 3) * unit, anchor: "middle" };
    default:
      return { x: x + PIN.labelGap * unit, y: y + 4 * unit, anchor: "start" };
  }
}

/** The estimated box of a pin's label. Text width is estimated at 0.55em per character, generous for the serif face. */
export function labelBox(point: readonly [number, number], text: string, side: LabelSide, unit: number): Box {
  const width = text.length * 0.55 * PIN.font * unit;
  const { x, y, anchor } = labelAnchor(point, side, unit);
  const start = anchor === "end" ? x - width : anchor === "middle" ? x - width / 2 : x;
  return [
    [start, y - 0.8 * PIN.font * unit],
    [start + width, y + 0.25 * PIN.font * unit],
  ];
}

export interface LabelCandidate {
  id: string;
  name: string;
  /** The pin's position on screen, in CSS px. */
  point: readonly [number, number];
  preferred?: "left" | "right";
  selected?: boolean;
}

function overlaps([[ax0, ay0], [ax1, ay1]]: Box, [[bx0, by0], [bx1, by1]]: Box): boolean {
  return ax0 < bx1 && bx0 < ax1 && ay0 < by1 && by0 < ay1;
}

function hitsCircle([[x0, y0], [x1, y1]]: Box, [cx, cy]: readonly [number, number], r: number): boolean {
  const dx = cx - Math.max(x0, Math.min(cx, x1));
  const dy = cy - Math.max(y0, Math.min(cy, y1));
  return dx * dx + dy * dy < r * r;
}

/**
 * Picks a side for each pin's label, in screen px, so no label covers another pin or label or leaves the
 * visible part of the map (`visible`). The selected pin goes first; a label with no free side is hidden
 * (null). Its pin keeps its accessible name, and the drawer lists every region.
 */
export function placeLabels(pins: readonly LabelCandidate[], visible: Box): Map<string, LabelSide | null> {
  const placed = new Map<string, LabelSide | null>();
  const boxes: Box[] = [];
  const order = [...pins].sort((a, b) => Number(Boolean(b.selected)) - Number(Boolean(a.selected)));
  const [[vx0, vy0], [vx1, vy1]] = visible;
  for (const pin of order) {
    const first = pin.preferred ?? "right";
    const sides: LabelSide[] = [first, first === "right" ? "left" : "right", "below", "above"];
    const side = sides.find((candidate) => {
      const box = labelBox(pin.point, pin.name, candidate, 1);
      const [[x0, y0], [x1, y1]] = box;
      if (x0 < vx0 || x1 > vx1 || y0 < vy0 || y1 > vy1) return false;
      if (pins.some((other) => other !== pin && hitsCircle(box, other.point, other.selected ? PIN.haloSelected : PIN.halo))) return false;
      return !boxes.some((taken) => overlaps(box, taken));
    });
    placed.set(pin.id, side ?? null);
    if (side) boxes.push(labelBox(pin.point, pin.name, side, 1));
  }
  return placed;
}
