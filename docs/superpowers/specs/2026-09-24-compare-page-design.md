# VinoScope Compare Page Design

## Overview

The Compare page: pick 2–4 wines, see them side by side in a field-by-field table plus a radar chart of their five characteristics (sweetness, acidity, tannin, body, fruitiness). Replaces the current `/compare` stub. No backend changes — it's a new frontend consumer of the existing `GET /api/wines/{id}` endpoint, fetched once per selected wine. Selection is driven entirely by an in-page search picker; nothing on Explore or Wine Detail links into it (out of scope, see below).

## Goals

- Four wine slots. A slot is either filled (mini card + remove button) or, for the next open slot, a live search picker to fill it; slots beyond the next open one are inert placeholders.
- Selection persists in the URL (`/compare?wines=12,45,78`) so a comparison is shareable/bookmarkable and survives a refresh.
- Once 2+ wines are selected and loaded, render a comparison table (winery, vintage, type, country/region, grape(s) with percentages, price, ABV, and the five 1–5 characteristics) and a radar chart of the five characteristics.
- With 0–1 wines selected, show a prompt instead of an empty table/chart.

## Out of Scope

- Any backend changes — `GET /api/wines/{id}` already returns everything Compare needs (`WineDetail`).
- "Add to Compare" entry points on `ExplorePage` or `WineDetailPage` — selection happens only through the in-page picker. Can be added later without changing this design's data flow (it's already URL-param-driven).
- Ratings and food-pairing comparison rows from the original project-design doc — neither field exists anywhere in the backend data model (confirmed: no `rating` or `food_pairing` column/field in `backend/`). The table only shows fields that actually exist.
- More than 4 wines, or fewer than 2 required for the table/chart to render.
- Live/debounced search-as-you-type. No debounce utility exists anywhere in this codebase; the picker follows the same draft-then-submit pattern `FilterDrawer`'s search field already uses (type, then Enter or a Search button — see Data Flow).
- Persisting comparisons across sessions beyond the URL (no `localStorage`).

## Page Behavior

Single page, no mode switch (unlike Pair's picker/results split — Compare's picker and results coexist, since slots and the table are meant to be visible together so removing/swapping a wine is immediate).

1. On load, `wines` is parsed from the URL search params (comma-separated IDs, deduplicated, capped at 4). Each ID is fetched via `getWine(id)` in parallel.
2. Slots render left to right: filled slots first (in URL order), then one `WineSearchPicker` in the next open slot (if `selected.length < 4`), then any remaining slots are visually present but inert (dimmed, no picker) until it's their turn.
3. Picking a wine in the picker appends its ID to the URL param and closes that slot's picker; the next slot (if any) now shows the picker.
4. Removing a wine (× on its `CompareSlot`) drops its ID from the URL param; remaining wines shift down to fill the gap (array is always contiguous — no empty slot in the middle).
5. If fewer than 2 wines are loaded, the table/chart area shows a prompt: "Add at least 2 wines to compare."
6. A per-wine fetch failure (e.g. a stale/invalid ID in a shared URL) shows an inline error in that wine's slot with a "Remove" affordance, rather than failing the whole page — the other slots/wines still work.

## Data Flow

- `services/api.ts`: no changes — `getWine(id)` reused as-is.
- `types/wine.ts`: no changes — `WineDetail` already has everything the table/chart need.
- New hook `hooks/useCompareSelection.ts`: wraps `useSearchParams`, exposing `selectedIds: number[]`, `addWine(id: number)`, `removeWine(id: number)`. Parses the `wines` param on read: splits on comma, drops non-numeric entries, dedupes, and keeps only the first 4 (any extra IDs in a hand-edited or old URL are silently dropped); writes back a clean comma-joined list on every change. This keeps `ComparePage` free of URL-string mechanics.
- `ComparePage` fetches each `selectedIds` entry via `getWine`, tracked per-ID (`Map<id, { status: "loading" | "error" | "loaded"; wine?: WineDetail }>`) rather than one page-level loading flag, since one slot's fetch shouldn't block or fail the others. Uses the same request-id-guard pattern already used in `PairPage`/`ExplorePage`, keyed per wine ID, so a fast add/remove doesn't let a stale response land.
- `WineSearchPicker` holds its own local `draft` (input value) and `submittedQuery` state; submitting (Enter or a Search button, matching `FilterDrawer`'s search field) calls `listWines({ q: submittedQuery, limit: 8 })` via `useApiQuery`. Results already in `selectedIds` are filtered out of the list so the same wine can't be added twice.
- `utils/format.ts` gains `formatGrapeBreakdown(grapes: Grape[]): string`, returning e.g. `"Cabernet Sauvignon 80%, Merlot 20%"` (or just the name if percentage is null, or `"Blend unknown"` for an empty list) — the table needs the full blend, unlike `WineCard`'s one-word `primaryGrapeLabel`.

## Component Architecture

```
frontend/src/
├── hooks/
│   └── useCompareSelection.ts     URL <-> selectedIds[] (new)
├── utils/
│   └── format.ts                  + formatGrapeBreakdown (modified)
├── components/
│   └── compare/
│       ├── WineSearchPicker.tsx   submit-to-search input + result list; onSelect(id) (new)
│       ├── CompareSlot.tsx        filled-slot mini card + remove button (new)
│       ├── CompareTable.tsx       field rows x wine columns, incl. compact characteristic bars (new)
│       └── CompareRadarChart.tsx  Recharts radar, one series per wine (new)
└── pages/
    └── ComparePage.tsx            owns selectedIds (via useCompareSelection), per-wine fetch state;
                                      moved out of StubPages.tsx (ComparePage's stub export removed there)
```

`App.tsx` is updated to import `ComparePage` from `./pages/ComparePage` instead of `./pages/StubPages`.

## Radar Chart

- Library: `recharts` (new dependency — added to `frontend/package.json`).
- One data point per characteristic axis (5 axes: Sweetness, Acidity, Tannin, Body, Fruitiness), one `Radar` series per selected wine, keyed by wine ID.
- A wine missing a value on a given axis (`null`) plots as `0` on that axis; a caption below the chart notes "Missing characteristics are plotted as 0" so this isn't misread as a real low score.
- Series colors: a fixed 4-slot categorical palette (not derived from the current theme's single `--color-accent`, since up to 4 series need to stay distinguishable from each other and from the surface/ink colors across all three themes). Exact values chosen during implementation using the dataviz skill's palette guidance, defined once as a constant (e.g. `COMPARE_SERIES_COLORS: string[]`) in `CompareRadarChart.tsx`.
- Legend maps each color to the wine's name.

## Testing Strategy

Same Vitest + React Testing Library conventions as the rest of the frontend, API layer mocked at `services/api.ts`:

- `useCompareSelection`: parses a `wines` param into `selectedIds`; dedupes repeated IDs; caps at 4; `addWine`/`removeWine` update the param correctly, including the no-gaps behavior on removal
- `formatGrapeBreakdown`: single grape with/without percentage, multi-grape blend, empty list
- `WineSearchPicker`: submitting a query fetches and lists results; already-selected wine IDs are excluded from results; selecting a result calls `onSelect` with the right ID
- `CompareSlot`: renders wine summary; clicking remove calls `onRemove`
- `CompareTable`: renders one column per wine with correct formatted values; a `null` characteristic renders as "Not rated" (matching `CharacteristicBar`'s existing convention)
- `CompareRadarChart`: renders one series per wine; a wine with a `null` characteristic plots 0 on that axis
- `ComparePage`: reads initial selection from URL; adding/removing a wine updates the URL and re-fetches; fewer than 2 loaded wines shows the prompt instead of the table/chart; a single wine's fetch failure shows an error in that slot without breaking the others

## Global Constraints

- No backend changes.
- One new runtime dependency: `recharts`.
- Mobile-responsive down to phone width, consistent with the rest of the built (non-stub) pages — the table wraps/scrolls horizontally on narrow screens rather than overflowing.
- `formatGrapeBreakdown` is additive; `primaryGrapeLabel` and its existing `WineCard` usage are unchanged.
