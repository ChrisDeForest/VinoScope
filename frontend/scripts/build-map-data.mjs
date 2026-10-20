// Builds src/components/learn/regions/mapData.json for the Learn page's Wine Regions map.
// Dev-only: rerun with `npm run build:map` if the list of wine countries changes.
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { feature, neighbors } from "topojson-client";
import { topology } from "topojson-server";

const require = createRequire(import.meta.url);
const load = (id) => JSON.parse(readFileSync(require.resolve(id), "utf8"));
const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, "../src/components/learn/regions/mapData.json");

// Names as they appear in world-atlas; order is the order of the `detail` object.
const WINE_COUNTRIES = [
  "United States of America",
  "Italy",
  "France",
  "Germany",
  "Portugal",
  "Spain",
  "Canada",
  "Argentina",
  "Hungary",
  "Chile",
  "Australia",
  "New Zealand",
  "South Africa",
];
const NOT_LOWER_48 = new Set([
  "Alaska",
  "Hawaii",
  "Puerto Rico",
  "American Samoa",
  "Guam",
  "Commonwealth of the Northern Mariana Islands",
  "United States Virgin Islands",
]);

const slim = (f) => ({ type: "Feature", id: f.id, properties: { name: f.properties.name }, geometry: f.geometry });
const collection = (features) => ({ type: "FeatureCollection", features });

const coarse = load("world-atlas/countries-110m.json");
const fine = load("world-atlas/countries-50m.json");
const us = load("us-atlas/states-10m.json");

const world = feature(coarse, coarse.objects.countries).features.filter((f) => f.properties.name !== "Antarctica").map(slim);
const fineFeatures = feature(fine, fine.objects.countries).features;
const detail = WINE_COUNTRIES.map((name) => {
  const match = fineFeatures.find((f) => f.properties.name === name);
  if (!match) throw new Error(`world-atlas has no 50m outline named "${name}"`);
  return slim(match);
});
// Countries sharing a land border with a wine country get the same 50m outline, so the borders
// seen when zoomed into a wine country line up exactly.
const fineGeometries = fine.objects.countries.geometries;
const adjacency = neighbors(fineGeometries);
const nearNames = new Set();
fineGeometries.forEach((geometry, i) => {
  if (WINE_COUNTRIES.includes(geometry.properties.name)) adjacency[i].forEach((j) => nearNames.add(fineGeometries[j].properties.name));
});
WINE_COUNTRIES.forEach((name) => nearNames.delete(name));
const near = fineFeatures.filter((f) => nearNames.has(f.properties.name)).map(slim);
const states = feature(us, us.objects.states).features.filter((f) => !NOT_LOWER_48.has(f.properties.name)).map(slim);

// Two topologies: the world view and US states are only seen at low zoom, so 1e4 quantization is
// plenty; the wine countries and their neighbors are zoomed into deeply (up to ~100x), so they get 1e5.
const coarseTopo = topology({ world: collection(world), states: collection(states) }, 1e4);
const fineTopo = topology({ detail: collection(detail), near: collection(near) }, 1e5);
writeFileSync(OUT, JSON.stringify({ coarse: coarseTopo, fine: fineTopo }));
console.log(`wrote ${OUT}: ${world.length} countries, ${detail.length} detailed, ${near.length} neighbors, ${states.length} states`);
