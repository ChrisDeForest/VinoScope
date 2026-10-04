import { describe, it, expect } from "vitest";
import { MAP_COUNTRIES, MAP_REGIONS, countryById, regionsOf } from "../../../content/learn/regions";
import {
  DRAWER_CLEARANCE_PX,
  OVERLAY_CLEARANCE_PX,
  PIN,
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
  labelBox,
  pathFor,
  placeLabels,
  projectPoint,
  projectedBox,
  type Box,
  type ClearSpace,
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
  const center = (transform: { k: number; tx: number; ty: number }, box: Box) => [
    transform.k * ((box[0][0] + box[1][0]) / 2) + transform.tx,
    transform.k * ((box[0][1] + box[1][1]) / 2) + transform.ty,
  ];
  const france = countryById("france")!;
  const box = projectedBox(france.fitBounds);

  it("centers a country in the full map", () => {
    const [x, y] = center(countryTransform(france), box);
    expect(x).toBeCloseTo(MAP_WIDTH / 2);
    expect(y).toBeCloseTo(MAP_HEIGHT / 2);
    expect(countryTransform(france).k).toBeGreaterThan(1);
  });

  it("keeps the drawer's on-screen width clear, however wide the map is drawn", () => {
    // At 1200px one viewBox unit is one pixel; at 750px the same 372px drawer covers far more of the map.
    for (const width of [1200, 750]) {
      const right = (DRAWER_CLEARANCE_PX * MAP_WIDTH) / width;
      const [x] = center(countryTransform(france, width, { top: 0, right: DRAWER_CLEARANCE_PX }), box);
      expect(x).toBeCloseTo((MAP_WIDTH - right) / 2);
    }
  });

  it("keeps the overlaid breadcrumb clear at the top", () => {
    const top = (OVERLAY_CLEARANCE_PX * MAP_WIDTH) / 1000;
    const [, y] = center(countryTransform(france, 1000, { top: OVERLAY_CLEARANCE_PX, right: 0 }), box);
    expect(y).toBeCloseTo(top + (MAP_HEIGHT - top) / 2);
  });

  it("never squeezes the country into a sliver on a narrow map", () => {
    const transform = countryTransform(france, 300, { top: OVERLAY_CLEARANCE_PX, right: DRAWER_CLEARANCE_PX });
    const [x] = center(transform, box);
    expect(x).toBeCloseTo((MAP_WIDTH * 0.4) / 2);
  });

  it("has an identity transform for the world", () => {
    expect(IDENTITY).toEqual({ k: 1, tx: 0, ty: 0 });
  });
});

describe("pin labels", () => {
  // The layouts the map is drawn at: a wide desktop with and without the drawer, a tablet with it, a phone.
  const LAYOUTS: { name: string; width: number; clear: ClearSpace }[] = [
    { name: "desktop with drawer", width: 1200, clear: { top: OVERLAY_CLEARANCE_PX, right: DRAWER_CLEARANCE_PX } },
    { name: "desktop", width: 1200, clear: { top: OVERLAY_CLEARANCE_PX, right: 0 } },
    { name: "tablet with drawer", width: 736, clear: { top: OVERLAY_CLEARANCE_PX, right: DRAWER_CLEARANCE_PX } },
    { name: "phone", width: 358, clear: { top: 0, right: 0 } },
  ];

  function layOut(countryId: string, { width, clear }: (typeof LAYOUTS)[number]) {
    const transform = countryTransform(countryById(countryId)!, width, clear);
    const s = width / MAP_WIDTH;
    const pins = regionsOf(countryId).map((region) => {
      const [x, y] = projectPoint(region.coords);
      return {
        id: region.id,
        name: region.name,
        preferred: region.labelSide,
        point: [(transform.k * x + transform.tx) * s, (transform.k * y + transform.ty) * s] as const,
      };
    });
    const visible: Box = [
      [0, clear.top],
      [width - Math.min(clear.right, width * 0.6), MAP_HEIGHT * s],
    ];
    return { pins, visible, placed: placeLabels(pins, visible) };
  }

  it("estimates label boxes on either side of the pin", () => {
    const [[rx0], [rx1]] = labelBox([100, 100], "Mosel", "right", 1);
    const [[lx0], [lx1]] = labelBox([100, 100], "Mosel", "left", 1);
    expect(rx0).toBe(100 + PIN.labelGap);
    expect(lx1).toBe(100 - PIN.labelGap);
    expect(rx1 - rx0).toBeCloseTo(lx1 - lx0);
  });

  it("puts Mosel's label left of its pin, clear of Rheingau's", () => {
    expect(MAP_REGIONS.find((region) => region.id === "mosel")!.labelSide).toBe("left");
    expect(layOut("germany", LAYOUTS[0]).placed.get("mosel")).toBe("left");
  });

  it.each(LAYOUTS.slice(0, 3).map((layout) => [layout.name, layout] as const))("labels every pin on a %s", (_name, layout) => {
    for (const country of MAP_COUNTRIES) {
      const { placed } = layOut(country.id, layout);
      for (const [id, side] of placed) expect(side, `${country.id}/${id}`).not.toBeNull();
    }
  });

  it.each(LAYOUTS.map((layout) => [layout.name, layout] as const))("never lets a label cover a pin or a label on a %s", (_name, layout) => {
    for (const country of MAP_COUNTRIES) {
      const { pins, visible, placed } = layOut(country.id, layout);
      const boxes = pins.flatMap((pin) => {
        const side = placed.get(pin.id);
        return side ? [{ id: pin.id, box: labelBox(pin.point, pin.name, side, 1) }] : [];
      });
      for (const { id, box } of boxes) {
        const [[x0, y0], [x1, y1]] = box;
        expect(x0 >= visible[0][0] && x1 <= visible[1][0] && y0 >= visible[0][1] && y1 <= visible[1][1], `${id} in view`).toBe(true);
        for (const pin of pins) {
          if (pin.id === id) continue;
          const dx = pin.point[0] - Math.max(x0, Math.min(pin.point[0], x1));
          const dy = pin.point[1] - Math.max(y0, Math.min(pin.point[1], y1));
          expect(Math.hypot(dx, dy), `${id} label vs ${pin.id} pin`).toBeGreaterThanOrEqual(PIN.halo);
        }
        for (const other of boxes) {
          if (other.id === id) continue;
          const [[ox0, oy0], [ox1, oy1]] = other.box;
          expect(x0 < ox1 && ox0 < x1 && y0 < oy1 && oy0 < y1, `${id} label vs ${other.id} label`).toBe(false);
        }
      }
    }
  });

  it("always labels the selected pin first", () => {
    const pins = [
      { id: "a", name: "Alpha", point: [100, 100] as const },
      { id: "b", name: "Beta", point: [130, 100] as const, selected: true },
    ];
    const placed = placeLabels(pins, [[0, 0], [200, 200]]);
    expect(placed.get("b")).toBe("right");
    expect(placed.get("a")).not.toBe("right");
  });
});
