# VinoScope Recommendation Engine Design

## Overview

A stateless `POST /api/recommendations` endpoint that ranks wines by similarity to a user's stated preferences, using weighted Euclidean distance over the wine characteristic fields already in the schema. No accounts, no server-side persistence — the client sends the full questionnaire answer set on every request and is responsible for remembering it (e.g. `localStorage`), matching the project design doc's guidance for this phase.

This is backend-only. The Discover page (the questionnaire UI that calls this endpoint) is a separate, later spec/plan.

## Goals

- Rank the wine catalog by similarity to a set of user-supplied preferences on sweetness, acidity, tannin, body, and fruitiness
- Treat "I'm unsure" (an omitted/null answer) as a missing dimension, not a neutral midpoint — excluded from the distance calculation entirely, never penalized
- Apply hard filters (type, country, price range) before scoring, reusing the existing Wines API's filter semantics exactly
- Return a human-readable "Your Wine Profile" summary and a short "why this matched" explanation per wine
- Reuse the existing `WineListItem` response shape so the frontend can render recommendation results with the same `WineCard` component used on Explore

## Out of Scope

- Any style-tier/grape-style grouping stage (no style taxonomy exists in the schema) — results are individual bottles only
- Food-pairing preference (no `food_pairings` data model exists — this is deferred to whenever the Pair page gets built)
- The categorical "fruit profile" question from the project design doc (light/red/dark/tropical/citrus fruit *type*) — the schema only has a single `fruitiness` *intensity* field (1–5), so the questionnaire's fruit dimension maps to intensity only
- Server-side persistence of questionnaire answers or profiles (no accounts exist)
- The Discover page frontend itself (separate spec/plan)
- Per-dimension importance weighting by the user — all soft dimensions are weighted equally for this slice

## Data Grounding

Verified directly against the dev database (`vinoscope`), not just the CSV, since these values become the accepted hard-filter values:

- `type`: exactly `red`, `white`, `rosé`, `sparkling`, `fortified` (5 values)
- `country`: exactly `Argentina`, `Australia`, `Chile`, `France`, `Germany`, `Italy`, `New Zealand`, `Portugal`, `Spain`, `United States` (10 values)
- `sweetness`, `acidity`, `tannin`, `body`, `fruitiness`: all integers, all within 1–5 in the current 100-wine dataset (no nulls currently present, but the schema allows them and the algorithm must handle that)

## Algorithm

**Hard filters** (applied first, identical semantics to `list_wines` in the Wines API): `type` (case-insensitive exact match), `country` (case-insensitive exact match), `min_price`/`max_price` (against `MIN(retailer_listings.price)`, same subquery `_min_price_subquery` reused from `app/services/wines.py`). Wines failing any supplied hard filter are excluded entirely — they get no score and appear nowhere in the response.

**Soft preferences**: `sweetness`, `acidity`, `tannin`, `body`, `fruitiness`. For each candidate wine (post hard-filter), compute weighted Euclidean distance over only the dimensions where **both** the user supplied a value **and** the wine has a non-null value for that dimension:

```
d(U, W) = sqrt( sum_i( w_i * (U_i - W_i)^2 ) / sum_i(w_i) )   over i where U_i and W_i are both known
```

All weights `w_i = 1` (no per-dimension importance for this slice). If the overlap set is empty for a given wine (the user answered nothing, or every dimension the user answered is null on that particular wine), `d = 0` — the wine is treated as a perfect/neutral match rather than excluded or penalized. This also covers the all-`None` request case (a user who answers nothing at all): every hard-filtered candidate gets `d = 0`.

**Match score**: `match_score = 1 / (1 + d)`, a float in `(0, 1]`. Returned as a raw float — the frontend formats it as a percentage.

**Sorting**: by `match_score` descending, with `Winery.name` ascending then `Wine.id` as tiebreakers (same tiebreak convention as `list_wines`'s default sort, so ties resolve deterministically). This also means the "answered nothing" case degrades gracefully to alphabetical-by-winery, matching Explore's own default.

**Pagination**: `limit`/`offset`, same bounds as the Wines API (`limit` 1–100 default 20, `offset` >= 0 default 0). `total` in the response is the count of wines passing the hard filters (i.e. the full scored candidate set), not just the returned page — same semantic as `list_wines`'s `total`.

## Descriptive Labels

A single lookup table converts a raw 1–5 value on any of the five dimensions into a short phrase, used for both the profile summary and per-wine explanations:

| Value | Sweetness | Acidity | Tannin | Body | Fruitiness |
|---|---|---|---|---|---|
| 1 | Very dry | Low acidity | Low tannin | Very light-bodied | Subtle fruit |
| 2 | Dry | Medium-low acidity | Medium-low tannin | Light-bodied | Light fruit |
| 3 | Off-dry | Medium acidity | Medium tannin | Medium-bodied | Moderate fruit |
| 4 | Sweet | Medium-high acidity | Medium-high tannin | Full-bodied | Fruit-forward |
| 5 | Very sweet | High acidity | High tannin | Very full-bodied | Very fruit-forward |

## Profile Summary Generation

`profile.description` is a list of short strings built from the request:
- One phrase per answered soft dimension, via the label table above (e.g. `sweetness=1` → `"Very dry"`)
- `"Primarily {type} wines"` if `type` was supplied as a hard filter
- If both `min_price` and `max_price` were supplied: `"Preferred price range: ${min_price}–${max_price}"`. If only `max_price`: `"Preferred price: under ${max_price}"`. If only `min_price`: `"Preferred price: ${min_price} and up"`.
- If nothing was answered at all (no soft dimensions, no hard filters), the list is empty — the frontend is expected to handle an empty profile gracefully (this is a valid, if uninformative, request)

## Explanation Generation

`explanation` is a per-wine list of short strings, built from:
- Each hard filter that was applied and this wine satisfies (all of them, since it's in the result set): the same price phrasing rules as the profile summary above (both/max-only/min-only), `"{Type} wine as requested"`, `"From {country}"`
- Each soft dimension where the wine's value is known, the user supplied a value, and `abs(U_i - W_i) <= 1` (a close match): the wine's own value's label from the table above (e.g. wine's `tannin=5` when user asked for `tannin=4` → `"High tannin"`)

If a wine has zero close-matching soft dimensions and no hard filters were supplied, `explanation` may be an empty list — this is valid (it happens for the "answered nothing" case where everything scores as a neutral match).

## API Contract

```
POST /api/recommendations
```

Request body (all fields optional; an all-omitted body is valid):
```json
{
  "sweetness": 1,
  "acidity": null,
  "tannin": 4,
  "body": 5,
  "fruitiness": null,
  "type": "red",
  "country": null,
  "min_price": null,
  "max_price": 40,
  "limit": 20,
  "offset": 0
}
```
- `sweetness`/`acidity`/`tannin`/`body`/`fruitiness`: `int`, 1–5 inclusive, or omitted/null for "I'm unsure" — validated via Pydantic `Field(ge=1, le=5)`
- `type`: `str` or omitted — no enum validation at the API layer (an unrecognized value simply matches zero wines, same as the existing Wines API's `type` filter)
- `country`: `str` or omitted, same treatment
- `min_price`/`max_price`: `float >= 0` or omitted
- `limit`: `int`, 1–100, default 20
- `offset`: `int >= 0`, default 0

Response:
```json
{
  "profile": { "description": ["Very dry", "Full-bodied", "Primarily red wines", "Preferred price range: $0–$40"] },
  "total": 12,
  "items": [
    {
      "id": 42,
      "name": "...",
      "winery": "...",
      "vintage": 2022,
      "type": "red",
      "country": "United States",
      "region": "Napa Valley",
      "grapes": [{ "name": "Cabernet Sauvignon", "percentage": 100.0 }],
      "price": 35.0,
      "image_url": null,
      "sweetness": 1,
      "acidity": 3,
      "tannin": 5,
      "body": 5,
      "fruitiness": 3,
      "match_score": 0.87,
      "explanation": ["Within your $0–$40 price range", "Red wine as requested", "High tannin"]
    }
  ]
}
```

`RecommendationItem` is `WineListItem` plus `match_score: float` and `explanation: list[str]` — same Pydantic-subclassing pattern `WineDetail` already uses over `WineListItem`.

Invalid request bodies (an out-of-range dimension value, `limit` out of bounds, etc.) return FastAPI's automatic `422` via `Field`/`Query` constraints — no manual validation code, matching the Wines API's existing convention.

## File Structure

- Create: `backend/app/schemas/recommendation.py` — `RecommendationRequest`, `ProfileOut`, `RecommendationItem`, `RecommendationResponse`
- Create: `backend/app/services/recommendations.py` — `get_recommendations(db, *, sweetness=None, acidity=None, tannin=None, body=None, fruitiness=None, type=None, country=None, min_price=None, max_price=None, limit=20, offset=0) -> tuple[int, list[str], list[dict]]` (total, profile description lines, item dicts each including `match_score` and `explanation`), plus the distance/scoring/label/explanation helper functions
- Create: `backend/app/api/recommendations.py` — the route, registered in `main.py` under the same `/api` prefix as the wines router
- Modify: `backend/app/main.py` — register the new router
- Test: `tests/api/test_recommendations.py`

Reused, not duplicated: `_min_price_subquery`, `_grapes_for_wines`/`_grapes_for_wine`, `_row_to_dict` from `app/services/wines.py` — the recommendation service builds on the same query-building blocks rather than re-deriving them.

## Testing Strategy

Same convention as the rest of the backend: FastAPI `TestClient` against real Postgres (`vinoscope_test`) via the existing `get_db` override and `seeded_wines`/`db_session` fixtures — no mocks. Coverage needed:
- Hard filters exclude non-matching wines entirely (type, country, price)
- Soft-dimension distance ranks a closer match above a farther one
- A dimension the user left null is excluded from scoring (doesn't affect rank)
- A dimension null on the *wine* (not the user) is excluded for that wine only, not the whole wine
- A wine with zero overlapping dimensions still appears, with a neutral score
- An empty request body (nothing answered) returns all wines with equal score, sorted by winery
- Profile description reflects the answered dimensions and hard filters
- Explanation includes satisfied hard filters and close-matching soft dimensions
- Pagination (`total` reflects the full hard-filtered candidate set, `items` respects `limit`/`offset`)
- Invalid dimension value (e.g. `sweetness: 6`), invalid `limit`, invalid `offset` all return `422`

## Known Limitations (found 2026-09-23, during the Pair page's final review; both fixed 2026-09-23)

**~~Wines with no recorded characteristics score a perfect (100%) match on every request.~~ Fixed.** `_distance` (`app/services/recommendations.py`) now distinguishes "the user asked for nothing" (every wine still ties at a neutral `0.0` distance — unchanged, still covered by `test_recommendations_empty_request_returns_all_wines_equal_score_sorted_by_winery`) from "the user asked about some dimensions, but this wine has no data on any of them" (now returns `float("inf")`, i.e. the worst possible score, instead of `0.0`/a perfect match). Covered by `test_recommendations_wine_with_zero_overlap_gets_worst_score` (`tests/api/test_recommendations.py`) and `test_nearest_selected_level_and_equal_dimension_weights` (`tests/test_multi_preferences.py`).

**~~Multi-level preferences (`list[int]`) produce awkward profile-chip phrasing.~~ Fixed.** `build_profile` now renders a single level as its own label (unchanged) and multiple levels as `"{lowest label} to {highest label}"` instead of joining every level with `" or "` — e.g. `sweetness: [3, 4]` → `"Off-dry to Sweet"`, Cheese's `body: [3, 4, 5]` → `"Medium-bodied to Very full-bodied"`. Covered by `test_profile_and_explanations_use_all_selected_levels` (`tests/test_multi_preferences.py`) and `test_multiple_preferences_rank_each_selected_level_as_a_match` (`tests/api/test_recommendations.py`).
