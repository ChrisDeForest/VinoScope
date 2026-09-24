# VinoScope Pair Page Design

## Overview

The Pair page: pick a food, get ranked wine matches. It reuses the existing `POST /api/recommendations` endpoint with a static, hand-authored preference vector per food — no new backend endpoint, schema, or database table. Replaces the current `/pair` stub. This is the second frontend consumer of the recommendation engine (after Discover), reusing the same soft-dimension scoring rather than independent hard-coded pairing logic, per the project design doc's intent for the Pair page.

## Goals

- A grid of food choices (Steak, Burgers, Chicken, Salmon, Shellfish, Pasta, Pizza, Spicy foods, Cheese, Chocolate, Dessert); picking one immediately shows ranked wine results
- Each food maps to a fixed soft-preference vector (sweetness/acidity/tannin/body/fruitiness), sent to `/api/recommendations` exactly like Discover sends a user-filled vector
- Results reuse the same match %, explanation line, pagination, loading, and error UI already built for Discover
- "Choose a different food" returns to the picker without losing the ability to re-pick

## Out of Scope

- Any backend changes — no `food_pairings`/`wine_food_pairings` tables, no new endpoint. The recommendation engine already accepts everything Pair needs (soft dimensions as `int | list[int] | None`, hard filters, pagination)
- Combining the food vector with the user's saved Discover profile — each food's vector is sent standalone; no merge logic
- A hard wine-`type` filter per food (e.g. forcing Steak to `type=red`) — only the five soft dimensions are set, so a wine of any type can still rank well if its characteristics fit, matching the project design doc's own Steak example
- `localStorage` persistence of the selected food — picking a food always fetches fresh; the picker resets on navigation away and back
- Editing/managing the food→vector table from the admin panel — it's a static frontend constant

## Food Vectors

Each food is a partial `RecommendationAnswers` (soft dimensions only, 1–5 scale, expressed as `[min, max]` ranges rather than single points so a wine only needs to land in the right neighborhood — the same `int | list[int]` shape the recommendation engine already supports for Discover's multi-select dimension fields). Ranges follow standard pairing heuristics: match the wine's weight to the food's weight, use acidity/tannin to cut fat and richness, keep the wine at least as sweet as the food, and avoid tannin with spicy heat.

| Food | Sweetness | Acidity | Tannin | Body | Fruitiness | Rationale |
|---|---|---|---|---|---|---|
| Steak | 1 | 3–4 | 4–5 | 4–5 | 3–4 | Bold, high-tannin reds cut through the fat and match the richness |
| Burgers | 1–2 | 3–4 | 3–4 | 3–4 | 3–4 | Juicy, fruit-forward reds with moderate structure |
| Chicken | 1–2 | 3–4 | 1–3 | 2–4 | 2–4 | Versatile white meat — lighter reds or fuller whites both work |
| Salmon | 1–2 | 4–5 | 1–2 | 2–3 | 2–3 | High acidity cuts the fish's natural oiliness; low tannin avoids a metallic clash |
| Shellfish | 1 | 4–5 | 1 | 1–2 | 1–2 | Crisp, delicate, high-acid whites that don't overpower |
| Pasta | 1–2 | 4–5 | 2–4 | 2–4 | 2–4 | High acidity stands up to tomato-based sauces |
| Pizza | 1–2 | 4–5 | 2–3 | 2–3 | 3–4 | Bright, medium-bodied reds like the Italian table-wine tradition |
| Spicy foods | 2–3 | 3–4 | 1–2 | 1–3 | 3–5 | A touch of sweetness cools the heat; low tannin avoids amplifying it |
| Cheese | 1–3 | 2–4 | 2–4 | 3–5 | 2–4 | Broad range reflecting how differently soft vs. aged cheeses pair |
| Chocolate | 4–5 | 1–2 | 2–4 | 4–5 | 4–5 | The wine must be sweeter than the chocolate itself, full-bodied, fruit-forward |
| Dessert | 4–5 | 1–3 | 1–2 | 2–4 | 3–5 | Sweet, low-tannin, fruit-forward — the wine outsweetens the dish |

This table lives as data (`FOOD_PAIRINGS`) in `frontend/src/constants/foodPairings.ts`, one entry per food with the vector plus the rationale string (shown on the food's picker tile as a one-line blurb).

## Page Behavior

Single component state machine with two modes, no routing change (`/pair` stays one route):

1. **Picker mode** (default, and returned to via "Choose a different food"): a grid of food tiles, each showing the food name and its rationale blurb.
2. **Results mode** (after picking a food): the picker is replaced by a "Pairing with {Food}" heading, the profile summary (the backend's own `profile.description` phrases, e.g. "High tannin", "Full-bodied"), and ranked wine results.

Picking a food fetches `POST /api/recommendations` with that food's vector (`limit`/`offset` only — no `type`/`country`/price filters). Loading shows the same skeleton-grid pattern as Explore/Discover. A request failure shows `ErrorMessage` with retry. Results paginate via the same "Load more" pattern already used on Explore and Discover, including the stale-request-safe reset (`loadingMore`/`loadMoreError` reset alongside `items` when the food selection changes), matching the fix already applied to Discover's request-guard pattern.

## Data Flow

- `frontend/src/constants/foodPairings.ts` — new file: `FOOD_OPTIONS: FoodKey[]` (the 11 food identifiers, in table order) and `FOOD_PAIRINGS: Record<FoodKey, { label: string; blurb: string; vector: RecommendationAnswers }>`. `FoodKey` is a string literal union of the 11 foods.
- No changes to `types/wine.ts` or `services/api.ts` — `RecommendationAnswers`, `RecommendationRequest`, `RecommendationResponse`, and `getRecommendations` are reused exactly as Discover uses them.
- `components/discover/ProfileSummary.tsx` gains an optional `title?: string` prop (default `"Your Wine Profile"`), so Pair can render the same component with `title={`Pairing with ${label}`}` instead of duplicating the summary box markup.

## Component Architecture

```
frontend/src/
├── constants/
│   └── foodPairings.ts         FoodKey, FOOD_OPTIONS, FOOD_PAIRINGS (new)
├── components/
│   ├── discover/
│   │   └── ProfileSummary.tsx  (modified: optional title prop, defaults to "Your Wine Profile")
│   └── pair/
│       └── FoodPicker.tsx      grid of food tiles; onSelect(food: FoodKey) (new)
└── pages/
    └── PairPage.tsx            owns picker/results mode, fetch, pagination;
                                  moved out of StubPages.tsx (PairPage's stub export is removed there)
```

`App.tsx` is updated to import `PairPage` from `./pages/PairPage` instead of `./pages/StubPages`.

## Testing Strategy

Same Vitest + React Testing Library conventions as the rest of the frontend, API layer mocked at `services/api.ts`:
- `foodPairings.ts`: every `FOOD_OPTIONS` entry has a matching `FOOD_PAIRINGS` record; every vector's dimension values fall within 1–5
- `FoodPicker`: renders one tile per food with its label and blurb; clicking a tile calls `onSelect` with the right `FoodKey`
- `ProfileSummary`: renders the default title when none is passed; renders a custom title when passed (existing Discover usage unaffected)
- `PairPage`: picking a food fetches with that food's exact vector and switches to results mode; "Choose a different food" returns to picker mode; Load more appends and resets correctly if the food selection changes mid-fetch (mirrors the Discover/Admin stale-request regression test); error state renders with retry; empty results render a message with a way back to the picker

## Global Constraints

- No new runtime dependencies, no backend changes.
- Each food vector is authored as `[min, max]` ranges (`list[int]`), never a bare unset dimension, so every food produces a meaningfully different ranking rather than degrading to "all wines, neutral score."
- `ProfileSummary`'s existing Discover behavior must be unchanged when `title` is not passed.
- Mobile-responsive down to phone width, consistent with the rest of the built (non-stub) pages.
