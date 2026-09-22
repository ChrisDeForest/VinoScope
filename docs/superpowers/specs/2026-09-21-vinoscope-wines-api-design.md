# VinoScope — Wines API Design

Date: 2026-09-21
Status: Approved
Scope: First slice of the FastAPI backend for VinoScope. Builds a read-only Wines API (list with filters/sorting/pagination, detail by id) on top of the data layer (`docs/superpowers/specs/2026-09-21-vinoscope-data-layer-design.md`), which is already populated with 100 real wines. The recommendation engine, "similar wines," search, questionnaire, and frontend are separate future specs.

## Why this phase

The FastAPI app and Wines API are the foundation every later backend feature (recommendation engine, "more like this," search) sits on top of. Building it read-only and filter/sort-only first, against real data already in the database, makes it independently useful and testable before the recommendation logic exists.

## Approach

Synchronous SQLAlchemy throughout (matches the data layer's `get_engine`/`get_session_factory`; no need for async SQLAlchemy at this data scale). Layered structure — routes stay thin, a services module owns query-building, a schemas module owns response shapes — so the recommendation engine phase can reuse `services/wines.py`'s query logic (e.g. for "similar wines") instead of duplicating it in route handlers.

## 1. File structure

```
backend/
├── app/
│   ├── main.py                  # FastAPI app instance, mounts routers
│   ├── api/
│   │   ├── deps.py              # get_db() session dependency
│   │   └── wines.py             # router: GET /api/wines, GET /api/wines/{id}
│   ├── schemas/
│   │   └── wine.py              # Pydantic response models
│   └── services/
│       └── wines.py             # query-building: list_wines(), get_wine()
├── requirements.txt              # + fastapi, uvicorn[standard], httpx
tests/
└── api/
    └── test_wines.py            # FastAPI TestClient tests against real vinoscope_test DB
```

`app/models` (schema) and `app/database` (session/engine setup) from the data layer phase are untouched — this phase only adds `api/`, `schemas/`, `services/`, and `main.py`.

## 2. Endpoints & response schemas

### `GET /api/wines` — list with filters, sorting, pagination

Query params:
- `type` — exact match (case-insensitive) against `wines.type`
- `country` — exact match (case-insensitive) against `wines.country`
- `grape` — case-insensitive substring match against grape name (via `wine_grapes`/`grapes`), so `grape=cabernet` matches "Cabernet Sauvignon"
- `min_price`, `max_price` — filter on the per-wine minimum listed price
- `sort` — one of `price_asc`, `price_desc`, `vintage`, `winery`; default `winery`
- `limit` — default 20, max 100
- `offset` — default 0

Response:
```json
{
  "total": 100,
  "items": [
    {
      "id": 1,
      "name": "Caymus Napa Valley Cabernet Sauvignon",
      "winery": "Caymus Vineyards",
      "vintage": 2023,
      "type": "red",
      "country": "United States",
      "region": "Napa Valley",
      "grapes": [{"name": "Cabernet Sauvignon", "percentage": null}],
      "price": 79.99,
      "image_url": null,
      "sweetness": 1, "acidity": 3, "tannin": 5, "body": 5, "fruitiness": 3
    }
  ]
}
```

### `GET /api/wines/{id}` — full detail

All list fields, plus:
- `subregion`, `abv`, `description`
- `listings`: `[{"retailer": "Total Wine", "price": 79.99, "currency": "USD", "product_url": "...", "availability": null}]`

Returns `404` with `{"detail": "Wine not found"}` if the id doesn't exist.

### Shared field semantics

- `price` on both list and detail views is `MIN(retailer_listings.price)` for that wine; `null` if the wine has no listings.
- `grapes` is built from `wine_grapes` joined to `grapes`, ordered by `percentage` descending with nulls last, so the primary grape of a blend shows first.

## 3. Query implementation & error handling

`services/wines.py` builds one SQLAlchemy query against `Wine` joined to `Winery` (for the winery name) and to `RetailerListing` (for the price aggregate), applying each filter conditionally — only the filters actually supplied by the caller affect the `WHERE` clause. `min_price`/`max_price` filter on the per-wine minimum-price aggregate; a wine with no listings is excluded whenever either price bound is set, but included in an unfiltered-by-price list.

`total` is a separate `COUNT(*)` query with the same filters applied, computed before `limit`/`offset`, so pagination UI can compute page counts without fetching every row.

Error handling:
- `GET /api/wines/{id}` with an unknown id → `404`, `{"detail": "Wine not found"}`
- Invalid query params (e.g. `sort=bogus`, negative `limit`, non-numeric `min_price`) → FastAPI's automatic `422` via `Literal`/`Query` constraints declared on the endpoint signature — no manual validation code
- A DB connection failure surfaces as FastAPI's default `500` — no special handling needed at this scale

## 4. Testing

Following the data layer's pattern: real Postgres (`vinoscope_test`), never mocks.

- `tests/api/test_wines.py` uses FastAPI's `TestClient`, with a fixture that overrides the app's `get_db()` dependency to point at `TEST_DATABASE_URL` and seeds known wines/wineries/listings before each test, tearing down (`Base.metadata.drop_all`) after — same create/drop pattern as the data layer's existing model tests.
- Coverage:
  - List with no filters: pagination shape correct, `total` matches seeded count
  - Each filter individually: `type`, `country`, `grape`, `min_price`/`max_price`
  - Each `sort` option
  - A wine with multiple retailer listings → `price` is the minimum
  - A wine with zero listings → `price` is `null`, and it's excluded when a price filter is set
  - A blend wine → `grapes` ordered by percentage descending
  - Detail-by-id happy path
  - Detail-by-id 404
- `backend/requirements.txt` gains `fastapi`, `uvicorn[standard]`, `httpx`.

## Out of scope for this phase

- Recommendation engine, weighted distance scoring, questionnaire endpoint
- "Similar wines" / "more like this"
- Full-text/fuzzy search (`GET /api/search`)
- Wine rating field (deferred — not in the current schema or CSV; add later if/when rating data is collected)
- Frontend
- Authentication
- Write endpoints (create/update/delete wines via the API) — data entry stays on the CSV pipeline from the data layer phase
