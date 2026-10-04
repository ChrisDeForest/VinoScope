// Builds src/components/learn/regions/mapData.json for the Learn page's Wine Regions map.
// Dev-only: rerun with `npm run build:map` if the list of wine countries changes.
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { feature } from "topojson-client";
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
const states = feature(us, us.objects.states).features.filter((f) => !NOT_LOWER_48.has(f.properties.name)).map(slim);

// 1e4 quantization keeps the file under ~350 KB and is still crisp at the map's 12x maximum zoom.
const topo = topology({ world: collection(world), detail: collection(detail), states: collection(states) }, 1e4);
writeFileSync(OUT, JSON.stringify(topo));
console.log(`wrote ${OUT}: ${world.length} countries, ${detail.length} detailed, ${states.length} states`);
