# Learn Page, Part 5: Wine Regions Map — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Wine Regions chapter to `/learn`: a gold line-art world map (13 wine countries, 28 region pins) that glides into a country on click, with a sliding drawer teaching each country/region and linking to Explore via a new `region` filter, deep-linkable via `#country-<id>` / `#region-<id>`.

**Architecture:** A backend `region` query param and matching Explore filter come first. A dev script prebuilds one TopoJSON file (`mapData.json`) that `geo.ts` decodes with `topojson-client` and projects with `d3-geo` (Natural Earth, 1200×600 viewBox); `fitTransform` computes the zoom as a pure function. `RegionsChapter` owns the selection (`useMapSelection`: hash in/out, Back/Forward, Escape step-back) and renders `CountryChips`, a lazily loaded `RegionsMap` (React SVG, CSS-transform zoom), and `RegionDrawer` (country/region views with live counts from `useCatalogCount`). Content lives in `content/learn/regions.ts`.

**Tech Stack:** React 18, TypeScript, React Router 6, Tailwind 3, Vitest 2 + Testing Library (jsdom), `@testing-library/user-event`; FastAPI + SQLAlchemy + pytest (Postgres). New runtime deps: `d3-geo`, `topojson-client`. New dev deps: `@types/d3-geo`, `@types/topojson-client`, `world-atlas`, `us-atlas`, `topojson-server`.

**Spec:** `docs/superpowers/specs/2026-10-03-learn-regions-map-design.md`

## Global Constraints

- Frontend paths are relative to `frontend/`; backend/test paths (`backend/`, `tests/`) and `docs/`, `data/` are relative to the repo root.
- Frontend tests from `frontend/`: `npx vitest run <path>`; full suite `npx vitest run`; type-check + build `npm run build`. Baseline on `main`: 81 files, 698 tests, all passing.
- Backend tests from the repo root: `.venv/Scripts/python -m pytest <path> -v` (needs the `finalproject-postgres-1` container running; `TEST_DATABASE_URL` comes from `.env`).
- Test-first for every task: failing test, watch it fail, implement, watch it pass, commit.
- The only new npm packages are the ones listed in Tech Stack, installed in Task 3. No new Python packages.
- All Learn copy lives in `src/content/learn/`; every entry carries `source: "general"`; never shown on the page.
- Gold line art: outlines `stroke-accent`; wine colors are the only fills besides the accent wash; every `.draw` element has `pathLength={1}`; decorative SVG is `aria-hidden="true"`.
- CSS rules outside `.scene-animate:not(.is-visible)` and outside `prefers-reduced-motion: no-preference` blocks describe the finished, static look. Only `transform`, `opacity`, `stroke-dashoffset`, `fill-opacity` animate.
- Tailwind color tokens are plain CSS variables (`--color-accent`, `--color-wine-red`, …): opacity modifiers like `bg-accent/50` do NOT work.
- Arrow glyphs (`→`, `←`) go in an `aria-hidden="true"` span when they're part of a link or button name.
- The TypeScript lib target is ES2020: no `Array.prototype.at`, no `Object.hasOwn`.
- Files contain non-ASCII (`é`, `ô`, `ü`, `ő`, `→`, `—`, `−`, `°`). Save as UTF-8; after each commit verify touched files decode as UTF-8 (from the repo root: `git diff --name-only HEAD~1 | .venv/Scripts/python -c "import sys; [open(f,'rb').read().decode('utf-8') for f in sys.stdin.read().split() if not f.endswith('.json')]; print('utf-8 ok')"`).
- Commit messages end with: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- Work on branch `feature/learn-regions` (the controller creates it before Task 1).

---

## File Map

| File | Status | Responsibility |
|---|---|---|
| `backend/app/services/wines.py`, `backend/app/api/wines.py`, `tests/api/test_wines.py` | Modify | `region` filter |
| `src/types/wine.ts`, `src/components/explore/filterTypes.ts` (+ test), `src/pages/ExplorePage.tsx` (+ test) | Modify | `region` in Explore filters, URL, API, chip |
| `package.json`, `scripts/build-map-data.mjs`, `src/components/learn/regions/mapData.json` (+ `mapData.test.ts`) | Modify / Create | Deps; prebuilt topology |
| `src/content/learn/regions.ts` (+ `regions.test.ts`, `regions.dataset.test.ts`, `regions.geo.test.ts`) | Create | Chapter, countries, regions, lookups |
| `src/components/learn/regions/geo.ts` (+ test) | Create | Projection, paths, `fitTransform`, `countryTransform` |
| `src/components/learn/regions/useCatalogCount.ts`, `useMapSelection.ts` (+ tests) | Create | Live counts; selection + hash |
| `src/components/learn/regions/CountryChips.tsx`, `ClimateScale.tsx`, `RegionDrawer.tsx` (+ tests) | Create | Chips; climate scale; drawer |
| `src/components/learn/regions/RegionsMap.tsx` (+ test), `src/components/learn/learn.css` | Create / Modify | The SVG map; map + drawer styles |
| `src/components/learn/regions/RegionsChapter.tsx` (+ test), `src/components/learn/chapters.ts`, `src/components/home/scenes/LearnScene.tsx`, `src/pages/LearnPage.test.tsx`, `src/components/home/scenes/FeatureScenes.test.tsx` | Create / Modify | Chapter assembly and wiring |

---

### Task 1: Backend region filter

**Files:**
- Modify: `backend/app/services/wines.py` (`list_wines`)
- Modify: `backend/app/api/wines.py` (`list_wines` route)
- Test: `tests/api/test_wines.py`

**Interfaces:**
- Produces: `GET /api/wines?region=<value>` — case-insensitive exact match on `Wine.region`, combinable with every other filter.

- [ ] **Step 1: Write the failing tests** — append to `tests/api/test_wines.py`:

```python
def _set_region(db_session, wine_id, region):
    db_session.get(Wine, wine_id).region = region
    db_session.commit()


def test_list_wines_filters_by_region_case_insensitive(client, db_session, seeded_wines):
    _set_region(db_session, seeded_wines["wine3"], "Bordeaux")
    _set_region(db_session, seeded_wines["wine1"], "California")
    response = client.get("/api/wines", params={"region": "bORDEAUX"})
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["id"] == seeded_wines["wine3"]


def test_list_wines_region_combines_with_country(client, db_session, seeded_wines):
    _set_region(db_session, seeded_wines["wine1"], "California")
    mismatch = client.get("/api/wines", params={"region": "California", "country": "France"}).json()
    match = client.get("/api/wines", params={"region": "California", "country": "United States"}).json()
    assert mismatch["total"] == 0
    assert match["total"] == 1
    assert match["items"][0]["id"] == seeded_wines["wine1"]


def test_list_wines_unknown_region_returns_nothing(client, seeded_wines):
    body = client.get("/api/wines", params={"region": "Atlantis"}).json()
    assert body["total"] == 0
    assert body["items"] == []
```

- [ ] **Step 2: Run to verify they fail**

Run: `.venv/Scripts/python -m pytest tests/api/test_wines.py -k region -v`
Expected: FAIL — the `region` param is ignored, so totals are 3 / 1 / 3.

- [ ] **Step 3: Implement**

In `backend/app/services/wines.py`, add `region: Optional[str] = None,` to `list_wines`'s keyword arguments right after `country`, and right after the `country` filter block add:

```python
    if region is not None:
        stmt = stmt.where(func.lower(Wine.region) == region.lower())
```

In `backend/app/api/wines.py`, add `region: Optional[str] = None,` to the route's parameters right after `country`, and pass `region=region,` to `wines_service.list_wines(...)` right after `country=country,`.

- [ ] **Step 4: Run to verify they pass, then the whole wines API file**

Run: `.venv/Scripts/python -m pytest tests/api/test_wines.py -v`
Expected: PASS (all, including the three new tests).

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/wines.py backend/app/api/wines.py tests/api/test_wines.py
git commit -m "feat(api): filter wines by region

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Explore region filter

**Files:**
- Modify: `src/types/wine.ts` (`ListWinesParams`)
- Modify: `src/components/explore/filterTypes.ts`
- Modify: `src/pages/ExplorePage.tsx` (`CHIP_LABELS`)
- Test: `src/components/explore/filterTypes.test.ts`, `src/pages/ExplorePage.test.tsx`

**Interfaces:**
- Consumes: Task 1's `region` API param.
- Produces: `ListWinesParams.region?: string`; `FilterValues.region: string` (default `""`, URL param `region`); `listWines({ region })` sends `?region=`.

- [ ] **Step 1: Write the failing filterTypes tests** — add to `src/components/explore/filterTypes.test.ts` (inside the file's top-level `describe` blocks or as a new `describe`; import the helpers it uses from `./filterTypes`):

```ts
describe("region filter", () => {
  it("defaults to empty and counts as an active filter when set", () => {
    expect(DEFAULT_FILTERS.region).toBe("");
    expect(countActiveFilters({ ...DEFAULT_FILTERS, region: "Bordeaux" })).toBe(1);
  });

  it("round-trips through the URL", () => {
    const params = filtersToSearchParams({ ...DEFAULT_FILTERS, region: "Castilla y Leon" });
    expect(params.get("region")).toBe("Castilla y Leon");
    expect(filtersFromSearchParams(params).region).toBe("Castilla y Leon");
    expect(FILTER_PARAM_NAMES).toContain("region");
  });

  it("is sent to the API only when set", () => {
    expect(filtersToApiParams({ ...DEFAULT_FILTERS, region: "Bordeaux" }, 12, 0)).toMatchObject({ region: "Bordeaux" });
    expect(filtersToApiParams(DEFAULT_FILTERS, 12, 0)).not.toHaveProperty("region");
  });
});
```

- [ ] **Step 2: Write the failing ExplorePage test** — add to `src/pages/ExplorePage.test.tsx` inside `describe("ExplorePage", ...)`:

```tsx
  it("filters by a region from the URL and shows a removable region chip", async () => {
    listWinesMock.mockResolvedValue({ total: 1, items: [makeWine(1)] });
    renderExplore(["/explore?region=Bordeaux"]);

    await waitFor(() => expect(listWinesMock).toHaveBeenCalledWith(expect.objectContaining({ region: "Bordeaux" })));
    await waitFor(() => expect(screen.getByText("Wine 1")).toBeInTheDocument());
    expect(screen.getByText("Region: Bordeaux")).toBeInTheDocument();

    const user = userEvent.setup();
    listWinesMock.mockResolvedValue({ total: 2, items: [makeWine(2)] });
    await user.click(screen.getByRole("button", { name: /remove region filter/i }));

    await waitFor(() => expect(screen.getByText("Wine 2")).toBeInTheDocument());
    expect(listWinesMock.mock.calls[listWinesMock.mock.calls.length - 1][0]).not.toHaveProperty("region");
    expect(screen.queryByText("Region: Bordeaux")).not.toBeInTheDocument();
  });
```

- [ ] **Step 3: Run to verify they fail**

Run: `npx vitest run src/components/explore/filterTypes.test.ts src/pages/ExplorePage.test.tsx`
Expected: FAIL — `region` is undefined / not sent / no chip.

- [ ] **Step 4: Implement**

`src/types/wine.ts` — in `ListWinesParams`, after `country?: string;` add:

```ts
  region?: string;
```

`src/components/explore/filterTypes.ts` — add `region` next to `country` everywhere:
- `FilterValues`: `region: string;` after `country: string;`
- `DEFAULT_FILTERS`: `region: "",` after `country: "",`
- `countActiveFilters`: `if (filters.region) count++;` after the country line
- `filtersToApiParams`: `if (filters.region) params.region = filters.region;` after the country line
- `SEARCH_PARAM_NAMES`: `region: "region",` after `country: "country",`
- `filtersFromSearchParams`: `region: params.get("region") ?? DEFAULT_FILTERS.region,` after the country line

`src/pages/ExplorePage.tsx` — in `CHIP_LABELS`, after the country entry add:

```ts
  { key: "region", name: "region", describe: (value) => `Region: ${value}` },
```

There is no region control in `FilterDrawer`; the drawer's draft starts from the applied filters, so applying it keeps `region`, and its clear action resets to `DEFAULT_FILTERS`, which clears it.

- [ ] **Step 5: Run the tests, then type-check**

Run: `npx vitest run src/components/explore src/pages/ExplorePage.test.tsx`
Expected: PASS.

Run: `npm run build`
Expected: succeeds. If TypeScript reports an object literal typed `FilterValues` that is missing `region` (e.g. in a test or `FilterDrawer`), add `region: ""` to it.

- [ ] **Step 6: Commit**

```bash
git add src/types/wine.ts src/components/explore/filterTypes.ts src/components/explore/filterTypes.test.ts src/pages/ExplorePage.tsx src/pages/ExplorePage.test.tsx
git commit -m "feat(explore): add a region filter with a removable chip

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(Add any other file you had to touch for the `region` literal fix to the same commit.)

---

### Task 3: Map dependencies and prebuilt map data

**Files:**
- Modify: `package.json`, `package-lock.json`
- Create: `scripts/build-map-data.mjs`
- Create (generated): `src/components/learn/regions/mapData.json`
- Test: `src/components/learn/regions/mapData.test.ts`

**Interfaces:**
- Produces: `src/components/learn/regions/mapData.json` — a TopoJSON `Topology` with objects `world` (176 countries, no Antarctica, 1:110m), `detail` (the 13 wine countries at 1:50m, in the order below), `states` (49 lower-48 states + DC); each geometry has `properties.name`. Size ≤ 350,000 bytes. `npm run build:map` regenerates it.

- [ ] **Step 1: Install the packages** (from `frontend/`)

```bash
npm install d3-geo@^3.1.1 topojson-client@^3.1.0
npm install -D @types/d3-geo@^3.1.0 @types/topojson-client@^3.1.5 world-atlas@^2.0.2 us-atlas@^3.0.1 topojson-server@^3.0.1
```

Then add to `package.json` `"scripts"`: `"build:map": "node scripts/build-map-data.mjs"`.

- [ ] **Step 2: Write the failing test** — `src/components/learn/regions/mapData.test.ts`

```ts
import { describe, it, expect } from "vitest";
import raw from "./mapData.json?raw";

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

describe("prebuilt map data", () => {
  const topo = JSON.parse(raw);
  const names = (object: string): string[] =>
    topo.objects[object].geometries.map((g: { properties: { name: string } }) => g.properties.name);

  it("is a topology with world, detail and states objects", () => {
    expect(topo.type).toBe("Topology");
    expect(Object.keys(topo.objects).sort()).toEqual(["detail", "states", "world"]);
  });

  it("has the whole world except Antarctica", () => {
    expect(names("world").length).toBeGreaterThan(150);
    expect(names("world")).not.toContain("Antarctica");
    for (const name of WINE_COUNTRIES) expect(names("world")).toContain(name);
  });

  it("has detailed outlines for exactly the 13 wine countries", () => {
    expect(names("detail")).toEqual(WINE_COUNTRIES);
  });

  it("has the lower 48 states plus DC", () => {
    expect(names("states")).toHaveLength(49);
    expect(names("states")).not.toContain("Alaska");
    expect(names("states")).not.toContain("Hawaii");
  });

  it("stays within its size budget", () => {
    expect(raw.length).toBeLessThanOrEqual(350_000);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/components/learn/regions/mapData.test.ts`
Expected: FAIL — cannot resolve `./mapData.json?raw`.

- [ ] **Step 4: Write the build script** — `scripts/build-map-data.mjs`

```js
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
```

- [ ] **Step 5: Generate the data**

Run: `npm run build:map`
Expected: `wrote …mapData.json: 176 countries, 13 detailed, 49 states` (file ≈ 340 KB).

- [ ] **Step 6: Run to verify it passes**

Run: `npx vitest run src/components/learn/regions/mapData.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json scripts/build-map-data.mjs src/components/learn/regions/mapData.json src/components/learn/regions/mapData.test.ts
git commit -m "build(learn): add map libraries and prebuilt wine-region map data

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Regions content

**Files:**
- Create: `src/content/learn/regions.ts`
- Test: `src/content/learn/regions.test.ts`, `src/content/learn/regions.dataset.test.ts`, `src/content/learn/regions.geo.test.ts`

**Interfaces:**
- Consumes: `ContentSource` (`./types`); `GRAPES` (`./grapes`); for tests: `DATASET_ROWS` (`../../test/dataset`), `mapData.json?raw` (Task 3), `topojson-client`, `d3-geo`.
- Produces:
  - `type Climate = 1 | 2 | 3 | 4 | 5`; `type LonLat = readonly [number, number]`
  - `interface MapCountry { id; name; atlasName; exploreCountry; overview; fitBounds: readonly [LonLat, LonLat]; source }` (`fitBounds` = `[[west, south], [east, north]]` in degrees)
  - `interface MapRegion { id; name; countryId; coords: LonLat; exploreRegion: string | null; exploreLabel?: string; about; climate: Climate; climateLabel; grapes: readonly string[]; styles: readonly string[]; fact; source }`
  - `REGIONS_CHAPTER` (`id: "regions"`, `label: "Wine Regions"`, `title: "Where wine comes from"`, `lead`, `source`)
  - `MAP_COUNTRIES: readonly MapCountry[]` (13, chip order), `MAP_REGIONS: readonly MapRegion[]` (28)
  - `countryById(id): MapCountry | undefined`, `regionById(id): MapRegion | undefined`, `regionsOf(countryId): MapRegion[]`
  - `keyGrapeId(name: string): string | null` — the Key Grapes id for a grape display name (`"Syrah"`/`"Shiraz"` → `"syrah"`), else `null`

- [ ] **Step 1: Write the failing content test** — `src/content/learn/regions.test.ts`

```ts
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
```

- [ ] **Step 2: Write the failing dataset test** — `src/content/learn/regions.dataset.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { DATASET_ROWS } from "../../test/dataset";
import { MAP_COUNTRIES, MAP_REGIONS, countryById } from "./regions";

describe("Wine Regions against the dataset", () => {
  it.each(MAP_COUNTRIES.map((country) => [country.id, country.exploreCountry] as const))(
    "%s links to a country the catalog has (%s)",
    (_id, exploreCountry) => {
      expect(DATASET_ROWS.some((row) => row.country === exploreCountry)).toBe(true);
    }
  );

  it.each(
    MAP_REGIONS.filter((region) => region.exploreRegion).map((region) => [region.id, region] as const)
  )("%s links to a region the catalog has in that country", (_id, region) => {
    const country = countryById(region.countryId)!;
    expect(DATASET_ROWS.some((row) => row.country === country.exploreCountry && row.region === region.exploreRegion)).toBe(true);
  });
});
```

- [ ] **Step 3: Write the failing geography test** — `src/content/learn/regions.geo.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { geoContains } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import raw from "../../components/learn/regions/mapData.json?raw";
import { MAP_COUNTRIES, MAP_REGIONS, countryById } from "./regions";

type Props = { name: string };
const topo = JSON.parse(raw) as Topology<{ detail: GeometryCollection<Props> }>;
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
```

- [ ] **Step 4: Run to verify they fail**

Run: `npx vitest run src/content/learn/regions`
Expected: FAIL — cannot resolve `./regions`.

- [ ] **Step 5: Write the content** — `src/content/learn/regions.ts`

```ts
import { GRAPES } from "./grapes";
import type { ContentSource } from "./types";

/** Growing climate on a five-step scale: 1 = cold, 5 = hot. */
export type Climate = 1 | 2 | 3 | 4 | 5;
export type LonLat = readonly [number, number];

export interface MapCountry {
  /** URL-safe slug; also the deep-link anchor (`#country-<id>`). */
  id: string;
  name: string;
  /** The country's name in the map data (world-atlas). */
  atlasName: string;
  /** Value for Explore's `country` filter. */
  exploreCountry: string;
  overview: string;
  /** `[[west, south], [east, north]]` in degrees: what the map zooms to (mainland, lower 48, …). */
  fitBounds: readonly [LonLat, LonLat];
  source: ContentSource;
}

export interface MapRegion {
  /** URL-safe slug; also the deep-link anchor (`#region-<id>`). */
  id: string;
  name: string;
  countryId: string;
  /** Pin position, `[longitude, latitude]`. */
  coords: LonLat;
  /** Value for Explore's `region` filter (the catalog's own region name), or null when the catalog has none. */
  exploreRegion: string | null;
  /** Link wording when the catalog's name differs from the display name (e.g. "California" for "Napa & Sonoma"). */
  exploreLabel?: string;
  about: string;
  climate: Climate;
  climateLabel: string;
  grapes: readonly string[];
  styles: readonly string[];
  /** "Worth knowing". */
  fact: string;
  source: ContentSource;
}

export const REGIONS_CHAPTER = {
  id: "regions",
  label: "Wine Regions",
  title: "Where wine comes from",
  lead: "Every wine tastes of the place it was grown. Pick a country to fly in, then a region to see its climate, its grapes and the wines it's famous for.",
  source: "general",
} as const satisfies { id: "regions"; label: string; title: string; lead: string; source: ContentSource };

export const MAP_COUNTRIES: readonly MapCountry[] = [
  {
    id: "united-states",
    name: "United States",
    atlasName: "United States of America",
    exploreCountry: "United States",
    overview: "Wine is made in all fifty states, but California makes most of it, with Oregon and Washington close behind. Labels usually name the grape, and sunny weather gives ripe, generous wines.",
    fitBounds: [[-125, 24.5], [-66.9, 49.4]],
    source: "general",
  },
  {
    id: "italy",
    name: "Italy",
    atlasName: "Italy",
    exploreCountry: "Italy",
    overview: "Italy has more native grapes than any other country, from Piedmont's Nebbiolo to Tuscany's Sangiovese. Its wines are made for the table, with bright acidity to match food.",
    fitBounds: [[6.6, 36.6], [18.6, 47.1]],
    source: "general",
  },
  {
    id: "france",
    name: "France",
    atlasName: "France",
    exploreCountry: "France",
    overview: "The benchmark for much of the wine world: Bordeaux, Burgundy and Champagne set the styles others are measured against. French labels name the place, not the grape.",
    fitBounds: [[-5.2, 41.3], [9.6, 51.1]],
    source: "general",
  },
  {
    id: "germany",
    name: "Germany",
    atlasName: "Germany",
    exploreCountry: "Germany",
    overview: "One of the coolest places to grow wine, famous for Riesling on steep river slopes. Its wines run from bone dry to lusciously sweet, always with high acidity.",
    fitBounds: [[5.9, 47.3], [15.0, 55.1]],
    source: "general",
  },
  {
    id: "portugal",
    name: "Portugal",
    atlasName: "Portugal",
    exploreCountry: "Portugal",
    overview: "Home of Port, the fortified wine of the Douro Valley, and Madeira from its Atlantic island. It also grows hundreds of native grapes for its everyday table wines.",
    fitBounds: [[-17.3, 32.6], [-6.2, 42.2]],
    source: "general",
  },
  {
    id: "spain",
    name: "Spain",
    atlasName: "Spain",
    exploreCountry: "Spain",
    overview: "Spain has more land under vine than any other country. Tempranillo leads its reds, and the hot south makes Sherry, the world's most famous fortified white.",
    fitBounds: [[-9.4, 35.9], [3.4, 43.8]],
    source: "general",
  },
  {
    id: "canada",
    name: "Canada",
    atlasName: "Canada",
    exploreCountry: "Canada",
    overview: "A cold-climate country best known for icewine, made from grapes frozen on the vine. Most of its wine comes from Ontario's Niagara Peninsula and British Columbia.",
    fitBounds: [[-130, 41.7], [-52.6, 56]],
    source: "general",
  },
  {
    id: "argentina",
    name: "Argentina",
    atlasName: "Argentina",
    exploreCountry: "Argentina",
    overview: "Vineyards sit high in the foothills of the Andes, where sunny days and cold nights make bold, ripe reds. Malbec, originally from France, became its signature grape.",
    fitBounds: [[-73.6, -55.1], [-53.6, -21.8]],
    source: "general",
  },
  {
    id: "hungary",
    name: "Hungary",
    atlasName: "Hungary",
    exploreCountry: "Hungary",
    overview: "Famous for Tokaji, one of the world's oldest sweet wines, made from grapes shriveled by noble rot. It also grows native grapes like Furmint for dry whites.",
    fitBounds: [[16.1, 45.7], [22.9, 48.6]],
    source: "general",
  },
  {
    id: "chile",
    name: "Chile",
    atlasName: "Chile",
    exploreCountry: "Chile",
    overview: "A long, thin country squeezed between the Andes and the Pacific, with sunny valleys cooled by ocean breezes. It's known for good-value Cabernet Sauvignon and its own Carménère.",
    fitBounds: [[-75.7, -55.9], [-66.4, -17.5]],
    source: "general",
  },
  {
    id: "australia",
    name: "Australia",
    atlasName: "Australia",
    exploreCountry: "Australia",
    overview: "Warm, sunny and inventive, Australia made Shiraz world-famous with rich, ripe reds. Its cooler corners grow Riesling, Chardonnay and Pinot Noir.",
    fitBounds: [[113, -43.7], [153.7, -10.7]],
    source: "general",
  },
  {
    id: "new-zealand",
    name: "New Zealand",
    atlasName: "New Zealand",
    exploreCountry: "New Zealand",
    overview: "A cool, maritime country whose zesty Sauvignon Blanc took the world by storm. Pinot Noir from the South Island is its other star.",
    fitBounds: [[166.4, -47.3], [178.6, -34.4]],
    source: "general",
  },
  {
    id: "south-africa",
    name: "South Africa",
    atlasName: "South Africa",
    exploreCountry: "South Africa",
    overview: "Wine has been made at the southern tip of Africa since the 1600s, cooled by two oceans. Chenin Blanc is its most planted white, and Pinotage is its own red grape.",
    fitBounds: [[16.4, -34.9], [32.9, -22.1]],
    source: "general",
  },
];

export const MAP_REGIONS: readonly MapRegion[] = [
  // United States
  {
    id: "napa-sonoma",
    name: "Napa & Sonoma",
    countryId: "united-states",
    coords: [-122.4, 38.4],
    exploreRegion: "California",
    exploreLabel: "California",
    about: "Two neighboring valleys north of San Francisco that made California wine famous. Warm days give ripe fruit, while fog from the Pacific cools the nights.",
    climate: 4,
    climateLabel: "Warm, with cooling fog",
    grapes: ["Cabernet Sauvignon", "Chardonnay", "Pinot Noir", "Zinfandel"],
    styles: ["Full-bodied reds", "Oaked whites"],
    fact: "At the 1976 “Judgment of Paris,” Napa wines beat top French wines in a blind tasting.",
    source: "general",
  },
  {
    id: "willamette",
    name: "Willamette Valley",
    countryId: "united-states",
    coords: [-123.1, 45.0],
    exploreRegion: "Oregon",
    exploreLabel: "Oregon",
    about: "Oregon's main wine valley is cool and often rainy, at about the same latitude as Burgundy. That's why it's best known for Pinot Noir.",
    climate: 2,
    climateLabel: "Cool, with wet winters",
    grapes: ["Pinot Noir", "Pinot Gris", "Chardonnay"],
    styles: ["Light, elegant reds", "Crisp whites"],
    fact: "Burgundy producers have bought vineyards here because the conditions are so similar to home.",
    source: "general",
  },
  {
    id: "washington",
    name: "Washington",
    countryId: "united-states",
    coords: [-119.5, 46.3],
    exploreRegion: "Washington",
    about: "Most vineyards lie east of the Cascade Mountains, in dry, near-desert country watered by irrigation. Long summer days ripen the grapes fully, while cold nights keep their acidity.",
    climate: 3,
    climateLabel: "Dry, with sunny days and cold nights",
    grapes: ["Cabernet Sauvignon", "Merlot", "Syrah", "Riesling"],
    styles: ["Structured reds", "Off-dry Riesling"],
    fact: "It's the second-largest wine-producing state in the US, after California.",
    source: "general",
  },
  // Italy
  {
    id: "piedmont",
    name: "Piedmont",
    countryId: "italy",
    coords: [8.0, 44.7],
    exploreRegion: "Piedmont",
    about: "In Italy's northwest, at the foot of the Alps, fog rolls over the hills each autumn. Nebbiolo, named after that fog (nebbia), makes Barolo and Barbaresco.",
    climate: 2,
    climateLabel: "Cool to moderate, with foggy autumns",
    grapes: ["Nebbiolo", "Barbera", "Moscato"],
    styles: ["Tannic, age-worthy reds", "Sweet, fizzy Moscato d'Asti"],
    fact: "Barolo is nicknamed “the king of wines” and must age for at least three years before release.",
    source: "general",
  },
  {
    id: "tuscany",
    name: "Tuscany",
    countryId: "italy",
    coords: [11.2, 43.4],
    exploreRegion: "Tuscany",
    about: "Rolling hills in central Italy, home of Chianti, Brunello di Montalcino and the “Super Tuscans.” Sangiovese is the grape behind almost all of its classic reds.",
    climate: 4,
    climateLabel: "Warm and sunny, Mediterranean",
    grapes: ["Sangiovese", "Cabernet Sauvignon", "Merlot"],
    styles: ["Savory, high-acid reds", "Bold red blends"],
    fact: "Super Tuscans began in the 1970s, when winemakers broke the local rules to blend in French grapes.",
    source: "general",
  },
  {
    id: "veneto",
    name: "Veneto",
    countryId: "italy",
    coords: [11.9, 45.5],
    exploreRegion: "Veneto",
    about: "Northeast Italy, around Venice and Verona. It makes everything from fizzy Prosecco to Amarone, a powerful red made from grapes dried on mats for months.",
    climate: 3,
    climateLabel: "Moderate, cooled by the Alps and Lake Garda",
    grapes: ["Glera", "Corvina", "Garganega"],
    styles: ["Prosecco", "Amarone", "Soave"],
    fact: "Drying the grapes for Amarone takes about three to four months and shrinks them by roughly a third.",
    source: "general",
  },
  {
    id: "emilia-romagna",
    name: "Emilia-Romagna",
    countryId: "italy",
    coords: [11.0, 44.5],
    exploreRegion: "Emilia-Romagna",
    about: "Italy's food heartland, home of Parmigiano-Reggiano and prosciutto. Its signature wine is Lambrusco, a fizzy, fruity red made to cut through rich food.",
    climate: 3,
    climateLabel: "Moderate, on a broad river plain",
    grapes: ["Lambrusco", "Sangiovese", "Trebbiano"],
    styles: ["Sparkling red Lambrusco"],
    fact: "Lambrusco can be dry or sweet; look for “secco” on the label if you want it dry.",
    source: "general",
  },
  // France
  {
    id: "bordeaux",
    name: "Bordeaux",
    countryId: "france",
    coords: [-0.6, 44.8],
    exploreRegion: "Bordeaux",
    about: "Here the Gironde estuary splits the land in two. The Left Bank's gravel suits Cabernet Sauvignon and the Right Bank's clay suits Merlot, and most reds are blends of both.",
    climate: 3,
    climateLabel: "Moderate, maritime",
    grapes: ["Cabernet Sauvignon", "Merlot", "Cabernet Franc", "Sauvignon Blanc", "Sémillon"],
    styles: ["Red blends", "Sweet Sauternes", "Dry whites"],
    fact: "The 1855 classification still ranks the top Médoc châteaux, from First to Fifth Growth.",
    source: "general",
  },
  {
    id: "burgundy",
    name: "Burgundy",
    countryId: "france",
    coords: [4.8, 47.0],
    exploreRegion: "Burgundy",
    about: "A narrow strip of east-facing slopes where monks mapped the vineyards plot by plot centuries ago. Red Burgundy is Pinot Noir, and white Burgundy is Chardonnay.",
    climate: 2,
    climateLabel: "Cool, continental",
    grapes: ["Pinot Noir", "Chardonnay"],
    styles: ["Elegant reds", "Mineral whites", "Chablis"],
    fact: "Burgundy ranks its vineyards plot by plot: village, then Premier Cru, then Grand Cru at the top.",
    source: "general",
  },
  {
    id: "champagne",
    name: "Champagne",
    countryId: "france",
    coords: [4.0, 49.0],
    exploreRegion: "Champagne",
    about: "France's northernmost classic region, so cool that the grapes barely ripen, which suits sparkling wine perfectly. Only sparkling wine from here may be called Champagne.",
    climate: 1,
    climateLabel: "Cold, continental",
    grapes: ["Chardonnay", "Pinot Noir", "Pinot Meunier"],
    styles: ["Brut Champagne", "Blanc de blancs", "Rosé Champagne"],
    fact: "Miles of chalk cellars run beneath the towns of Reims and Épernay, keeping the bottles cool as they age.",
    source: "general",
  },
  {
    id: "rhone",
    name: "Rhône",
    countryId: "france",
    coords: [4.8, 44.6],
    exploreRegion: "Rhone",
    exploreLabel: "Rhône",
    about: "The Rhône River runs south from Lyon toward the Mediterranean. The steep, cooler north grows Syrah; the warm, sunny south makes generous blends like Châteauneuf-du-Pape.",
    climate: 4,
    climateLabel: "Moderate in the north, warm Mediterranean in the south",
    grapes: ["Syrah", "Grenache", "Mourvèdre", "Viognier"],
    styles: ["Peppery Syrah", "Grenache blends"],
    fact: "Châteauneuf-du-Pape allows thirteen different grape varieties in its blend.",
    source: "general",
  },
  {
    id: "loire",
    name: "Loire",
    countryId: "france",
    coords: [0.7, 47.3],
    exploreRegion: null,
    about: "France's longest river is lined with castles and vineyards for hundreds of miles. Cool and fresh, it's known for crisp whites like Sancerre and Vouvray.",
    climate: 2,
    climateLabel: "Cool, maritime to continental",
    grapes: ["Sauvignon Blanc", "Chenin Blanc", "Cabernet Franc", "Melon de Bourgogne"],
    styles: ["Crisp whites", "Light reds", "Sparkling Crémant"],
    fact: "Muscadet, made where the river meets the sea, is often aged “sur lie” for extra texture.",
    source: "general",
  },
  {
    id: "alsace",
    name: "Alsace",
    countryId: "france",
    coords: [7.3, 48.2],
    exploreRegion: "Alsace",
    about: "Tucked between the Vosges Mountains and the Rhine on the German border. The mountains block the rain, making it one of France's driest wine regions.",
    climate: 2,
    climateLabel: "Cool, but dry and sunny",
    grapes: ["Riesling", "Gewürztraminer", "Pinot Gris"],
    styles: ["Aromatic whites", "Late-harvest sweet wines"],
    fact: "Alsace is one of the few French regions that puts the grape's name on the label.",
    source: "general",
  },
  {
    id: "provence",
    name: "Provence",
    countryId: "france",
    coords: [6.0, 43.5],
    exploreRegion: "Provence",
    about: "Sunny southeastern France along the Mediterranean, scented with wild herbs. It's the world's most famous home of dry, pale rosé.",
    climate: 4,
    climateLabel: "Hot and dry, Mediterranean",
    grapes: ["Grenache", "Cinsault", "Mourvèdre"],
    styles: ["Pale, dry rosé"],
    fact: "Roughly nine in ten bottles from Provence are rosé.",
    source: "general",
  },
  // Germany
  {
    id: "mosel",
    name: "Mosel",
    countryId: "germany",
    coords: [6.9, 49.9],
    exploreRegion: "Mosel",
    about: "Vineyards cling to some of the world's steepest slopes along the winding Mosel River. Slate soils soak up the day's heat, helping Riesling ripen this far north.",
    climate: 1,
    climateLabel: "Cold, continental",
    grapes: ["Riesling"],
    styles: ["Light, low-alcohol Riesling", "Sweet Spätlese and Auslese"],
    fact: "Some slopes are so steep that the vines are tended entirely by hand, with tiny monorails to haul the grapes.",
    source: "general",
  },
  {
    id: "rheingau",
    name: "Rheingau",
    countryId: "germany",
    coords: [8.0, 50.0],
    exploreRegion: "Rheingau",
    about: "Here the Rhine turns west for a stretch, so the vineyards face south toward the sun. It makes fuller, often drier Rieslings than the Mosel.",
    climate: 2,
    climateLabel: "Cool, sheltered by the Taunus hills",
    grapes: ["Riesling", "Pinot Noir"],
    styles: ["Dry Riesling", "Sweet late-harvest Riesling"],
    fact: "Late-harvest wine was born at Schloss Johannisberg in 1775, when the messenger bringing permission to pick arrived weeks late.",
    source: "general",
  },
  // Portugal
  {
    id: "douro",
    name: "Douro",
    countryId: "portugal",
    coords: [-7.6, 41.2],
    exploreRegion: "Douro",
    about: "Steep terraced hills line the Douro River in northern Portugal, baking hot in summer. It's the home of Port and, more and more, of rich dry reds.",
    climate: 5,
    climateLabel: "Hot, dry summers",
    grapes: ["Touriga Nacional", "Touriga Franca", "Tinta Roriz"],
    styles: ["Port", "Dry red blends"],
    fact: "In 1756 the Douro became one of the world's first officially mapped wine regions.",
    source: "general",
  },
  {
    id: "madeira",
    name: "Madeira",
    countryId: "portugal",
    coords: [-16.95, 32.75],
    exploreRegion: "Madeira",
    about: "A subtropical island in the Atlantic, off the coast of Morocco. Its fortified wine is heated as it ages, which makes it almost indestructible once opened.",
    climate: 4,
    climateLabel: "Warm and humid, subtropical",
    grapes: ["Sercial", "Verdelho", "Bual", "Malmsey"],
    styles: ["Fortified Madeira, dry to sweet"],
    fact: "Madeira was the wine used to toast the US Declaration of Independence in 1776.",
    source: "general",
  },
  // Spain
  {
    id: "rioja",
    name: "Rioja",
    countryId: "spain",
    coords: [-2.5, 42.4],
    exploreRegion: "Rioja",
    about: "Spain's best-known red wine region, along the Ebro River in the north. Its reds are traditionally aged in American oak, which adds vanilla and coconut notes.",
    climate: 3,
    climateLabel: "Moderate, sheltered by mountains",
    grapes: ["Tempranillo", "Garnacha", "Graciano"],
    styles: ["Oak-aged reds: Crianza, Reserva, Gran Reserva"],
    fact: "A Gran Reserva red must age at least five years before release, two of them in oak.",
    source: "general",
  },
  {
    id: "ribera-del-duero",
    name: "Ribera del Duero",
    countryId: "spain",
    coords: [-3.8, 41.65],
    exploreRegion: "Castilla y Leon",
    exploreLabel: "Castilla y León",
    about: "A high plateau in Castilla y León with scorching days and icy nights. Tempranillo, called Tinto Fino here, makes dark, powerful reds.",
    climate: 4,
    climateLabel: "Extreme: hot days, cold nights",
    grapes: ["Tempranillo"],
    styles: ["Bold, structured reds"],
    fact: "Vega Sicilia, one of Spain's most famous wineries, has made wine here since the 1800s.",
    source: "general",
  },
  {
    id: "jerez",
    name: "Jerez",
    countryId: "spain",
    coords: [-6.1, 36.7],
    exploreRegion: "Andalusia",
    exploreLabel: "Andalusia",
    about: "The hot, chalky corner of Andalusia where Sherry is made. Some Sherries age under a layer of yeast called flor; others are exposed to air for nutty flavors.",
    climate: 5,
    climateLabel: "Hot, with Atlantic breezes",
    grapes: ["Palomino", "Pedro Ximénez", "Moscatel"],
    styles: ["Fino", "Amontillado", "Oloroso", "Sweet PX"],
    fact: "Sherry ages in a solera, a stack of barrels where younger wine is blended into older wine over many years.",
    source: "general",
  },
  // Canada
  {
    id: "niagara",
    name: "Niagara",
    countryId: "canada",
    coords: [-79.2, 43.1],
    exploreRegion: "Ontario",
    exploreLabel: "Ontario",
    about: "The Niagara Peninsula sits between Lake Ontario and Lake Erie, which keep its winters milder than you'd expect. It's famous for icewine from grapes frozen on the vine.",
    climate: 1,
    climateLabel: "Cold winters, softened by the lakes",
    grapes: ["Riesling", "Vidal", "Chardonnay", "Cabernet Franc"],
    styles: ["Icewine", "Crisp whites"],
    fact: "Icewine grapes are picked frozen solid, at −8 °C (17 °F) or colder, often in the middle of the night.",
    source: "general",
  },
  // Argentina
  {
    id: "mendoza",
    name: "Mendoza",
    countryId: "argentina",
    coords: [-68.8, -33.0],
    exploreRegion: "Mendoza",
    about: "About 70% of Argentina's wine comes from here, in high desert at the foot of the Andes. Snowmelt waters the vines, and strong sun with cool nights makes bold reds.",
    climate: 4,
    climateLabel: "Sunny and dry, at high altitude",
    grapes: ["Malbec", "Cabernet Sauvignon", "Torrontés"],
    styles: ["Rich Malbec"],
    fact: "Some vineyards sit more than 1,500 meters (about 5,000 feet) above sea level.",
    source: "general",
  },
  // Hungary
  {
    id: "tokaj",
    name: "Tokaj",
    countryId: "hungary",
    coords: [21.4, 48.1],
    exploreRegion: "Tokaj",
    about: "Hills in northeast Hungary where autumn mists encourage noble rot. The shriveled aszú grapes make Tokaji Aszú, a golden, honeyed sweet wine.",
    climate: 2,
    climateLabel: "Cool continental, with misty autumns",
    grapes: ["Furmint", "Hárslevelű"],
    styles: ["Tokaji Aszú", "Dry Furmint"],
    fact: "Tokaj's vineyards were classified in the 1700s, long before Bordeaux's famous 1855 ranking.",
    source: "general",
  },
  // Chile
  {
    id: "colchagua",
    name: "Colchagua",
    countryId: "chile",
    coords: [-71.2, -34.6],
    exploreRegion: "Colchagua Valley",
    exploreLabel: "Colchagua Valley",
    about: "A warm valley in Chile's Central Valley that opens west toward the Pacific. It's known for ripe, rich reds.",
    climate: 4,
    climateLabel: "Warm, Mediterranean",
    grapes: ["Cabernet Sauvignon", "Carménère", "Syrah"],
    styles: ["Full-bodied reds"],
    fact: "Carménère, wiped out in Bordeaux, was rediscovered in Chile in 1994, where it had been mistaken for Merlot.",
    source: "general",
  },
  // Australia
  {
    id: "barossa",
    name: "Barossa Valley",
    countryId: "australia",
    coords: [139.0, -34.5],
    exploreRegion: "South Australia",
    exploreLabel: "South Australia",
    about: "A warm valley in South Australia settled by German immigrants in the 1840s. Some of the world's oldest Shiraz vines still grow here.",
    climate: 4,
    climateLabel: "Warm and dry",
    grapes: ["Shiraz", "Grenache", "Riesling"],
    styles: ["Rich, ripe Shiraz"],
    fact: "Phylloxera never reached South Australia, so some vines here are more than 150 years old.",
    source: "general",
  },
  // New Zealand
  {
    id: "marlborough",
    name: "Marlborough",
    countryId: "new-zealand",
    coords: [173.8, -41.5],
    exploreRegion: "Marlborough",
    about: "The sunny northeast tip of the South Island, with cool nights and stony soils. Its punchy, tropical Sauvignon Blanc put New Zealand on the wine map.",
    climate: 2,
    climateLabel: "Cool and sunny",
    grapes: ["Sauvignon Blanc", "Pinot Noir"],
    styles: ["Zesty Sauvignon Blanc"],
    fact: "The first Sauvignon Blanc vines here were planted only in the 1970s.",
    source: "general",
  },
  // South Africa
  {
    id: "stellenbosch",
    name: "Stellenbosch",
    countryId: "south-africa",
    coords: [18.86, -33.93],
    exploreRegion: "Western Cape",
    exploreLabel: "Western Cape",
    about: "Mountains and valleys near Cape Town, cooled by breezes off False Bay. It's South Africa's best-known region for reds.",
    climate: 3,
    climateLabel: "Warm, cooled by the ocean",
    grapes: ["Cabernet Sauvignon", "Pinotage", "Chenin Blanc"],
    styles: ["Red blends", "Pinotage"],
    fact: "Pinotage was created at Stellenbosch University in 1925 by crossing Pinot Noir with Cinsault.",
    source: "general",
  },
];

const COUNTRY_BY_ID = new Map(MAP_COUNTRIES.map((country) => [country.id, country]));
const REGION_BY_ID = new Map(MAP_REGIONS.map((region) => [region.id, region]));

export function countryById(id: string): MapCountry | undefined {
  return COUNTRY_BY_ID.get(id);
}

export function regionById(id: string): MapRegion | undefined {
  return REGION_BY_ID.get(id);
}

export function regionsOf(countryId: string): MapRegion[] {
  return MAP_REGIONS.filter((region) => region.countryId === countryId);
}

// Key Grapes names Syrah "Syrah / Shiraz"; regions use whichever name is local.
const KEY_GRAPE_ALIASES: Record<string, string> = { Syrah: "syrah", Shiraz: "syrah" };

export function keyGrapeId(name: string): string | null {
  return GRAPES.find((grape) => grape.name === name)?.id ?? KEY_GRAPE_ALIASES[name] ?? null;
}
```

- [ ] **Step 6: Run to verify they pass**

Run: `npx vitest run src/content/learn/regions`
Expected: PASS (all three files).

- [ ] **Step 7: Commit**

```bash
git add src/content/learn/regions.ts src/content/learn/regions.test.ts src/content/learn/regions.dataset.test.ts src/content/learn/regions.geo.test.ts
git commit -m "feat(learn): add the wine regions content

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Then run the UTF-8 check.

---

### Task 5: Map geometry

**Files:**
- Create: `src/components/learn/regions/geo.ts`
- Test: `src/components/learn/regions/geo.test.ts`

**Interfaces:**
- Consumes: `mapData.json?raw` (Task 3); `MapCountry`, `LonLat`, `MAP_COUNTRIES`, `MAP_REGIONS`, `countryById` (Task 4).
- Produces:
  - `MAP_WIDTH = 1200`, `MAP_HEIGHT = 600`, `MAX_ZOOM = 12`, `DRAWER_INSET = 0.32`
  - `type CountryFeature = Feature<Geometry, { name: string }>`
  - `WORLD_FEATURES: CountryFeature[]` (1:110m, no Antarctica)
  - `detailFeature(atlasName: string): CountryFeature | undefined` (1:50m)
  - `pathFor(feature): string`; `GRATICULE_PATH: string`; `US_STATE_LINES_PATH: string` (interior state borders)
  - `projectPoint(lonLat: LonLat): [number, number]`
  - `type Box = readonly [readonly [number, number], readonly [number, number]]`; `projectedBox(fitBounds): Box`
  - `interface Viewport { x: number; y: number; width: number; height: number }`; `interface ZoomTransform { k: number; tx: number; ty: number }`; `IDENTITY: ZoomTransform`
  - `fitTransform(box: Box, viewport: Viewport, maxScale = MAX_ZOOM, padding = 0.85): ZoomTransform`
  - `countryTransform(country: MapCountry, inset: boolean): ZoomTransform` — fits `country.fitBounds` into the full map, or into its left `1 - DRAWER_INSET` when `inset`.

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/learn/regions/geo.test.ts`
Expected: FAIL — cannot resolve `./geo`.

- [ ] **Step 3: Implement** — `src/components/learn/regions/geo.ts`

```ts
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/components/learn/regions/geo.test.ts`
Expected: PASS.

- [ ] **Step 5: Type-check**

Run: `npm run build`
Expected: succeeds (catches any `@types/geojson` / `topojson-specification` import issue; both come with the `@types` packages from Task 3).

- [ ] **Step 6: Commit**

```bash
git add src/components/learn/regions/geo.ts src/components/learn/regions/geo.test.ts
git commit -m "feat(learn): add map projection and zoom geometry

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Live counts and map selection hooks

**Files:**
- Create: `src/components/learn/regions/useCatalogCount.ts`, `src/components/learn/regions/useMapSelection.ts`
- Test: `src/components/learn/regions/useCatalogCount.test.tsx`, `src/components/learn/regions/useMapSelection.test.tsx`

**Interfaces:**
- Consumes: `listWines` (`services/api`, with Task 2's `region` param); `countryById`, `regionById` (Task 4).
- Produces:
  - `type CountFilter = { country: string } | { region: string }`
  - `useCatalogCount(filter: CountFilter | null): number | null` — `listWines({ ...filter, limit: 1 }).total`; `null` while loading, on error, or for a `null` filter; cached per filter for the session; stale responses ignored.
  - `clearCatalogCountCache(): void` (tests)
  - `interface MapSelection { countryId: string | null; regionId: string | null }`; `WORLD: MapSelection`
  - `selectionFromHash(hash: string): MapSelection | null` — `#country-<known>` / `#region-<known>` (region implies its country); else `null`
  - `hashFor(selection: MapSelection): string` — `#region-<id>`, `#country-<id>`, or `#regions`
  - `useMapSelection(): { selection; selectCountry(id); selectRegion(id); showWorld(); stepBack() }` — initial state from the hash; each change replaces the hash (keeping pathname/search); on a `POP` navigation to a country/region hash, follows it; `stepBack`: region → its country → world.

- [ ] **Step 1: Write the failing count test** — `src/components/learn/regions/useCatalogCount.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import * as api from "../../../services/api";
import { clearCatalogCountCache, useCatalogCount, type CountFilter } from "./useCatalogCount";

vi.mock("../../../services/api", async () => {
  const actual = await vi.importActual<typeof import("../../../services/api")>("../../../services/api");
  return { ...actual, listWines: vi.fn() };
});

function Probe({ filter }: { filter: CountFilter | null }) {
  const count = useCatalogCount(filter);
  return <p data-testid="count">{count === null ? "none" : String(count)}</p>;
}

const text = () => screen.getByTestId("count").textContent;

beforeEach(() => {
  clearCatalogCountCache();
  vi.mocked(api.listWines).mockReset();
});

describe("useCatalogCount", () => {
  it("is null while loading, then the total", async () => {
    vi.mocked(api.listWines).mockResolvedValue({ total: 13, items: [] });
    render(<Probe filter={{ region: "Bordeaux" }} />);
    expect(text()).toBe("none");
    expect(await screen.findByText("13")).toBeInTheDocument();
    expect(api.listWines).toHaveBeenCalledWith({ region: "Bordeaux", limit: 1 });
  });

  it("asks by country too", async () => {
    vi.mocked(api.listWines).mockResolvedValue({ total: 30, items: [] });
    render(<Probe filter={{ country: "France" }} />);
    expect(await screen.findByText("30")).toBeInTheDocument();
    expect(api.listWines).toHaveBeenCalledWith({ country: "France", limit: 1 });
  });

  it("stays null on error", async () => {
    vi.mocked(api.listWines).mockRejectedValue(new Error("down"));
    render(<Probe filter={{ region: "Bordeaux" }} />);
    await act(async () => {});
    expect(text()).toBe("none");
  });

  it("does nothing for a null filter", () => {
    render(<Probe filter={null} />);
    expect(text()).toBe("none");
    expect(api.listWines).not.toHaveBeenCalled();
  });

  it("reuses a cached count without asking again", async () => {
    vi.mocked(api.listWines).mockResolvedValue({ total: 13, items: [] });
    const first = render(<Probe filter={{ region: "Bordeaux" }} />);
    await screen.findByText("13");
    first.unmount();
    render(<Probe filter={{ region: "Bordeaux" }} />);
    expect(text()).toBe("13");
    expect(api.listWines).toHaveBeenCalledTimes(1);
  });

  it("ignores a response for a filter it has moved on from", async () => {
    let resolveFirst!: (value: { total: number; items: [] }) => void;
    vi.mocked(api.listWines)
      .mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))
      .mockResolvedValueOnce({ total: 4, items: [] });
    const view = render(<Probe filter={{ region: "Bordeaux" }} />);
    view.rerender(<Probe filter={{ region: "Burgundy" }} />);
    expect(await screen.findByText("4")).toBeInTheDocument();
    await act(async () => resolveFirst({ total: 13, items: [] }));
    expect(text()).toBe("4");
  });
});
```

- [ ] **Step 2: Write the failing selection test** — `src/components/learn/regions/useMapSelection.test.tsx`

```tsx
import { describe, it, expect } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate, useNavigationType } from "react-router-dom";
import { hashFor, selectionFromHash, useMapSelection } from "./useMapSelection";

let api: ReturnType<typeof useMapSelection>;
let navigateProbe: ReturnType<typeof useNavigate>;

function Harness() {
  api = useMapSelection();
  navigateProbe = useNavigate();
  const location = useLocation();
  const type = useNavigationType();
  return (
    <>
      <p data-testid="selection">
        {api.selection.countryId ?? "-"}/{api.selection.regionId ?? "-"}
      </p>
      <p data-testid="location">
        {location.pathname}
        {location.search}
        {location.hash} {type}
      </p>
    </>
  );
}

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Harness />
    </MemoryRouter>
  );
}

const selection = () => screen.getByTestId("selection").textContent;
const location = () => screen.getByTestId("location").textContent;

describe("selectionFromHash / hashFor", () => {
  it("reads country and region hashes", () => {
    expect(selectionFromHash("#country-france")).toEqual({ countryId: "france", regionId: null });
    expect(selectionFromHash("#region-bordeaux")).toEqual({ countryId: "france", regionId: "bordeaux" });
  });

  it("ignores anything else", () => {
    expect(selectionFromHash("")).toBeNull();
    expect(selectionFromHash("#regions")).toBeNull();
    expect(selectionFromHash("#country-atlantis")).toBeNull();
    expect(selectionFromHash("#region-atlantis")).toBeNull();
    expect(selectionFromHash("#grape-merlot")).toBeNull();
  });

  it("writes hashes", () => {
    expect(hashFor({ countryId: null, regionId: null })).toBe("#regions");
    expect(hashFor({ countryId: "italy", regionId: null })).toBe("#country-italy");
    expect(hashFor({ countryId: "italy", regionId: "tuscany" })).toBe("#region-tuscany");
  });
});

describe("useMapSelection", () => {
  it("starts from the hash, or the world", () => {
    renderAt("/learn#region-mosel");
    expect(selection()).toBe("germany/mosel");
  });

  it("starts at the world for an unknown hash", () => {
    renderAt("/learn#country-atlantis");
    expect(selection()).toBe("-/-");
  });

  it("replaces the hash as the selection changes, keeping the query", () => {
    renderAt("/learn?x=1");
    act(() => api.selectCountry("italy"));
    expect(selection()).toBe("italy/-");
    expect(location()).toBe("/learn?x=1#country-italy REPLACE");
    act(() => api.selectRegion("bordeaux"));
    expect(selection()).toBe("france/bordeaux");
    expect(location()).toBe("/learn?x=1#region-bordeaux REPLACE");
    act(() => api.showWorld());
    expect(selection()).toBe("-/-");
    expect(location()).toBe("/learn?x=1#regions REPLACE");
  });

  it("steps back from a region to its country, then to the world", () => {
    renderAt("/learn#region-bordeaux");
    act(() => api.stepBack());
    expect(selection()).toBe("france/-");
    act(() => api.stepBack());
    expect(selection()).toBe("-/-");
  });

  it("follows Back and Forward to a map hash, ignores other hashes", () => {
    renderAt("/learn#country-spain");
    act(() => navigateProbe({ hash: "#grape-merlot" }));
    expect(selection()).toBe("spain/-");
    act(() => navigateProbe({ hash: "#region-tokaj" }));
    act(() => navigateProbe({ hash: "#vine" }));
    act(() => navigateProbe(-1));
    expect(selection()).toBe("hungary/tokaj");
  });
});
```

Note: a `navigateProbe({ hash })` push is not a POP, so the map ignores it; `navigateProbe(-1)` is a POP to `#region-tokaj`.

- [ ] **Step 3: Run to verify they fail**

Run: `npx vitest run src/components/learn/regions/useCatalogCount.test.tsx src/components/learn/regions/useMapSelection.test.tsx`
Expected: FAIL — cannot resolve the modules.

- [ ] **Step 4: Implement** — `src/components/learn/regions/useCatalogCount.ts`

```ts
import { useEffect, useState } from "react";
import { listWines } from "../../../services/api";

export type CountFilter = { country: string } | { region: string };

// Counts don't change while someone reads the page, so each filter is fetched once per session.
const cache = new Map<string, number>();

export function clearCatalogCountCache(): void {
  cache.clear();
}

function keyOf(filter: CountFilter): string {
  return "country" in filter ? `country:${filter.country}` : `region:${filter.region}`;
}

export function useCatalogCount(filter: CountFilter | null): number | null {
  const key = filter ? keyOf(filter) : null;
  const [loaded, setLoaded] = useState<{ key: string; count: number } | null>(null);

  useEffect(() => {
    if (!filter || !key || cache.has(key)) return;
    let active = true;
    listWines({ ...filter, limit: 1 })
      .then((response) => {
        cache.set(key, response.total);
        if (active) setLoaded({ key, count: response.total });
      })
      .catch(() => {
        // No count is fine; the link still works.
      });
    return () => {
      active = false;
    };
    // `key` captures everything about `filter` that matters; a new object with the same filter shouldn't refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!key) return null;
  if (cache.has(key)) return cache.get(key)!;
  return loaded?.key === key ? loaded.count : null;
}
```

- [ ] **Step 5: Implement** — `src/components/learn/regions/useMapSelection.ts`

```ts
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useNavigationType } from "react-router-dom";
import { countryById, regionById } from "../../../content/learn/regions";

export interface MapSelection {
  countryId: string | null;
  regionId: string | null;
}

export const WORLD: MapSelection = { countryId: null, regionId: null };

export function selectionFromHash(hash: string): MapSelection | null {
  const country = /^#country-(.+)$/.exec(hash);
  if (country && countryById(country[1])) return { countryId: country[1], regionId: null };
  const region = /^#region-(.+)$/.exec(hash);
  const match = region ? regionById(region[1]) : undefined;
  return match ? { countryId: match.countryId, regionId: match.id } : null;
}

export function hashFor({ countryId, regionId }: MapSelection): string {
  if (regionId) return `#region-${regionId}`;
  if (countryId) return `#country-${countryId}`;
  return "#regions";
}

export function useMapSelection() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const navigate = useNavigate();
  const [selection, setSelection] = useState<MapSelection>(() => selectionFromHash(location.hash) ?? WORLD);

  // Back/Forward to a map hash drives the map; other hashes (grapes, glossary, chapters) leave it alone.
  useEffect(() => {
    if (navigationType !== "POP") return;
    const next = selectionFromHash(location.hash);
    if (next) setSelection(next);
  }, [location.hash, navigationType]);

  function go(next: MapSelection) {
    setSelection(next);
    // Replace, like the grape picker, so exploring the map doesn't fill the back button.
    navigate({ pathname: location.pathname, search: location.search, hash: hashFor(next) }, { replace: true });
  }

  return {
    selection,
    selectCountry: (id: string) => go({ countryId: id, regionId: null }),
    selectRegion: (id: string) => {
      const region = regionById(id);
      if (region) go({ countryId: region.countryId, regionId: region.id });
    },
    showWorld: () => go(WORLD),
    stepBack: () => go(selection.regionId ? { countryId: selection.countryId, regionId: null } : WORLD),
  };
}
```

(If the repo has no ESLint config, drop the `eslint-disable-next-line` comment but keep the explanatory one.)

- [ ] **Step 6: Run to verify they pass**

Run: `npx vitest run src/components/learn/regions/useCatalogCount.test.tsx src/components/learn/regions/useMapSelection.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/learn/regions/useCatalogCount.ts src/components/learn/regions/useCatalogCount.test.tsx src/components/learn/regions/useMapSelection.ts src/components/learn/regions/useMapSelection.test.tsx
git commit -m "feat(learn): add map selection and catalog count hooks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Country chips, climate scale and the region drawer

**Files:**
- Create: `src/components/learn/regions/CountryChips.tsx`, `ClimateScale.tsx`, `RegionDrawer.tsx`
- Modify: `src/components/learn/learn.css` (drawer styles)
- Test: `src/components/learn/regions/CountryChips.test.tsx`, `ClimateScale.test.tsx`, `RegionDrawer.test.tsx`

**Interfaces:**
- Consumes: Task 4 content (`MAP_COUNTRIES`, `countryById`, `regionById`, `regionsOf`, `keyGrapeId`, `Climate`); Task 6 `useCatalogCount`, `clearCatalogCountCache`.
- Produces:
  - `CountryChips({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string) => void })` — `role="group"` labelled "Wine countries", 13 buttons with `aria-pressed`
  - `ClimateScale({ value, label }: { value: Climate; label: string })`
  - `RegionDrawer(props: RegionDrawerProps)` with `interface RegionDrawerProps { countryId: string; regionId: string | null; headingRef: RefObject<HTMLHeadingElement>; onClose: () => void; onSelectRegion: (id: string) => void; onBackToCountry: () => void }` — an `<aside aria-label="<name> details" class="region-drawer …">`

Drawer copy rules:
- Country view: eyebrow "Country"; `<h3>` name; overview; "Regions" label; one button per region: name + "`N` in catalog" (live count) or "—" (no `exploreRegion`, loading, or zero); link "Explore `N` wines from `<name>` →" (`/explore?country=<encoded exploreCountry>`), "Explore wines from `<name>` →" before the count loads.
- Region view: eyebrow "`<country>` · Region"; `<h3>` name; about; "Climate" + `ClimateScale`; "Key grapes" chips (a grape with a `keyGrapeId` is an `<a href="#grape-<id>">`, others plain text); "Signature styles" chips; "Worth knowing" + fact; then — with `label = exploreLabel ?? name` — the link "Explore `N` `<label>` wine(s) →" (`/explore?region=<encoded exploreRegion>`; "Explore `<label>` wines →" before the count loads), or "No `<name>` wines in the catalog yet." when `exploreRegion` is null or the count is 0; finally a button "← All of `<country>`".
- Both views: a close button (`aria-label="Close details"`, text `×`) top-right.

- [ ] **Step 1: Write the failing tests**

`src/components/learn/regions/CountryChips.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CountryChips } from "./CountryChips";

describe("CountryChips", () => {
  it("lists the 13 countries in order with one pressed", () => {
    render(<CountryChips selectedId="france" onSelect={vi.fn()} />);
    const chips = within(screen.getByRole("group", { name: "Wine countries" })).getAllByRole("button");
    expect(chips.map((chip) => chip.textContent)).toEqual([
      "United States",
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
    ]);
    expect(chips.filter((chip) => chip.getAttribute("aria-pressed") === "true").map((chip) => chip.textContent)).toEqual(["France"]);
  });

  it("selects on click", async () => {
    const onSelect = vi.fn();
    render(<CountryChips selectedId={null} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("button", { name: "New Zealand" }));
    expect(onSelect).toHaveBeenCalledWith("new-zealand");
  });
});
```

`src/components/learn/regions/ClimateScale.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClimateScale } from "./ClimateScale";

describe("ClimateScale", () => {
  it("announces the climate and marks one of five steps", () => {
    const { container } = render(<ClimateScale value={2} label="Cool, continental" />);
    expect(screen.getByText("Climate: Cool, continental, 2 of 5 from cool to hot")).toHaveClass("sr-only");
    const steps = container.querySelectorAll("[data-step]");
    expect(steps).toHaveLength(5);
    expect(Array.from(steps).map((step) => step.hasAttribute("data-active"))).toEqual([false, true, false, false, false]);
  });
});
```

`src/components/learn/regions/RegionDrawer.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRef } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import * as api from "../../../services/api";
import type { ListWinesParams } from "../../../types/wine";
import { RegionDrawer } from "./RegionDrawer";
import { clearCatalogCountCache } from "./useCatalogCount";

vi.mock("../../../services/api", async () => {
  const actual = await vi.importActual<typeof import("../../../services/api")>("../../../services/api");
  return { ...actual, listWines: vi.fn() };
});

const TOTALS: Record<string, number> = { "region:Bordeaux": 13, "region:Provence": 0, "region:California": 32, "country:France": 30 };

beforeEach(() => {
  clearCatalogCountCache();
  vi.mocked(api.listWines).mockImplementation(async (params: ListWinesParams = {}) => {
    const key = params.region ? `region:${params.region}` : `country:${params.country}`;
    return { total: TOTALS[key] ?? 1, items: [] };
  });
});

function renderDrawer(countryId: string, regionId: string | null) {
  const handlers = { onClose: vi.fn(), onSelectRegion: vi.fn(), onBackToCountry: vi.fn() };
  const headingRef = createRef<HTMLHeadingElement>();
  render(
    <MemoryRouter>
      <RegionDrawer countryId={countryId} regionId={regionId} headingRef={headingRef} {...handlers} />
    </MemoryRouter>
  );
  return { ...handlers, headingRef };
}

describe("RegionDrawer — country view", () => {
  it("shows the overview, the regions with live counts, and a country link", async () => {
    const { headingRef } = renderDrawer("france", null);
    const drawer = screen.getByRole("complementary", { name: "France details" });
    expect(within(drawer).getByRole("heading", { level: 3, name: "France" })).toBe(headingRef.current);
    expect(screen.getByText(/benchmark for much of the wine world/)).toBeInTheDocument();
    const rows = within(screen.getByRole("list")).getAllByRole("button");
    expect(rows.map((row) => row.querySelector("[data-name]")!.textContent)).toEqual([
      "Bordeaux",
      "Burgundy",
      "Champagne",
      "Rhône",
      "Loire",
      "Alsace",
      "Provence",
    ]);
    expect(await within(rows[0]).findByText("13 in catalog")).toBeInTheDocument();
    expect(within(rows[4]).getByText("—")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Explore 30 wines from France" })).toHaveAttribute("href", "/explore?country=France");
  });

  it("selects a region from the list and closes", async () => {
    const { onSelectRegion, onClose } = renderDrawer("france", null);
    await userEvent.click(screen.getByRole("button", { name: /Bordeaux/ }));
    expect(onSelectRegion).toHaveBeenCalledWith("bordeaux");
    await userEvent.click(screen.getByRole("button", { name: "Close details" }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("RegionDrawer — region view", () => {
  it("shows Bordeaux in full", async () => {
    renderDrawer("france", "bordeaux");
    expect(screen.getByRole("complementary", { name: "Bordeaux details" })).toBeInTheDocument();
    expect(screen.getByText("France · Region")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Bordeaux" })).toBeInTheDocument();
    expect(screen.getByText(/Gironde estuary/)).toBeInTheDocument();
    expect(screen.getByText("Climate: Moderate, maritime, 3 of 5 from cool to hot")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cabernet Sauvignon" })).toHaveAttribute("href", "#grape-cabernet-sauvignon");
    expect(screen.getByText("Cabernet Franc")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Cabernet Franc" })).not.toBeInTheDocument();
    expect(screen.getByText("Sweet Sauternes")).toBeInTheDocument();
    expect(screen.getByText(/1855 classification/)).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Explore 13 Bordeaux wines" })).toHaveAttribute("href", "/explore?region=Bordeaux");
  });

  it("uses the catalog's wording and encodes the region", async () => {
    renderDrawer("united-states", "napa-sonoma");
    expect(screen.getByRole("link", { name: "Explore California wines" })).toHaveAttribute("href", "/explore?region=California");
    expect(await screen.findByRole("link", { name: "Explore 32 California wines" })).toBeInTheDocument();
  });

  it("encodes spaces as %20", () => {
    renderDrawer("spain", "ribera-del-duero");
    expect(screen.getByRole("link", { name: /Castilla y León wine/ })).toHaveAttribute("href", "/explore?region=Castilla%20y%20Leon");
  });

  it("says so when the catalog has none", async () => {
    renderDrawer("france", "loire");
    expect(screen.getByText("No Loire wines in the catalog yet.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Explore/ })).not.toBeInTheDocument();
  });

  it("says so when the count comes back zero", async () => {
    renderDrawer("france", "provence");
    expect(await screen.findByText("No Provence wines in the catalog yet.")).toBeInTheDocument();
  });

  it("goes back to the country", async () => {
    const { onBackToCountry } = renderDrawer("france", "bordeaux");
    await userEvent.click(screen.getByRole("button", { name: "All of France" }));
    expect(onBackToCountry).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/components/learn/regions/CountryChips.test.tsx src/components/learn/regions/ClimateScale.test.tsx src/components/learn/regions/RegionDrawer.test.tsx`
Expected: FAIL — cannot resolve the components.

- [ ] **Step 3: Implement** — `src/components/learn/regions/CountryChips.tsx`

```tsx
import { MAP_COUNTRIES } from "../../../content/learn/regions";

interface CountryChipsProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

// A non-map way in: easy to tap (tiny countries included) and fully keyboard-friendly.
export function CountryChips({ selectedId, onSelect }: CountryChipsProps) {
  return (
    <div role="group" aria-label="Wine countries" className="flex items-center gap-2 overflow-x-auto py-1">
      {MAP_COUNTRIES.map((country) => {
        const pressed = country.id === selectedId;
        return (
          <button
            key={country.id}
            type="button"
            aria-pressed={pressed}
            onClick={() => onSelect(country.id)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
              pressed ? "border-accent text-accent" : "border-surface-border text-ink-muted hover:text-ink"
            }`}
          >
            {country.name}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Implement** — `src/components/learn/regions/ClimateScale.tsx`

```tsx
import type { Climate } from "../../../content/learn/regions";

const STEPS = [1, 2, 3, 4, 5] as const;

export function ClimateScale({ value, label }: { value: Climate; label: string }) {
  return (
    <div className="mt-2">
      <p className="sr-only">
        Climate: {label}, {value} of 5 from cool to hot
      </p>
      <div aria-hidden="true" className="flex items-center gap-2 text-xs text-ink-muted">
        <span>Cool</span>
        <div className="flex flex-1 gap-1">
          {STEPS.map((step) => (
            <span
              key={step}
              data-step={step}
              data-active={step === value ? "" : undefined}
              className={`h-1.5 flex-1 rounded-full ${step === value ? "bg-accent" : "bg-surface-border"}`}
            />
          ))}
        </div>
        <span>Hot</span>
      </div>
      <p aria-hidden="true" className="mt-1 text-xs text-ink-muted">
        {label}
      </p>
    </div>
  );
}
```

- [ ] **Step 5: Implement** — `src/components/learn/regions/RegionDrawer.tsx`

```tsx
import type { ReactNode, RefObject } from "react";
import { Link } from "react-router-dom";
import {
  countryById,
  keyGrapeId,
  regionById,
  regionsOf,
  type MapCountry,
  type MapRegion,
} from "../../../content/learn/regions";
import { ClimateScale } from "./ClimateScale";
import { useCatalogCount } from "./useCatalogCount";

export interface RegionDrawerProps {
  countryId: string;
  regionId: string | null;
  headingRef: RefObject<HTMLHeadingElement>;
  onClose: () => void;
  onSelectRegion: (id: string) => void;
  onBackToCountry: () => void;
}

const LABEL = "mt-4 text-xs uppercase tracking-[0.18em] text-ink-muted";
const CHIP = "rounded-full border px-2.5 py-0.5 text-xs";
const EXPLORE =
  "mt-5 inline-block rounded border border-accent px-4 py-2 text-sm font-semibold text-accent hover:bg-accent hover:text-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function RegionDrawer({ countryId, regionId, headingRef, onClose, onSelectRegion, onBackToCountry }: RegionDrawerProps) {
  const country = countryById(countryId);
  const region = regionId ? regionById(regionId) : undefined;
  if (!country) return null;
  const title = region?.name ?? country.name;

  return (
    <aside
      aria-label={`${title} details`}
      className="region-drawer overflow-y-auto rounded-lg border border-surface-border bg-surface-raised p-5 shadow-2xl"
    >
      <button
        type="button"
        aria-label="Close details"
        onClick={onClose}
        className="float-right -mr-1 -mt-1 text-2xl leading-none text-ink-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        ×
      </button>
      {region ? (
        <RegionView country={country} region={region} headingRef={headingRef} onBackToCountry={onBackToCountry} />
      ) : (
        <CountryView country={country} headingRef={headingRef} onSelectRegion={onSelectRegion} />
      )}
    </aside>
  );
}

function Heading({ eyebrow, headingRef, children }: { eyebrow: string; headingRef: RefObject<HTMLHeadingElement>; children: ReactNode }) {
  return (
    <>
      <p className="text-xs uppercase tracking-[0.18em] text-ink-muted">{eyebrow}</p>
      <h3 ref={headingRef} tabIndex={-1} className="mt-1 font-serif text-2xl text-ink focus:outline-none">
        {children}
      </h3>
    </>
  );
}

function CountryView({
  country,
  headingRef,
  onSelectRegion,
}: {
  country: MapCountry;
  headingRef: RefObject<HTMLHeadingElement>;
  onSelectRegion: (id: string) => void;
}) {
  const count = useCatalogCount({ country: country.exploreCountry });
  return (
    <>
      <Heading eyebrow="Country" headingRef={headingRef}>
        {country.name}
      </Heading>
      <p className="mt-2 text-sm leading-relaxed text-ink">{country.overview}</p>
      <p className={LABEL}>Regions</p>
      <ul className="mt-1">
        {regionsOf(country.id).map((region) => (
          <RegionRow key={region.id} region={region} onSelect={() => onSelectRegion(region.id)} />
        ))}
      </ul>
      <Link to={`/explore?country=${encodeURIComponent(country.exploreCountry)}`} className={EXPLORE}>
        {count ? `Explore ${count} wines from ${country.name}` : `Explore wines from ${country.name}`}{" "}
        <span aria-hidden="true">→</span>
      </Link>
    </>
  );
}

function RegionRow({ region, onSelect }: { region: MapRegion; onSelect: () => void }) {
  const count = useCatalogCount(region.exploreRegion ? { region: region.exploreRegion } : null);
  return (
    <li className="border-b border-surface-border">
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full items-center justify-between py-2 text-left text-sm text-ink hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        <span data-name="">{region.name}</span>
        <span className="text-xs text-ink-muted">{count ? `${count} in catalog` : "—"}</span>
      </button>
    </li>
  );
}

function RegionView({
  country,
  region,
  headingRef,
  onBackToCountry,
}: {
  country: MapCountry;
  region: MapRegion;
  headingRef: RefObject<HTMLHeadingElement>;
  onBackToCountry: () => void;
}) {
  const count = useCatalogCount(region.exploreRegion ? { region: region.exploreRegion } : null);
  const label = region.exploreLabel ?? region.name;
  const none = !region.exploreRegion || count === 0;

  return (
    <>
      <Heading eyebrow={`${country.name} · Region`} headingRef={headingRef}>
        {region.name}
      </Heading>
      <p className="mt-2 text-sm leading-relaxed text-ink">{region.about}</p>
      <p className={LABEL}>Climate</p>
      <ClimateScale value={region.climate} label={region.climateLabel} />
      <p className={LABEL}>Key grapes</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {region.grapes.map((grape) => {
          const id = keyGrapeId(grape);
          return id ? (
            <a key={grape} href={`#grape-${id}`} className={`${CHIP} border-accent text-accent hover:underline`}>
              {grape}
            </a>
          ) : (
            <span key={grape} className={`${CHIP} border-surface-border text-ink`}>
              {grape}
            </span>
          );
        })}
      </div>
      <p className={LABEL}>Signature styles</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {region.styles.map((style) => (
          <span key={style} className={`${CHIP} border-surface-border text-ink`}>
            {style}
          </span>
        ))}
      </div>
      <p className={LABEL}>Worth knowing</p>
      <p className="mt-1 text-sm leading-relaxed text-ink">{region.fact}</p>
      {none ? (
        <p className="mt-5 text-sm text-ink-muted">No {region.name} wines in the catalog yet.</p>
      ) : (
        <Link to={`/explore?region=${encodeURIComponent(region.exploreRegion!)}`} className={EXPLORE}>
          {count ? `Explore ${count} ${label} ${count === 1 ? "wine" : "wines"}` : `Explore ${label} wines`}{" "}
          <span aria-hidden="true">→</span>
        </Link>
      )}
      <p className="mt-4">
        <button
          type="button"
          onClick={onBackToCountry}
          className="text-sm text-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          <span aria-hidden="true">← </span>All of {country.name}
        </button>
      </p>
    </>
  );
}
```

- [ ] **Step 6: Add the drawer styles** — append to `src/components/learn/learn.css`

```css
/*
 * Wine Regions drawer. On phones it sits below the map (the map is too short to cover);
 * from md up it floats over the map's right edge. It slides in except under reduced motion.
 */
.region-drawer {
  position: relative;
  margin-top: 0.75rem;
  max-height: 70vh;
}

@media (min-width: 768px) {
  .region-drawer {
    position: absolute;
    top: 0.875rem;
    right: 0.875rem;
    bottom: 0.875rem;
    z-index: 3;
    width: 340px;
    max-height: none;
    margin-top: 0;
  }
}

@media (prefers-reduced-motion: no-preference) {
  .region-drawer {
    animation: region-drawer-up 0.45s cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }

  @media (min-width: 768px) {
    .region-drawer {
      animation-name: region-drawer-in;
    }
  }
}

@keyframes region-drawer-in {
  from {
    transform: translateX(calc(100% + 1rem));
  }
  to {
    transform: none;
  }
}

@keyframes region-drawer-up {
  from {
    opacity: 0;
    transform: translateY(1.5rem);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
```

- [ ] **Step 7: Run to verify they pass**

Run: `npx vitest run src/components/learn/regions/CountryChips.test.tsx src/components/learn/regions/ClimateScale.test.tsx src/components/learn/regions/RegionDrawer.test.tsx`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/learn/regions/CountryChips.tsx src/components/learn/regions/CountryChips.test.tsx src/components/learn/regions/ClimateScale.tsx src/components/learn/regions/ClimateScale.test.tsx src/components/learn/regions/RegionDrawer.tsx src/components/learn/regions/RegionDrawer.test.tsx src/components/learn/learn.css
git commit -m "feat(learn): add the country chips, climate scale and region drawer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Then run the UTF-8 check.

---

### Task 8: The map

**Files:**
- Create: `src/components/learn/regions/RegionsMap.tsx`
- Modify: `src/components/learn/learn.css` (map styles)
- Test: `src/components/learn/regions/RegionsMap.test.tsx`

**Interfaces:**
- Consumes: Task 5 `geo.ts` (all exports); Task 4 `MAP_COUNTRIES`, `countryById`, `regionsOf`; Task 6 `MapSelection`; `useReveal` (`hooks/useReveal`), `usePrefersReducedMotion` (`hooks/usePrefersReducedMotion`), `cssVars` (`components/home/art/cssVars`).
- Produces: `RegionsMap({ selection, inset, onSelectCountry, onSelectRegion }: { selection: MapSelection; inset: boolean; onSelectCountry: (id: string) => void; onSelectRegion: (id: string) => void })` (named export; Task 9 lazy-loads it).

Markup contract:
- Wrapper `<div className="scene …reveal">` (draw-in on reveal, via `useReveal`).
- `<svg viewBox="0 0 1200 600" role="group" aria-label="World wine map">`: graticule path (`aria-hidden`), then `<g data-testid="map-zoom" class="map-zoom [map-zoom-animate]" style="transform: translate(Txpx, Typx) scale(K)">` containing:
  - non-wine countries in one `aria-hidden` `<g>`: `.draw stroke-accent`, no fill, thin, faint;
  - the 13 wine countries (1:50m outlines) as `<path role="button" tabIndex={0} aria-label={name} aria-pressed>` with class `map-country draw stroke-accent` plus `is-selected` / `is-dim`;
  - US interior state lines (`data-testid="us-states"`, `aria-hidden`) only when the US is selected;
  - the selected country's pins: `<g role="button" tabIndex={0} aria-label={name} aria-pressed class="map-pin [is-selected]">` with a halo circle, a core circle and a serif label, all sized `/ k` so they stay constant on screen.
- `map-zoom-animate` is omitted under reduced motion. Enter and Space activate countries and pins.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { stubMatchMedia } from "../../../test/stubs";
import { RegionsMap } from "./RegionsMap";
import type { MapSelection } from "./useMapSelection";

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderMap(selection: MapSelection, inset = false) {
  const onSelectCountry = vi.fn();
  const onSelectRegion = vi.fn();
  const view = render(<RegionsMap selection={selection} inset={inset} onSelectCountry={onSelectCountry} onSelectRegion={onSelectRegion} />);
  return { onSelectCountry, onSelectRegion, view };
}

const map = () => screen.getByRole("group", { name: "World wine map" });
const zoom = () => screen.getByTestId("map-zoom");
const WORLD: MapSelection = { countryId: null, regionId: null };

describe("RegionsMap", () => {
  it("offers the 13 wine countries as buttons and nothing else at world view", () => {
    renderMap(WORLD);
    const buttons = within(map()).getAllByRole("button");
    expect(buttons).toHaveLength(13);
    expect(within(map()).getByRole("button", { name: "United States" })).toHaveAttribute("aria-pressed", "false");
    expect(zoom().style.transform).toBe("translate(0px, 0px) scale(1)");
  });

  it("selects a country by click, Enter or Space", async () => {
    const { onSelectCountry } = renderMap(WORLD);
    await userEvent.click(within(map()).getByRole("button", { name: "France" }));
    expect(onSelectCountry).toHaveBeenLastCalledWith("france");
    fireEvent.keyDown(within(map()).getByRole("button", { name: "Italy" }), { key: "Enter" });
    expect(onSelectCountry).toHaveBeenLastCalledWith("italy");
    fireEvent.keyDown(within(map()).getByRole("button", { name: "Spain" }), { key: " " });
    expect(onSelectCountry).toHaveBeenLastCalledWith("spain");
  });

  it("zooms to the selected country and shows its pins", async () => {
    const { onSelectRegion } = renderMap({ countryId: "france", regionId: null });
    expect(within(map()).getByRole("button", { name: "France" })).toHaveAttribute("aria-pressed", "true");
    expect(zoom().style.transform).toMatch(/^translate\(-?[\d.]+px, -?[\d.]+px\) scale\([\d.]+\)$/);
    expect(zoom().style.transform).not.toContain("scale(1)");
    for (const name of ["Bordeaux", "Burgundy", "Champagne", "Rhône", "Loire", "Alsace", "Provence"]) {
      expect(within(map()).getByRole("button", { name })).toBeInTheDocument();
    }
    await userEvent.click(within(map()).getByRole("button", { name: "Bordeaux" }));
    expect(onSelectRegion).toHaveBeenCalledWith("bordeaux");
  });

  it("marks the selected region's pin", () => {
    renderMap({ countryId: "france", regionId: "champagne" });
    expect(within(map()).getByRole("button", { name: "Champagne" })).toHaveAttribute("aria-pressed", "true");
    expect(within(map()).getByRole("button", { name: "Bordeaux" })).toHaveAttribute("aria-pressed", "false");
  });

  it("shifts left to make room for the drawer when inset", () => {
    const wide = renderMap({ countryId: "france", regionId: null }, false);
    const full = zoom().style.transform;
    wide.view.unmount();
    renderMap({ countryId: "france", regionId: null }, true);
    expect(zoom().style.transform).not.toBe(full);
  });

  it("draws state lines only for the United States", () => {
    const first = renderMap({ countryId: "france", regionId: null });
    expect(screen.queryByTestId("us-states")).not.toBeInTheDocument();
    first.view.unmount();
    renderMap({ countryId: "united-states", regionId: null });
    expect(screen.getByTestId("us-states")).toBeInTheDocument();
  });

  it("glides between views, except under reduced motion", () => {
    stubMatchMedia({ reducedMotion: false });
    const first = renderMap(WORLD);
    expect(zoom()).toHaveClass("map-zoom-animate");
    first.view.unmount();
    stubMatchMedia({ reducedMotion: true });
    renderMap(WORLD);
    expect(zoom()).not.toHaveClass("map-zoom-animate");
  });

  it("gives every outline a normalized path length for the draw-in", () => {
    renderMap(WORLD);
    const outlines = map().querySelectorAll("path.draw");
    expect(outlines.length).toBeGreaterThan(150);
    outlines.forEach((outline) => expect(outline.getAttribute("pathLength")).toBe("1"));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/learn/regions/RegionsMap.test.tsx`
Expected: FAIL — cannot resolve `./RegionsMap`.

- [ ] **Step 3: Implement** — `src/components/learn/regions/RegionsMap.tsx`

```tsx
import { useRef, type KeyboardEvent } from "react";
import { MAP_COUNTRIES, countryById, regionsOf } from "../../../content/learn/regions";
import { usePrefersReducedMotion } from "../../../hooks/usePrefersReducedMotion";
import { useReveal } from "../../../hooks/useReveal";
import { cssVars } from "../../home/art/cssVars";
import {
  GRATICULE_PATH,
  IDENTITY,
  MAP_HEIGHT,
  MAP_WIDTH,
  US_STATE_LINES_PATH,
  WORLD_FEATURES,
  countryTransform,
  detailFeature,
  pathFor,
  projectPoint,
} from "./geo";
import type { MapSelection } from "./useMapSelection";

interface RegionsMapProps {
  selection: MapSelection;
  /** True when the drawer covers the map's right edge, so the zoom centers in the space left of it. */
  inset: boolean;
  onSelectCountry: (id: string) => void;
  onSelectRegion: (id: string) => void;
}

const WINE_ATLAS_NAMES = new Set(MAP_COUNTRIES.map((country) => country.atlasName));
const OTHER_SHAPES = WORLD_FEATURES.filter((f) => !WINE_ATLAS_NAMES.has(f.properties.name)).map((f) => ({
  key: String(f.id ?? f.properties.name),
  d: pathFor(f),
}));
// Wine countries always use the detailed outline: they're the ones readers zoom into.
const COUNTRY_SHAPES = MAP_COUNTRIES.map((country) => ({ country, d: pathFor(detailFeature(country.atlasName)!) }));

function activate(event: KeyboardEvent, action: () => void) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  action();
}

export function RegionsMap({ selection, inset, onSelectCountry, onSelectRegion }: RegionsMapProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reveal = useReveal(ref);
  const reducedMotion = usePrefersReducedMotion();
  const country = selection.countryId ? countryById(selection.countryId) : undefined;
  const { k, tx, ty } = country ? countryTransform(country, inset) : IDENTITY;
  const pins = country ? regionsOf(country.id) : [];

  return (
    <div ref={ref} className={["scene", ...reveal].join(" ")}>
      <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} role="group" aria-label="World wine map" className="block h-auto w-full">
        <path d={GRATICULE_PATH} fill="none" className="stroke-accent" strokeOpacity={0.08} strokeWidth={0.6} aria-hidden="true" />
        <g
          data-testid="map-zoom"
          className={reducedMotion ? "map-zoom" : "map-zoom map-zoom-animate"}
          style={{ transform: `translate(${tx}px, ${ty}px) scale(${k})` }}
        >
          <g aria-hidden="true">
            {OTHER_SHAPES.map(({ key, d }) => (
              <path
                key={key}
                d={d}
                fill="none"
                className="draw stroke-accent"
                strokeOpacity={0.4}
                strokeWidth={0.5}
                vectorEffect="non-scaling-stroke"
                pathLength={1}
              />
            ))}
          </g>
          {COUNTRY_SHAPES.map(({ country: shape, d }) => {
            const selected = shape.id === selection.countryId;
            const state = selected ? " is-selected" : country ? " is-dim" : "";
            return (
              <path
                key={shape.id}
                d={d}
                role="button"
                tabIndex={0}
                aria-label={shape.name}
                aria-pressed={selected}
                className={`map-country draw stroke-accent${state}`}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
                pathLength={1}
                onClick={() => onSelectCountry(shape.id)}
                onKeyDown={(event) => activate(event, () => onSelectCountry(shape.id))}
              />
            );
          })}
          {country?.id === "united-states" ? (
            <path
              data-testid="us-states"
              d={US_STATE_LINES_PATH}
              fill="none"
              className="stroke-accent"
              strokeOpacity={0.35}
              strokeWidth={0.5}
              vectorEffect="non-scaling-stroke"
              aria-hidden="true"
            />
          ) : null}
          {pins.map((region, i) => {
            const [x, y] = projectPoint(region.coords);
            const selected = region.id === selection.regionId;
            return (
              <g
                key={region.id}
                role="button"
                tabIndex={0}
                aria-label={region.name}
                aria-pressed={selected}
                className={`map-pin${selected ? " is-selected" : ""}`}
                style={cssVars({ "--delay": `${0.85 + i * 0.09}s` })}
                onClick={() => onSelectRegion(region.id)}
                onKeyDown={(event) => activate(event, () => onSelectRegion(region.id))}
              >
                <circle cx={x} cy={y} r={(selected ? 16 : 10) / k} className="map-pin-halo" />
                <circle cx={x} cy={y} r={4.5 / k} strokeWidth={1.3 / k} className="map-pin-core" />
                <text x={x + 8 / k} y={y + 4 / k} fontSize={12.5 / k} className="fill-ink font-serif">
                  {region.name}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
```

Check `src/components/home/art/cssVars.ts`'s export before using it: it takes a `Record<\`--${string}\`, string>` and returns `CSSProperties`. If its signature differs, adapt the call, not the helper.

- [ ] **Step 4: Add the map styles** — append to `src/components/learn/learn.css`

```css
/* Wine Regions map. The zoom is a CSS transform on one <g>; strokes don't scale with it. */
.map-zoom {
  transform-origin: 0 0;
}

.map-zoom-animate {
  transition: transform 1.1s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.map-country {
  fill: var(--color-accent);
  fill-opacity: 0.16;
  cursor: pointer;
}

/* Keeps the shared draw-in transition and adds the hover wash. */
.scene .map-country {
  transition:
    stroke-dashoffset 1.2s ease var(--delay, 0s),
    fill-opacity 0.2s ease;
}

.map-country.is-dim {
  fill-opacity: 0.08;
}

.map-country.is-selected {
  fill-opacity: 0.28;
}

.map-country:hover,
.map-country:focus-visible {
  fill-opacity: 0.34;
}

.map-country:focus-visible {
  outline: none;
  stroke-width: 2.5;
}

.map-pin {
  cursor: pointer;
}

.map-pin:focus-visible {
  outline: none;
}

.map-pin-halo {
  fill: var(--color-accent);
  fill-opacity: 0.16;
}

.map-pin:focus-visible .map-pin-halo {
  fill-opacity: 0.4;
}

.map-pin-core {
  fill: var(--color-wine-red);
  stroke: var(--color-accent);
}

.map-pin.is-selected .map-pin-core {
  fill: var(--color-accent);
}

@media (prefers-reduced-motion: no-preference) {
  .map-pin {
    animation: map-pin-in 0.45s ease var(--delay, 0s) both;
  }
}

@keyframes map-pin-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run src/components/learn/regions/RegionsMap.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/learn/regions/RegionsMap.tsx src/components/learn/regions/RegionsMap.test.tsx src/components/learn/learn.css
git commit -m "feat(learn): add the interactive wine regions map

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: The chapter, wired into Learn and the home page

**Files:**
- Create: `src/components/learn/regions/RegionsChapter.tsx`
- Modify: `src/components/learn/chapters.ts`, `src/components/home/scenes/LearnScene.tsx`
- Test: `src/components/learn/regions/RegionsChapter.test.tsx`, `src/pages/LearnPage.test.tsx`, `src/components/home/scenes/FeatureScenes.test.tsx`

**Interfaces:**
- Consumes: everything from Tasks 4–8.
- Produces: `RegionsChapter(): JSX.Element`; `LEARN_CHAPTERS` = `[taste, vine, grapes, glossary, regions]`.

Behavior:
- Layout: `CountryChips`, then a `relative` map frame (rounded border) holding: an optional deep-link anchor `<span id="country-…|region-…" class="absolute top-0 scroll-mt-24">` (only for the hash present on arrival); a top-left bar with "← World" (when a country is selected) and a breadcrumb (`role="status"`): "World · 13 wine countries", "World · France", "World · France · Bordeaux"; the lazily loaded `RegionsMap` inside `Suspense` with a fixed-aspect placeholder (`aspect-[2/1]`, "Loading map…"); a bottom-left legend (md+ only, `aria-hidden`); and, on wide screens, the drawer inside the frame. On narrow screens the drawer renders after the frame.
- Wide = `matchMedia("(min-width: 768px)")` (false when `matchMedia` is missing). `RegionsMap`'s `inset` = wide && drawer open.
- Drawer open state: opens whenever the reader selects a country or region (chip, map, list); starts open when the arrival hash selects something. × closes it (selection stays) and returns focus to the element that opened it. "← World" closes it and shows the world.
- Focus: after a reader-initiated open (or Escape back to the country), the drawer heading receives focus with `preventScroll`. Arrival via hash doesn't move focus.
- Escape (keydown anywhere inside the chapter): region → country (drawer shows the country); country → world (drawer closes).

- [ ] **Step 1: Write the failing chapter test** — `src/components/learn/regions/RegionsChapter.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import * as api from "../../../services/api";
import { RegionsChapter } from "./RegionsChapter";
import { clearCatalogCountCache } from "./useCatalogCount";

vi.mock("../../../services/api", async () => {
  const actual = await vi.importActual<typeof import("../../../services/api")>("../../../services/api");
  return { ...actual, listWines: vi.fn() };
});

beforeEach(() => {
  clearCatalogCountCache();
  vi.mocked(api.listWines).mockResolvedValue({ total: 5, items: [] });
});

function HashProbe() {
  return <p data-testid="hash">{useLocation().hash}</p>;
}

async function renderAt(path = "/learn") {
  render(
    <MemoryRouter initialEntries={[path]}>
      <RegionsChapter />
      <HashProbe />
    </MemoryRouter>
  );
  await screen.findByRole("group", { name: "World wine map" });
}

const chips = () => screen.getByRole("group", { name: "Wine countries" });
const status = () => screen.getByRole("status").textContent;

describe("RegionsChapter", () => {
  it("opens on the world with chips, the map and no drawer", async () => {
    await renderAt();
    expect(within(chips()).getAllByRole("button")).toHaveLength(13);
    expect(status()).toBe("World · 13 wine countries");
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "World" })).not.toBeInTheDocument();
  });

  it("flies to a country from a chip, opens its drawer and focuses the heading", async () => {
    await renderAt();
    await userEvent.click(within(chips()).getByRole("button", { name: "France" }));
    const drawer = screen.getByRole("complementary", { name: "France details" });
    expect(document.activeElement).toBe(within(drawer).getByRole("heading", { level: 3, name: "France" }));
    expect(status()).toBe("World · France");
    expect(screen.getByTestId("hash")).toHaveTextContent("#country-france");
    expect(screen.getByRole("button", { name: "World" })).toBeInTheDocument();
  });

  it("opens a region from the drawer list and steps back with Escape", async () => {
    await renderAt();
    await userEvent.click(within(chips()).getByRole("button", { name: "France" }));
    await userEvent.click(within(screen.getByRole("list")).getByRole("button", { name: /Bordeaux/ }));
    expect(screen.getByRole("complementary", { name: "Bordeaux details" })).toBeInTheDocument();
    expect(status()).toBe("World · France · Bordeaux");

    await userEvent.keyboard("{Escape}");
    const drawer = screen.getByRole("complementary", { name: "France details" });
    expect(document.activeElement).toBe(within(drawer).getByRole("heading", { level: 3 }));

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(status()).toBe("World · 13 wine countries");
    expect(screen.getByTestId("hash")).toHaveTextContent("#regions");
  });

  it("closes the drawer without leaving the country, returning focus to the chip", async () => {
    await renderAt();
    const france = within(chips()).getByRole("button", { name: "France" });
    await userEvent.click(france);
    await userEvent.click(screen.getByRole("button", { name: "Close details" }));
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(france);
    expect(france).toHaveAttribute("aria-pressed", "true");
    expect(status()).toBe("World · France");
  });

  it("goes back to the world", async () => {
    await renderAt();
    await userEvent.click(within(chips()).getByRole("button", { name: "Italy" }));
    await userEvent.click(screen.getByRole("button", { name: "World" }));
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(status()).toBe("World · 13 wine countries");
  });

  it("arrives on a region from a deep link", async () => {
    await renderAt("/learn#region-bordeaux");
    expect(screen.getByRole("complementary", { name: "Bordeaux details" })).toBeInTheDocument();
    expect(document.getElementById("region-bordeaux")).not.toBeNull();
    expect(status()).toBe("World · France · Bordeaux");
  });
});
```

- [ ] **Step 2: Update the LearnPage and home tests**

In `src/pages/LearnPage.test.tsx`, replace the `"lists all four chapters in the nav"` test with:

```tsx
  it("lists all five chapters in the nav", () => {
    renderAt("/learn");
    const nav = screen.getByRole("navigation", { name: "Learn chapters" });
    expect(within(nav).getAllByRole("link").map((link) => link.textContent)).toEqual([
      "How to Taste",
      "Vine to Glass",
      "Key Grapes",
      "Glossary",
      "Wine Regions",
    ]);
  });

  it("renders the Wine Regions chapter fifth", () => {
    renderAt("/learn");
    expect(screen.getByRole("region", { name: "Where wine comes from" })).toHaveAttribute("id", "regions");
    expect(screen.getByText("05 · Wine Regions")).toBeInTheDocument();
  });

  it("scrolls to the map for a region deep link on arrival", () => {
    renderAt("/learn#region-bordeaux");
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.instances[0]).toBe(document.getElementById("region-bordeaux"));
  });
```

In `src/components/home/scenes/FeatureScenes.test.tsx`, add to the `"describes the Learn chapters"` test:

```tsx
    expect(screen.getByText(/interactive map/i)).toBeInTheDocument();
```

- [ ] **Step 3: Run to verify they fail**

Run: `npx vitest run src/components/learn/regions/RegionsChapter.test.tsx src/pages/LearnPage.test.tsx src/components/home/scenes/FeatureScenes.test.tsx`
Expected: FAIL — no `RegionsChapter`; four chapters in the nav; no map copy.

- [ ] **Step 4: Implement** — `src/components/learn/regions/RegionsChapter.tsx`

```tsx
import { Suspense, lazy, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useLocation } from "react-router-dom";
import { countryById, regionById } from "../../../content/learn/regions";
import { CountryChips } from "./CountryChips";
import { RegionDrawer } from "./RegionDrawer";
import { selectionFromHash, useMapSelection } from "./useMapSelection";

// The map and its ~340 KB of geography load as their own chunk, after the rest of the page.
const RegionsMap = lazy(() => import("./RegionsMap").then((module) => ({ default: module.RegionsMap })));

const WIDE_QUERY = "(min-width: 768px)";

function useWideLayout(): boolean {
  const [wide, setWide] = useState(() => typeof window.matchMedia === "function" && window.matchMedia(WIDE_QUERY).matches);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(WIDE_QUERY);
    const onChange = (event: MediaQueryListEvent) => setWide(event.matches);
    setWide(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return wide;
}

function MapPlaceholder() {
  return <div className="flex aspect-[2/1] w-full items-center justify-center text-sm text-ink-muted">Loading map…</div>;
}

function Legend() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute bottom-3 left-3 hidden items-center gap-4 text-xs text-ink-muted md:flex">
      <span className="flex items-center gap-1.5">
        <svg width="14" height="9" viewBox="0 0 14 9">
          <rect x="0.5" y="0.5" width="13" height="8" className="fill-accent stroke-accent" fillOpacity={0.25} />
        </svg>
        Wine country
      </span>
      <span className="flex items-center gap-1.5">
        <svg width="10" height="10" viewBox="0 0 10 10">
          <circle cx="5" cy="5" r="3.5" className="fill-wine-red stroke-accent" strokeWidth={1.3} />
        </svg>
        Region
      </span>
    </div>
  );
}

export function RegionsChapter() {
  const location = useLocation();
  const { selection, selectCountry, selectRegion, showWorld, stepBack } = useMapSelection();
  const wide = useWideLayout();
  const [drawerOpen, setDrawerOpen] = useState(() => selection.countryId !== null);
  // Only the hash present on arrival gets an anchor, so LearnPage's arrival scroll lands on the map.
  const [anchorId] = useState(() => (selectionFromHash(location.hash) ? location.hash.slice(1) : null));
  const headingRef = useRef<HTMLHeadingElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const focusHeading = useRef(false);

  useEffect(() => {
    if (!focusHeading.current || !drawerOpen) return;
    focusHeading.current = false;
    headingRef.current?.focus({ preventScroll: true });
  });

  function openWith(action: () => void) {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    focusHeading.current = true;
    action();
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    const opener = openerRef.current;
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  }

  function goToWorld() {
    setDrawerOpen(false);
    showWorld();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Escape") return;
    if (selection.regionId) {
      focusHeading.current = true;
      stepBack();
      setDrawerOpen(true);
    } else if (selection.countryId) {
      goToWorld();
    }
  }

  const country = selection.countryId ? countryById(selection.countryId) : undefined;
  const region = selection.regionId ? regionById(selection.regionId) : undefined;
  const crumb = country ? ["World", country.name, region?.name].filter(Boolean).join(" · ") : "World · 13 wine countries";

  const drawer =
    drawerOpen && country ? (
      <RegionDrawer
        countryId={country.id}
        regionId={selection.regionId}
        headingRef={headingRef}
        onClose={closeDrawer}
        onSelectRegion={(id) => openWith(() => selectRegion(id))}
        onBackToCountry={() => openWith(() => selectCountry(country.id))}
      />
    ) : null;

  return (
    <div className="mt-8" onKeyDown={onKeyDown}>
      <CountryChips selectedId={selection.countryId} onSelect={(id) => openWith(() => selectCountry(id))} />
      <div className="relative mt-4 overflow-hidden rounded-lg border border-surface-border bg-surface">
        {anchorId ? <span id={anchorId} aria-hidden="true" className="absolute left-0 top-0 scroll-mt-24" /> : null}
        <div className="absolute left-3 top-3 z-[2] flex items-center gap-3">
          {country ? (
            <button
              type="button"
              onClick={goToWorld}
              className="rounded-full border border-accent bg-surface-raised px-3 py-1 text-sm text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              <span aria-hidden="true">← </span>World
            </button>
          ) : null}
          <p role="status" className="text-xs uppercase tracking-[0.15em] text-ink-muted">
            {crumb}
          </p>
        </div>
        <Suspense fallback={<MapPlaceholder />}>
          <RegionsMap
            selection={selection}
            inset={wide && drawerOpen}
            onSelectCountry={(id) => openWith(() => selectCountry(id))}
            onSelectRegion={(id) => openWith(() => selectRegion(id))}
          />
        </Suspense>
        <Legend />
        {wide ? drawer : null}
      </div>
      {wide ? null : drawer}
    </div>
  );
}
```

- [ ] **Step 5: Register the chapter** — `src/components/learn/chapters.ts`: add the imports

```ts
import { REGIONS_CHAPTER } from "../../content/learn/regions";
import { RegionsChapter } from "./regions/RegionsChapter";
```

and append to `LEARN_CHAPTERS` after the glossary entry:

```ts
  {
    id: REGIONS_CHAPTER.id,
    label: REGIONS_CHAPTER.label,
    title: REGIONS_CHAPTER.title,
    lead: REGIONS_CHAPTER.lead,
    Component: RegionsChapter,
  },
```

- [ ] **Step 6: Update the home copy** — in `src/components/home/scenes/LearnScene.tsx`, replace the paragraph text with:

```tsx
        Learn the five things your mouth is measuring, with real wines to taste the difference — then follow a grape
        from the vineyard to your glass, meet the seven grapes worth knowing, look up any word in the glossary, and
        explore the world's great wine regions on an interactive map.
```

- [ ] **Step 7: Run the targeted tests, then everything**

Run: `npx vitest run src/components/learn/regions src/pages/LearnPage.test.tsx src/components/home/scenes/FeatureScenes.test.tsx`
Expected: PASS.

Run: `npx vitest run`
Expected: all pass (baseline 698 + the new tests). If an existing whole-page test now finds two matches for a word the map chapter repeats (e.g. a country name), scope that query to its own chapter region with `within(screen.getByRole("region", { name: ... }))` rather than changing the map.

Run: `npm run build`
Expected: type-check and build succeed, and the build output lists a separate chunk containing `RegionsMap`.

- [ ] **Step 8: Commit**

```bash
git add src/components/learn/regions/RegionsChapter.tsx src/components/learn/regions/RegionsChapter.test.tsx src/components/learn/chapters.ts src/components/home/scenes/LearnScene.tsx src/pages/LearnPage.test.tsx src/components/home/scenes/FeatureScenes.test.tsx
git commit -m "feat(learn): add Wine Regions as the fifth Learn chapter

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Then run the UTF-8 check.
