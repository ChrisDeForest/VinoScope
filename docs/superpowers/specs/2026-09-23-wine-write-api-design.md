# Wine & Listing Write API — Design

## Problem

The backend is entirely read-only today: `GET /api/wines` and `GET
/api/wines/{id}` are the only two routes (`backend/app/api/wines.py`), and
data only ever enters the database via the offline CSV import pipeline
(`scripts/import_wines.py`). There is no way to correct a wine's data —
notably its price — once it's in the database without re-running the whole
import pipeline against edited source CSVs. This spec adds a small write
API so a wine's own fields and its retailer listings (where price/currency
actually live) can be edited directly.

## Decision

Two resources, mirroring the existing `Wine` / `RetailerListing` model
split:

- `PATCH /api/wines/{id}` — edit a wine's own scalar fields.
- `POST /api/wines/{id}/listings`, `PATCH
  /api/wines/{id}/listings/{listing_id}`, `DELETE
  /api/wines/{id}/listings/{listing_id}` — full CRUD on a wine's retailer
  listings (price, currency, availability, URL).

All five endpoints require a shared-secret header, since the app has no
user/auth system at all today and this is the first write surface exposed.

Explicitly out of scope: creating a brand-new wine (still CSV-import-only),
editing a wine's grape blend, and any frontend UI for these endpoints (this
is an API-only feature; a future spec could add an admin UI on top of it).

## Write Authentication

A single shared secret, `ADMIN_API_KEY`, read from the environment (added
to `.env` and `.env.example`, following the existing `os.environ.get(...)`
convention already used for `CORS_ORIGINS` in `backend/app/main.py`).

New dependency in `backend/app/api/deps.py`:

```python
import os
from fastapi import Header, HTTPException


def require_admin_key(x_admin_key: str | None = Header(default=None)) -> None:
    expected = os.environ.get("ADMIN_API_KEY")
    if not expected or x_admin_key != expected:
        raise HTTPException(status_code=401, detail="Invalid or missing admin key")
```

Every write route below takes `_: None = Depends(require_admin_key)`.

**Supporting fix:** `backend/app/main.py`'s CORS middleware currently sets
`allow_methods=["GET", "POST"]`, which would block browser `PATCH`/`DELETE`
requests (and their preflight `OPTIONS`) outright. Change to
`allow_methods=["GET", "POST", "PATCH", "DELETE"]`. `allow_headers=["*"]`
already permits the custom `X-Admin-Key` header through, so no change
needed there.

## `PATCH /api/wines/{id}`

**Request body** (`WineUpdate` schema, all fields optional — Pydantic
`exclude_unset=True` distinguishes "field omitted" from "field explicitly
set to null"):

```python
from typing import Annotated, Optional
from pydantic import BaseModel, Field, field_validator

VALID_TYPES = {"red", "white", "rosé", "sparkling", "dessert", "fortified"}
RatingLevel = Annotated[int, Field(ge=1, le=5)]


class WineUpdate(BaseModel):
    name: Optional[str] = None
    winery: Optional[str] = None
    vintage: Optional[int] = None
    type: Optional[str] = None
    country: Optional[str] = None
    region: Optional[str] = None
    subregion: Optional[str] = None
    abv: Optional[Annotated[float, Field(ge=0, le=100)]] = None
    sweetness: Optional[RatingLevel] = None
    acidity: Optional[RatingLevel] = None
    tannin: Optional[RatingLevel] = None
    body: Optional[RatingLevel] = None
    fruitiness: Optional[RatingLevel] = None
    description: Optional[str] = None
    image_url: Optional[str] = None

    @field_validator("type")
    @classmethod
    def _validate_type(cls, value):
        if value is not None and value.lower() not in VALID_TYPES:
            raise ValueError(f"invalid type {value!r}")
        return value
```

`VALID_TYPES` moves here from `scripts/import_wines.py` (currently defined
only there); `import_wines.py` imports it from `app.schemas.wine` instead
of redefining it — a one-line change there, keeping the two places that
validate `type` (CSV import and this API) from drifting apart.

**Behavior:**
- 404 `"Wine not found"` if the wine doesn't exist (same message as the
  existing `GET /api/wines/{id}` 404).
- If `winery` is provided, it's looked up by exact name (`Winery.name` is
  already `unique`). No match → 404 `"Winery not found"`. **No
  auto-create on typo** — unlike the CSV pipeline's `get_or_create_winery`,
  a wrong name here should fail loudly rather than silently create a
  duplicate winery row, since there's no `find_duplicates.py`-style safety
  net for API-created data.
- Every other provided field is written directly onto the `Wine` row via
  `model_dump(exclude_unset=True)`.
- Returns the updated wine as `WineDetail` (same shape `GET
  /api/wines/{id}` returns), 200.

## Listing Endpoints

**`POST /api/wines/{id}/listings`** — create a listing.

```python
class RetailerListingCreate(BaseModel):
    retailer: str
    price: Optional[Annotated[float, Field(ge=0)]] = None
    currency: Optional[str] = None
    availability: Optional[str] = None
    product_url: Optional[str] = None
```

`source_product_id` (scraper-provenance metadata on `RetailerListing`) is
deliberately left out of both listing schemas — it identifies a listing
within an external scraper's own catalog, which doesn't apply to a
manually created/edited listing.

`retailer` is get-or-create by name — reusing the same pattern
`scripts/import_wines.py`'s `get_or_create_retailer` already uses (query by
unique `name`, create if absent). Retailer names don't carry the same
typo/duplication risk winery names do (no fuzzy-matching concern has come
up for retailers anywhere in this project), so get-or-create is
appropriate here even though it isn't for wineries. `currency`, if given,
is uppercased server-side (`"eur"` → `"EUR"`) — not run through the CSV
pipeline's alias table (`"EURO"` → `"EUR"`), since that's a concession to
messy hand-typed CSV cells, not something a structured API call needs.
`collected_at` and `last_verified_at` are set to the current time. 404 if
the wine doesn't exist. Returns the created listing as
`RetailerListingOut`, 201.

**`PATCH /api/wines/{id}/listings/{listing_id}`** — edit a listing.

```python
class RetailerListingUpdate(BaseModel):
    price: Optional[Annotated[float, Field(ge=0)]] = None
    currency: Optional[str] = None
    availability: Optional[str] = None
    product_url: Optional[str] = None
```

Same partial-update semantics as `WineUpdate`. `currency` uppercased the
same way as on create. Also bumps `last_verified_at` to now, since editing
a listing is itself an act of verifying its data. 404 if the wine doesn't
exist, or if the listing doesn't exist *for that wine* (a listing ID that
exists but belongs to a different wine is also a 404, not a 200 that
silently edits the wrong wine's listing). Returns the updated listing as
`RetailerListingOut`, 200.

**`DELETE /api/wines/{id}/listings/{listing_id}`** — remove a listing. Same
404 rules as `PATCH`. 204 on success, no body.

## Data Flow

```
PATCH /api/wines/5  {"vintage": null, "abv": 14.2}
  -> require_admin_key (401 if missing/wrong X-Admin-Key)
  -> load Wine(id=5) or 404
  -> WineUpdate validates body (type/rating-range/abv-range checks)
  -> apply only the provided fields (vintage -> NULL, abv -> 14.2)
  -> commit
  -> return WineDetail(...) (200)

POST /api/wines/5/listings  {"retailer": "Total Wine", "price": 79.99, "currency": "usd"}
  -> require_admin_key
  -> load Wine(id=5) or 404
  -> get_or_create_retailer("Total Wine")
  -> currency.upper() -> "USD"
  -> insert RetailerListing(wine_id=5, ...), collected_at=now, last_verified_at=now
  -> return RetailerListingOut(...) (201)
```

## Error Handling

- `401` — missing or wrong `X-Admin-Key` header, on every write route.
- `404` — wine not found; winery name not found (wine update); listing not
  found or belongs to a different wine (listing update/delete).
- `422` (FastAPI/Pydantic default) — invalid `type`, out-of-range rating
  (not 1–5), out-of-range `abv` (not 0–100), negative `price`.
- Nothing here introduces a schema/migration change — all fields already
  exist on `Wine`/`RetailerListing`; this only adds ways to write them.

## Testing

Backend-only (`tests/api/test_wines.py`, extending the existing `client`/
`db_session` fixtures and `seeded_wines`-style fixtures):

- `PATCH /wines/{id}`: happy path updates a single field and leaves others
  untouched; explicit `null` clears a nullable field (e.g. `vintage`);
  unknown wine → 404; invalid `type` → 422; rating out of 1–5 → 422; `abv`
  out of 0–100 → 422; `winery` matching an existing name reassigns it;
  `winery` not matching any existing name → 404 (and does *not* create a
  new winery row); missing/wrong `X-Admin-Key` → 401; correct key → 200.
- `POST /wines/{id}/listings`: creates a listing with a new retailer
  (get-or-create verified by checking no duplicate retailer row is made on
  a second call with the same name); `currency` lowercased in the request
  comes back uppercased; unknown wine → 404; missing/wrong key → 401.
- `PATCH /wines/{id}/listings/{listing_id}`: happy path; `last_verified_at`
  changes; listing belonging to a different wine → 404; unknown listing →
  404; missing/wrong key → 401.
- `DELETE /wines/{id}/listings/{listing_id}`: happy path (listing gone
  afterward, verified via a follow-up `GET /wines/{id}`); listing belonging
  to a different wine → 404; missing/wrong key → 401.
- One CORS-preflight test (mirroring the existing
  `test_cors_allows_configured_frontend_origin` pattern) confirming `PATCH`
  is now an allowed method.
