# Learn Page, Part 5: Wine Regions Map — Design

**Date:** 2026-10-03
**Status:** Approved in brainstorming (with live mockups); awaiting written-spec review
**Builds on:** Parts 1–4 (`2026-09-30-learn-page-framework-taste-design.md`,
`2026-09-30-learn-vine-to-glass-design.md`, `2026-10-01-learn-key-grapes-design.md`,
`2026-10-02-learn-glossary-design.md`), all merged.

## Goal

Add the fifth and final Learn chapter, **Wine Regions**: an interactive world map in the site's gold
line-art style that is the page's focal point. Readers zoom from the world into a wine country and
then into its regions, with a sliding drawer that teaches each place and links to its wines in
Explore.

## Decisions (from brainstorming)

| Topic | Decision |
|---|---|
| Interaction | World → click a country → map glides/zooms in → click a region pin; drawer shows details |
| Visual style | **A: gold line art** — gold outlines drawn in, wine countries washed in gold, wine-red pins (mockup `map-style.html`) |
| Layout | **B: full-width map + sliding drawer** over the right edge (mockup `map-drawer-v2.html`, approved) |
| Coverage | 13 catalog countries, 28 regions: course classics + the catalog's biggest |
| Explore link | New backend `region` filter; region links go to `/explore?region=<value>` with a live count |
| Rendering | React-rendered SVG; `d3-geo` (projection/paths) + `topojson-client` (decode); prebuilt map data file |
| Content source | `content/learn/regions.ts`, every entry `source: "general"` |

## Experience

**Chapter.** `id: "regions"`, `label: "Wine Regions"`, `title: "Where wine comes from"`, a lead line.
Rendered as chapter 05. The map container breaks out of the text column (`max-w-6xl`, full width
on smaller screens) so it is visually the largest thing on the page.

**World view (initial).**
- Natural Earth projection of all countries except Antarctica; a faint graticule.
- Outlines: gold (`stroke-accent`), non-wine countries thinner and at reduced opacity; the 13 wine
  countries thicker with a gold wash fill (`fill-accent` at low opacity via an `opacity`
  attribute — Tailwind opacity modifiers don't work on these tokens).
- On first reveal the outlines draw in (shared `draw` class, `pathLength={1}`), once; finished
  immediately under reduced motion.
- Hovering a wine country brightens its wash; non-wine countries aren't interactive.
- Top-left: breadcrumb ("World · 13 wine countries"). Bottom-left: a legend (wine country wash,
  region pin).
- **Country chips** above the map: 13 pill buttons (same pill style as the grape picker), in
  catalog-size order; selecting one = clicking that country. They make tiny countries (New
  Zealand) easy to hit and give a non-map path for keyboard and phone users. The selected country's
  chip is `aria-pressed="true"`.

**Country view.**
- The map glides (CSS `transform` transition, ~1.1 s, `cubic-bezier(.2,.8,.2,1)`) to fit the
  country into the area left of the drawer (desktop) or the full map (phones). Country fit boxes
  can be overridden in content (`fitBounds: [[w, s], [e, n]]` in degrees) for countries whose
  outlines include far-flung territory (France: mainland only; United States: lower 48).
- At the higher zoom, the country is drawn from the detailed (1:50m) outline; the US also shows
  faint state lines. Stroke widths stay constant on screen (`vector-effect: non-scaling-stroke`).
- Other wine countries dim; the selected one keeps a stronger wash.
- The country's region pins fade in, staggered: wine-red core with gold ring, a soft gold halo,
  and a serif label. Pin sizes are divided by the zoom scale so they stay constant on screen.
- The **drawer** slides in with the country overview: "Country" eyebrow, name, 2–3 sentence
  overview, a "Regions" list (each row: name + live catalog count or "—"), and "Explore N wines
  from <country> →" (`/explore?country=<exploreCountry>`).
- Breadcrumb: "World · France". "← World" button appears top-left.

**Region view.**
- Clicking a pin or a list row selects the region: its pin turns gold with a larger halo, the
  others stay red; breadcrumb "World · France · Bordeaux". The map doesn't zoom further.
- Drawer content: "<Country> · Region" eyebrow, name, `about` (2–3 sentences), **Climate** on a
  five-step cool → hot scale with a short label (e.g. "Moderate, maritime"), **Key grapes** as
  chips (grapes that are in Key Grapes link to `#grape-<id>`; others are plain), **Signature
  styles** as chips, **Worth knowing** (one fact), then the Explore link: "Explore N <label> wines
  →" (`/explore?region=<exploreRegion>`), or "No <name> wines in the catalog yet." when the
  region has no `exploreRegion` or a zero count, and finally "← All of <country>".

**Leaving.** × closes the drawer (map stays zoomed). "← World" zooms out, clears pins, closes the
drawer. **Escape** steps back one level: region → country → world.

**Phones (< `md`).** The drawer becomes a bottom sheet (slides up, max 60 vh, scrolls inside); the
map uses the full width; the country fit uses the whole map area.

**Reduced motion.** No glide (transform applied instantly), no draw-in, no pin fade, no drawer
slide (it appears in place).

## Deep links

- `#country-<id>` opens that country's view; `#region-<id>` opens its country and selects the
  region. Unknown ids → world view.
- On arrival, `LearnPage`'s existing logic scrolls to the element whose id matches the hash.
  `RegionsChapter` renders an empty `<span id={hashId} className="scroll-mt-24" />` at the top of
  the map for the current `#country-`/`#region-` target, so the arrival scroll lands on the map.
- Selecting a country or region replaces the hash (`navigate(..., { replace: true })`, like the
  grape picker); returning to the world clears it to `#regions`. Back/Forward (`POP`) to a
  `#country-`/`#region-` hash drives the selection, like `GrapesChapter`.

## Content (`content/learn/regions.ts`)

`MapCountry`: `id` (slug), `name` (display), `atlasName` (name in the map data), `exploreCountry`
(dataset `country` value), `overview`, optional `fitBounds`, `source`.

`MapRegion`: `id` (slug), `name`, `countryId`, `coords: [lon, lat]` (pin), `exploreRegion`
(dataset `region` value or `null`), optional `exploreLabel` (link wording when it differs from
the name), `about`, `climate: 1|2|3|4|5` + `climateLabel`, `grapes: string[]` (display names),
`styles: string[]`, `fact`, `source`.

Countries (order = chip order, by catalog size) and regions:

| Country (`exploreCountry`) | Regions → `exploreRegion` (label) |
|---|---|
| United States (`United States`; atlas `United States of America`; fit lower 48) | Napa & Sonoma → `California` ("California"); Willamette Valley → `Oregon` ("Oregon"); Washington → `Washington` |
| Italy | Piedmont → `Piedmont`; Tuscany → `Tuscany`; Veneto → `Veneto`; Emilia-Romagna → `Emilia-Romagna` |
| France (fit mainland) | Bordeaux → `Bordeaux`; Burgundy → `Burgundy`; Champagne → `Champagne`; Rhône → `Rhone`; Loire → `null`; Alsace → `Alsace`; Provence → `Provence` |
| Germany | Mosel → `Mosel`; Rheingau → `Rheingau` |
| Portugal (fit mainland + Madeira) | Douro → `Douro`; Madeira → `Madeira` |
| Spain | Rioja → `Rioja`; Ribera del Duero → `Castilla y Leon` ("Castilla y León"); Jerez → `Andalusia` ("Andalusia") |
| Canada | Niagara → `Ontario` ("Ontario") |
| Argentina | Mendoza → `Mendoza` |
| Hungary | Tokaj → `Tokaj` |
| Chile | Colchagua → `Colchagua Valley` |
| Australia | Barossa Valley → `South Australia` ("South Australia") |
| New Zealand | Marlborough → `Marlborough` |
| South Africa | Stellenbosch → `Western Cape` ("Western Cape") |

13 countries, 28 regions. Copy (overviews, about, climate, grapes, styles, facts) is written in the
plan in the same plain what-it's-like voice as Parts 1–4. Grape names that match a `GRAPES` entry
(by `name`, or "Syrah"/"Shiraz" for `syrah`) link to Key Grapes.

`REGIONS_CHAPTER`: `id: "regions"`, `label: "Wine Regions"`, `title: "Where wine comes from"`,
`lead`, `source: "general"`.

## Map data

- A dev-only Node script, `frontend/scripts/build-map-data.mjs`, reads `world-atlas`
  (`countries-110m.json`, `countries-50m.json`) and `us-atlas` (`states-10m.json`) and writes
  `frontend/src/components/learn/regions/mapData.json`: one TopoJSON topology with three objects —
  `world` (110m, all countries but Antarctica), `detail` (50m, the 13 wine countries only), and
  `states` (US states, lower 48), quantized. Target size ≤ 350 KB raw. The JSON is committed; the
  script is rerun only if the country list changes (`npm run build:map`).
- `world-atlas`, `us-atlas`, `topojson-server`, `topojson-simplify` (if needed) are
  **devDependencies**; `d3-geo` and `topojson-client` (+ their `@types`) are the only new runtime
  dependencies.
- The map module (`RegionsMap` + `mapData.json`) loads with `React.lazy` inside the chapter, so it
  ships as its own chunk; a fixed-aspect placeholder (`aspect-[2/1]`, gold "Loading map…") holds
  its space so the page doesn't jump (protects the hash-arrival pinning).

## Architecture and units

| Unit | File | Responsibility |
|---|---|---|
| content | `content/learn/regions.ts` | Chapter, `MAP_COUNTRIES`, `MAP_REGIONS`, types, lookups |
| map data | `components/learn/regions/mapData.json` + `scripts/build-map-data.mjs` | Prebuilt topology |
| geometry | `components/learn/regions/geo.ts` | Projection, decoded features, `fitTransform(bounds, viewport, inset)` (pure), pin projection |
| selection | `components/learn/regions/useMapSelection.ts` | `{countryId, regionId}` state, hash read/write/POP, Escape step-back |
| `RegionsChapter` | `components/learn/regions/RegionsChapter.tsx` | Chips + lazy map + drawer; owns selection |
| `CountryChips` | `components/learn/regions/CountryChips.tsx` | 13 pressed-state buttons |
| `RegionsMap` | `components/learn/regions/RegionsMap.tsx` | SVG world/detail/states/pins, zoom transform, hover, keyboard |
| `RegionDrawer` | `components/learn/regions/RegionDrawer.tsx` | Country and region views, close, back-to-country |
| `ClimateScale` | `components/learn/regions/ClimateScale.tsx` | Cool → hot five-step scale |
| `useCatalogCount` | `components/learn/regions/useCatalogCount.ts` | `listWines({country|region, limit: 1}).total`, cached per filter for the session, stale-safe |
| styles | `components/learn/learn.css` | Drawer slide / sheet, glide, pin fade, reduced-motion overrides |
| chapters | `components/learn/chapters.ts` | Append `regions` |
| home | `components/home/scenes/LearnScene.tsx` | Copy mentions the map |
| backend | `backend/app/services/wines.py`, wines router, schema | `region` query param |
| Explore | `components/explore/filterTypes.ts`, `ExplorePage.tsx`, `services/api.ts` | `region` in filters/URL/API + removable chip |

**Data flow.** `RegionsChapter` owns the selection (via `useMapSelection`) and passes it down;
`RegionsMap` and `CountryChips` call `selectCountry(id)` / `selectRegion(id)`; `RegionDrawer`
renders from content + `useCatalogCount`. `RegionsMap` derives its transform from the selected
country with `fitTransform` and applies it as a CSS transform on the map's `<g>`.

## Accessibility

- The SVG has `role="group"` and `aria-label="World wine map"`. Each wine country path is
  `role="button"`, `tabIndex={0}`, `aria-label="France"` (the name only; counts live in the
  drawer, so the map needs no API calls). Enter/Space selects.
- Pins are `role="button"`, focusable, `aria-label="Bordeaux"`, `aria-pressed` for the selected
  one. Non-wine countries are `aria-hidden`.
- The drawer is `<aside aria-label="<name> details">` with `aria-live="polite"` on its heading
  region; on open, focus moves to the drawer heading (`tabIndex={-1}`, `preventScroll`); on
  close, focus returns to the chip/country/pin that opened it.
- Visible focus rings (gold) on chips, map buttons (an outline stroke on focus), and drawer
  controls.
- All interactions are reachable without the map via chips + the drawer's region list.

## Backend: region filter

- `list_wines(..., region: Optional[str] = None)`: `func.lower(Wine.region) == region.lower()`,
  mirroring `country`. The router exposes `region` as a query param; `GET /api/wines?region=Bordeaux`.
- Pytest: region filter matches case-insensitively; combines with `country`; unknown region → 0.

## Explore: region filter

- `FilterValues` gains `region` (default `""`), read from / written to the `region` URL param, sent
  to the API.
- There is no region dropdown; when `region` is set, Explore shows a removable chip
  "Region: <value> ×" near the result count. Removing it clears `region`. "Clear all" (if present)
  clears it too.
- Tests: URL → filter → API call includes `region`; chip appears and removes it.

## Chapter nav and home

`LEARN_CHAPTERS` becomes `[taste, vine, grapes, glossary, regions]`. The home `LearnScene` copy
mentions the map.

## Testing

Vitest + Testing Library, test-first; pytest for the backend.

- **Content:** 13 countries, 28 regions; ids unique and URL-safe; every region's `countryId`
  exists; every `atlasName` is in `mapData.json`; every region's `coords` fall inside its country
  (`d3.geoContains` on the detail feature); `climate` 1–5; non-empty copy; at least one grape and
  style each; `source` present.
- **Dataset:** every non-null `exploreRegion` exists in the dataset's `region` column for that
  country; every `exploreCountry` exists.
- **`geo.ts`:** `fitTransform` centers a box in the inset viewport and caps the scale; projected
  pins land inside the country's projected bounds.
- **`useMapSelection`:** hash → selection (`#country-france`, `#region-bordeaux` selects France +
  Bordeaux, unknown → world); selecting replaces the hash; POP follows; Escape steps back.
- **`useCatalogCount`:** loading → null; loaded → total; error → null; cached second call; stale
  response ignored.
- **`CountryChips`:** 13 chips in order; `aria-pressed` follows; click selects.
- **`RegionsMap`:** renders 13 interactive country buttons with labels; Enter selects; selected
  country shows its pins as buttons; pin click selects region; transform changes on selection;
  reduced motion applies no transition class.
- **`RegionDrawer`:** country view (overview, region rows with counts, country Explore link);
  region view (about, climate, grapes with Key Grapes links where applicable, styles, fact,
  Explore link with encoded region, "no wines" fallback, back-to-country); close calls back.
- **`RegionsChapter`:** chip click opens the country drawer and moves focus to its heading;
  Escape closes back to world; deep link `#region-bordeaux` arrives with Bordeaux selected.
- **`LearnPage`:** nav lists five chapters; `/learn#region-bordeaux` scrolls to the map.
- **Backend + Explore:** as above. **Home:** `LearnScene` copy mentions the map.

## Out of scope

A guided tour, regions beyond the 28, real appellation boundary shapes (regions are pins),
vintage charts, map pan/zoom by drag or wheel, and linking glossary terms to regions (possible
follow-up).
