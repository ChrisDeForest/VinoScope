# VinoScope Frontend — Explore & Wine Detail Design

## Overview

Stand up the first slice of the VinoScope frontend: a searchable/filterable wine catalog (**Explore**) and a **Wine Detail** page, both backed by the existing `GET /api/wines` and `GET /api/wines/{id}` endpoints. A minimal **Home** landing page and placeholder **stub pages** (Discover, Pair, Compare, Learn) round out the site's navigation so the full information architecture from `docs/VinoScope_Project_Design.md` is visible, even though most of it isn't built yet.

This is a deliberate scope cut. The project design doc describes six pages plus a full recommendation engine; only the catalog and detail view have a working backend today. The recommendation engine, Compare, and Pair pages each need their own backend work and are out of scope for this spec — they get their own design/plan cycles later.

## Goals

- A working, navigable multi-page site: Home, Explore, Wine Detail, and four stub pages
- Explore: search, filter (type, country, grape, price), sort, and paginate through the real wine catalog
- Wine Detail: full wine record — characteristics, grape blend, description, retailer listings with outbound links
- Three swappable visual themes, defaulting to dark burgundy
- A small, additive backend change (name/winery search + CORS) rather than a parallel API rebuild

## Out of Scope

- Discover questionnaire, recommendation engine, match scoring
- Compare (side-by-side wine comparison)
- Pair (food-pairing suggestions)
- Learn content (grape/region/concept pages) — stub only
- Authentication, accounts, saved wines
- Deployment/hosting configuration

## Tech Stack

- **React 18 + TypeScript + Vite** — per the project design doc; fast dev server, component-based, good fit for a filtering-heavy UI
- **Tailwind CSS** — utility-first styling, pairs well with a CSS-custom-property theme system
- **react-router-dom** — client-side routing across the 7 pages
- **No TanStack Query.** This slice has exactly two data-fetching pages (list, detail) with no mutations, no cache invalidation, and no shared cross-page server state beyond what a page owns for its own lifetime. A query library's caching/retry/invalidation machinery has nothing to do here — YAGNI. A small custom hook (see Data Flow) covers it in ~30 lines.
- **Vitest + React Testing Library** — component/integration tests

## Theming

Three palettes, implemented as CSS custom properties scoped by `[data-theme="…"]` on `<html>`:

- `dark-burgundy` (default) — charcoal-burgundy background (`#231416`/`#2f1b1e`), cream text (`#e8dcc8`), gold accents (`#c9a86a`)
- `cream-terracotta` — cream background (`#f5efe6`), dark warm text (`#3a2a22`), terracotta accent (`#a8452f`)
- `charcoal-gold` — neutral dark charcoal (`#1c1c1e`/`#242426`), off-white text (`#f0f0f0`), gold accent (`#d4af6a`)

A theme switcher (three small swatches or a dropdown) lives in the site header. Selection persists to `localStorage` (`vinoscope-theme`) and is read on load before first paint (inline script in `index.html`) to avoid a flash of the wrong theme. Wine names use a serif font (Georgia) in all three themes; UI chrome uses a sans-serif stack.

## Pages & Routing

| Route | Page | Behavior |
|---|---|---|
| `/` | Home | Hero ("Find a wine you'll actually enjoy"), CTA button into `/explore`, short nav/teaser links to the stub pages |
| `/explore` | Explore | Wine grid with search/filter/sort, "Load more" pagination |
| `/wines/:id` | Wine Detail | Full wine record; 404 → "Wine not found" page if the API returns 404 |
| `/discover` | Stub | Placeholder: what Discover will become (recommendation questionnaire) |
| `/pair` | Stub | Placeholder: food-pairing search |
| `/compare` | Stub | Placeholder: side-by-side wine comparison |
| `/learn` | Stub | Placeholder: grape/region/wine-concept education |

All 7 routes are reachable from a persistent header nav. Stub pages share one `StubPage` component taking a title and a one-paragraph description as props — no separate component per stub page.

## Explore Page

**Layout:** Full-width wine grid (3-up desktop, 2-up tablet, 1-up mobile). A "Filters" button (showing an active-filter count badge, e.g. "Filters (2)") opens a slide-out drawer containing:

- Search box — matches wine name OR winery name (new `q` param, see Backend Changes)
- Type — dropdown: All types / Red / White / Rosé / Sparkling (matches the project design doc's own type taxonomy)
- Country — dropdown: All countries / United States / France / Italy / Spain / Argentina / Australia / Other (same curated list the project design doc uses for "region preference" in the Discover questionnaire — reused here to avoid free-text typos against the API's exact-match country filter, and to avoid needing a new backend facets endpoint)
- Grape — free-text input (substring match against the existing `grape` param, e.g. "cabernet")
- Price range — two number inputs (min/max), mapped to `min_price`/`max_price`
- Sort — dropdown: Winery (A–Z) [default] / Price: Low to High / Price: High to Low / Vintage

Filters apply on drawer close (or an explicit "Apply" button) rather than live on every keystroke, to avoid refetching on every character typed into search/grape. Applying resets pagination to the first page.

**Wine card** shows: bottle image (or placeholder graphic if `image_url` is null), wine name (serif), winery + vintage, country/region, a small type badge (Red/White/Rosé/Sparkling), primary grape or "Blend" if 2+ grapes, and price (or "Price unavailable" if null). Clicking a card navigates to `/wines/:id`.

**Pagination:** "Load more" button below the grid, fetching the next `limit`/`offset` page and appending to the existing results. Button is hidden once `items.length === total`. No infinite scroll, no numbered pages.

**States:** Loading shows skeleton cards (same grid shape, pulsing placeholders) on first load and on filter-change refetch. Zero results shows a "No wines match your filters" message with a clear-filters action. A request error shows a message with a retry button.

## Wine Detail Page

**Layout:** Split — bottle image (or placeholder) fixed-width on the left, all info in a right-hand column, on desktop/tablet. On mobile (below Tailwind's `md` breakpoint), the image sits above the info column — no separate mobile-specific markup, just a `flex-col md:flex-row` container.

**Right column contents, top to bottom:**
1. Name (serif), winery, vintage, country/region/subregion
2. Characteristic bars — sweetness, acidity, tannin, body, fruitiness — each a labeled horizontal bar (value/5, or "Not rated" if null) using the theme's accent color
3. Grape blend — list of grapes with percentages where known (already ordered percentage-desc/nulls-last/alphabetical by the API)
4. ABV, description
5. Retailer listings — retailer name, price, and an outbound "View Retailer" link (`target="_blank" rel="noopener noreferrer"`) per listing; "No retailers currently listed" if `listings` is empty

404 (unknown id) renders a small "Wine not found" page with a link back to Explore, matching the API's `{"detail": "Wine not found"}` response.

## Backend Changes Required

Two small additions to the existing FastAPI app, not a new API:

1. **Search param.** `GET /api/wines` gains an optional `q: Optional[str] = None` query param. In `app/services/wines.py`, `list_wines` filters to wines where `q` (case-insensitive substring) matches `Wine.name` OR `Winery.name`, reusing the `_escape_like` helper already added for the `grape` filter (so `q`'s own `%`/`_`/`\` are escaped the same way). Combines with other filters via AND, same as existing filters.
2. **CORS.** `backend/app/main.py` currently has no CORS middleware, so the frontend dev server cannot call the API cross-origin. Add `CORSMiddleware` allowing the Vite dev origin (`http://localhost:5173`), read from an env var (`CORS_ORIGINS`, comma-separated, defaulting to `http://localhost:5173`) so a future deployed frontend origin can be added without a code change.

No other endpoints, schema changes, or migrations are needed for this slice.

## Data Flow

`src/services/api.ts` — a thin wrapper around `fetch`, reading `VITE_API_BASE_URL` from Vite env (`.env` → `VITE_API_BASE_URL=http://localhost:8000`). Exposes `listWines(params)` and `getWine(id)`, both typed against the response shapes in `src/types/wine.ts` (mirroring the backend's `WineListResponse`/`WineListItem`/`WineDetail` Pydantic schemas).

A small `useApiQuery<T>(fetcher, deps)` hook in `src/hooks/` runs `fetcher` on mount and when `deps` change, tracking `{ data, loading, error }`. Both Explore and Wine Detail use it — Explore additionally manages an appended-items list across "Load more" clicks (not something the generic hook needs to know about; that accumulation logic lives in the Explore page itself, calling `listWines` directly for the "load more" case rather than through the mount-triggered hook).

## Component Architecture

```
src/
├── components/
│   ├── layout/        Header (nav + theme switcher), Footer, PageShell
│   ├── wine/           WineCard, WineGrid, CharacteristicBar, RetailerListing
│   ├── explore/         FilterDrawer, FilterButton, LoadMoreButton, EmptyState
│   └── common/          Skeleton, ErrorMessage, StubPage
├── pages/
│   ├── HomePage.tsx
│   ├── ExplorePage.tsx
│   ├── WineDetailPage.tsx
│   └── StubPages.tsx    (renders StubPage per route with route-specific copy)
├── hooks/
│   └── useApiQuery.ts
├── services/
│   └── api.ts
├── types/
│   └── wine.ts
├── theme/
│   └── themes.css       (the three [data-theme] palettes as CSS custom properties)
└── utils/
    └── (placeholder image asset, formatting helpers e.g. price/percentage display)
```

Each component has one responsibility: `WineCard` renders one wine summary and knows nothing about fetching; `FilterDrawer` renders filter controls and reports changes upward (controlled by `ExplorePage`, which owns filter state and re-fetches); `CharacteristicBar` renders one labeled bar given a 1–5 value or null.

## Testing Strategy

Vitest + React Testing Library. The API layer (`src/services/api.ts`) is mocked at the test boundary (`vi.mock`) — this is the correct boundary for frontend tests, unlike the backend's real-Postgres constraint: these tests verify rendering and interaction (filters update the query, "Load more" appends, 404 renders the not-found state), not query correctness, which the backend's own test suite already covers against real data.

Coverage for this slice:
- `WineCard` renders all fields, and the null-price/null-image fallback states
- `ExplorePage`: initial load renders results; changing a filter re-fetches with the right params; "Load more" appends and hides once exhausted; empty results and error states render
- `WineDetailPage`: renders a full record; renders the 404 state; renders zero-listings state
- `FilterDrawer`: opening/closing, filter values reach the parent's applied-filters state on Apply
- Theme switcher: selecting a theme sets `data-theme` and persists to `localStorage`

## Global Constraints

- No new runtime dependencies beyond React, TypeScript, Vite, Tailwind, react-router-dom, and their build tooling — no TanStack Query, no UI component library (cards/drawer/buttons are hand-built with Tailwind, matching the project design doc's preference for "a relatively custom visual design" over a generic dashboard look)
- Backend changes are additive only (`q` param, CORS middleware) — no changes to existing endpoint behavior, response shapes, or the constraints from the wines-api design spec
- All new frontend code lives under `frontend/`, matching the repository structure already documented in `docs/VinoScope_Project_Design.md`
- Stub pages contain no real functionality — nav link + heading + one descriptive paragraph, via the shared `StubPage` component
- Mobile-responsive down to phone width for all built (non-stub) pages
