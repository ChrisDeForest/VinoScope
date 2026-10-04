import { describe, it, expect } from "vitest";
import { MAP_COUNTRIES, MAP_REGIONS, countryById } from "../../../content/learn/regions";
import {
  DRAWER_INSET,
  GRATICULE_PATH,
  IDENTITY,
  MAP_HEIGHT,
  MAP_WIDTH,
  MAX_ZOOM,
  US_STATE_LINES_PATH,
  WORLD_FEATURES,
  countryTransform,
  detailFeature,
  fitTransform,
  pathFor,
  projectPoint,
  projectedBox,
} from "./geo";

describe("map geometry", () => {
  it("decodes the world without Antarctica and every wine country in detail", () => {
    expect(WORLD_FEATURES.length).toBeGreaterThan(150);
    expect(WORLD_FEATURES.some((f) => f.properties.name === "Antarctica")).toBe(false);
    for (const country of MAP_COUNTRIES) {
      const outline = detailFeature(country.atlasName);
      expect(outline, country.id).toBeDefined();
      expect(pathFor(outline!)).toMatch(/^M/);
    }
  });

  it("draws a graticule and US state lines", () => {
    expect(GRATICULE_PATH).toMatch(/^M/);
    expect(US_STATE_LINES_PATH).toMatch(/^M/);
  });

  it("projects every pin inside the map and inside its country's zoom box", () => {
    for (const region of MAP_REGIONS) {
      const [x, y] = projectPoint(region.coords);
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(MAP_WIDTH);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(MAP_HEIGHT);
      const [[x0, y0], [x1, y1]] = projectedBox(countryById(region.countryId)!.fitBounds);
      expect(x).toBeGreaterThanOrEqual(x0);
      expect(x).toBeLessThanOrEqual(x1);
      expect(y).toBeGreaterThanOrEqual(y0);
      expect(y).toBeLessThanOrEqual(y1);
    }
  });
});

describe("fitTransform", () => {
  it("scales a box to fill the viewport (with padding) and centers it", () => {
    const { k, tx, ty } = fitTransform([[100, 100], [200, 150]], { x: 0, y: 0, width: 1000, height: 500 });
    expect(k).toBeCloseTo(8.5);
    expect(tx).toBeCloseTo(500 - 8.5 * 150);
    expect(ty).toBeCloseTo(250 - 8.5 * 125);
  });

  it("caps the zoom", () => {
    expect(fitTransform([[0, 0], [1, 1]], { x: 0, y: 0, width: 1000, height: 500 }).k).toBe(MAX_ZOOM);
  });

  it("respects the viewport offset", () => {
    const { k, tx } = fitTransform([[0, 0], [100, 100]], { x: 200, y: 0, width: 400, height: 400 }, 100, 1);
    expect(k).toBe(4);
    expect(tx).toBe(200 + 200 - 4 * 50);
  });
});

describe("countryTransform", () => {
  const centerX = (transform: { k: number; tx: number }, box: ReturnType<typeof projectedBox>) =>
    transform.k * ((box[0][0] + box[1][0]) / 2) + transform.tx;

  it("centers a country in the full map, or left of the drawer when inset", () => {
    const france = countryById("france")!;
    const box = projectedBox(france.fitBounds);
    expect(centerX(countryTransform(france, false), box)).toBeCloseTo(MAP_WIDTH / 2);
    expect(centerX(countryTransform(france, true), box)).toBeCloseTo((MAP_WIDTH * (1 - DRAWER_INSET)) / 2);
    expect(countryTransform(france, false).k).toBeGreaterThan(1);
  });

  it("has an identity transform for the world", () => {
    expect(IDENTITY).toEqual({ k: 1, tx: 0, ty: 0 });
  });
});
