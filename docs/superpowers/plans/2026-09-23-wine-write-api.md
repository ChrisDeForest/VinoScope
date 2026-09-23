# Wine & Listing Write API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a wine's own fields and its retailer listings (price, currency, availability, URL) be edited via a small admin-key-protected write API, since the backend is currently entirely read-only.

**Architecture:** A single shared-secret dependency (`require_admin_key`) protects five new routes: `PATCH /wines/{id}` for wine fields, and `POST`/`PATCH`/`DELETE` on `/wines/{id}/listings[/{listing_id}]` for retailer listings. Service functions in `backend/app/services/wines.py` do the actual DB writes and reuse the existing `get_wine`/`_listing_to_dict`-style response shaping so write responses match the existing read API exactly.

**Tech Stack:** FastAPI, Pydantic, SQLAlchemy 2.0, Postgres, pytest — no new dependencies.

## Global Constraints

- Every write route requires header `X-Admin-Key: <value>` matching the `ADMIN_API_KEY` environment variable. Missing or wrong → `401`.
- `backend/app/main.py`'s CORS `allow_methods` must include `PATCH` and `DELETE` (currently only `GET`, `POST`) or browser preflight requests to the new routes fail outright.
- Partial-update semantics on both `PATCH` endpoints: only fields present in the JSON body are changed (via Pydantic `exclude_unset=True`); an explicit `null` on a nullable field clears it.
- `type` must be one of `VALID_TYPES = {"red", "white", "rosé", "sparkling", "dessert", "fortified"}` — this set moves from `scripts/import_wines.py` into `backend/app/schemas/wine.py` as the single source of truth; `import_wines.py` imports it from there instead of redefining it.
- `sweetness`/`acidity`/`tannin`/`body`/`fruitiness` must be 1–5; `abv` must be 0–100; listing `price` must be ≥ 0 — all `422` on violation (FastAPI/Pydantic default).
- `winery` on the wine-update body is a **name**, matched against an **existing** `Winery.name` exactly. No match → `404 "Winery not found"`. **Never auto-create** a winery from a typo'd name.
- `retailer` on listing-create is a **name**, **get-or-create** (mirrors `scripts/import_wines.py`'s existing `get_or_create_retailer` pattern) — retailers don't carry the same duplication risk wineries do.
- `currency` on listing create/update is uppercased server-side only (`"eur"` → `"EUR"`) — not run through any typo-alias table (that's a CSV-import-only concession).
- `source_product_id` is deliberately not settable through either listing schema (scraper-provenance metadata, meaningless for a manually created/edited listing).
- No database migration — every field being written already exists on `Wine`/`RetailerListing`.

Reference spec: `docs/superpowers/specs/2026-09-23-wine-write-api-design.md`

---

### Task 1: Write authentication + CORS fix

**Files:**
- Modify: `backend/app/api/deps.py` (add `require_admin_key`)
- Modify: `backend/app/main.py:16-22` (CORS `allow_methods`)
- Modify: `.env.example` (add `ADMIN_API_KEY`)
- Test: `tests/api/test_deps.py` (new)
- Test: `tests/api/test_wines.py` (one CORS test appended)

**Interfaces:**
- Consumes: nothing (no dependencies on other tasks).
- Produces: `require_admin_key(x_admin_key: str | None = Header(default=None)) -> None` in `app.api.deps`, raising `fastapi.HTTPException(status_code=401, ...)` on missing/wrong key. Tasks 2 and 3 both use this as a FastAPI route dependency (`dependencies=[Depends(require_admin_key)]`). Also produces the `admin_headers` pytest fixture (added to `tests/api/test_wines.py` in Task 2, but its purpose — pairing a `monkeypatch`-set `ADMIN_API_KEY` with a matching `X-Admin-Key` header — depends on this task's `require_admin_key` behavior).

- [ ] **Step 1: Write the failing tests**

Create `tests/api/test_deps.py`:

```python
import pytest
from fastapi import HTTPException

from app.api.deps import require_admin_key


def test_require_admin_key_raises_401_when_header_missing(monkeypatch):
    monkeypatch.setenv("ADMIN_API_KEY", "secret123")
    with pytest.raises(HTTPException) as exc_info:
        require_admin_key(x_admin_key=None)
    assert exc_info.value.status_code == 401


def test_require_admin_key_raises_401_when_header_wrong(monkeypatch):
    monkeypatch.setenv("ADMIN_API_KEY", "secret123")
    with pytest.raises(HTTPException) as exc_info:
        require_admin_key(x_admin_key="wrong-key")
    assert exc_info.value.status_code == 401


def test_require_admin_key_passes_when_header_matches(monkeypatch):
    monkeypatch.setenv("ADMIN_API_KEY", "secret123")
    require_admin_key(x_admin_key="secret123")


def test_require_admin_key_raises_401_when_env_var_unset(monkeypatch):
    monkeypatch.delenv("ADMIN_API_KEY", raising=False)
    with pytest.raises(HTTPException) as exc_info:
        require_admin_key(x_admin_key="anything")
    assert exc_info.value.status_code == 401
```

Add to `tests/api/test_wines.py`, directly after the existing
`test_cors_allows_configured_frontend_origin` test at the end of the file:

```python
def test_cors_preflight_allows_patch_method(client):
    response = client.options(
        "/api/wines/1",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "PATCH",
        },
    )
    assert response.status_code == 200
    assert "PATCH" in response.headers.get("access-control-allow-methods", "")
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/api/test_deps.py tests/api/test_wines.py::test_cors_preflight_allows_patch_method -v`
Expected: FAIL — `tests/api/test_deps.py` fails with `ImportError: cannot import name 'require_admin_key'`; the CORS test fails because `PATCH` isn't yet in `access-control-allow-methods`.

- [ ] **Step 3: Write minimal implementation**

Append to `backend/app/api/deps.py`:

```python
import os

from fastapi import Header, HTTPException


def require_admin_key(x_admin_key: str | None = Header(default=None)) -> None:
    expected = os.environ.get("ADMIN_API_KEY")
    if not expected or x_admin_key != expected:
        raise HTTPException(status_code=401, detail="Invalid or missing admin key")
```

(Add the two new imports to the top of the file, alongside the existing `from functools import lru_cache` / `from typing import Generator` / `from sqlalchemy.orm import Session` / `from app.database.base import ...` imports — don't duplicate any that already exist there.)

In `backend/app/main.py`, replace:

```python
    allow_methods=["GET", "POST"],
```

with:

```python
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
```

In `.env.example`, add a new line:

```
ADMIN_API_KEY=change-me-to-a-real-secret
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/api/test_deps.py tests/api/test_wines.py -v`
Expected: PASS — all tests in both files pass, including the new ones.

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/deps.py backend/app/main.py .env.example tests/api/test_deps.py tests/api/test_wines.py
git commit -m "feat: add admin-key write authentication and allow PATCH/DELETE in CORS"
```

---

### Task 2: `PATCH /api/wines/{id}` — edit a wine's own fields

**Files:**
- Modify: `backend/app/schemas/wine.py:1-4` (imports), add `VALID_TYPES`, `RatingLevel`, `WineUpdate` before `class GrapeOut`
- Modify: `scripts/import_wines.py:14-17` (import `VALID_TYPES` instead of defining it)
- Modify: `backend/app/services/wines.py` (add `get_winery_by_name`, `update_wine`)
- Modify: `backend/app/api/wines.py` (imports, add `PATCH /wines/{wine_id}` route)
- Test: `tests/api/test_wines.py`

**Interfaces:**
- Consumes: `require_admin_key` from `app.api.deps` (Task 1).
- Produces: `WineUpdate` Pydantic schema (`app.schemas.wine`); `VALID_TYPES: set[str]` (`app.schemas.wine`) — Task 3 does not need these directly, but the `admin_headers` test fixture this task adds to `tests/api/test_wines.py` is reused by Task 3's tests. `wines_service.get_winery_by_name(db: Session, name: str) -> Optional[Winery]` and `wines_service.update_wine(db: Session, wine_id: int, updates: dict) -> Optional[dict]` (`app.services.wines`) — not consumed elsewhere, but keep these exact names/signatures since the design doc's Data Flow section refers to them.

- [ ] **Step 1: Write the failing tests**

Add to `tests/api/test_wines.py`, directly after the `wine_with_all_null_percentage_grapes` fixture (before the `mixed_currency_wines` fixture the currency feature already added):

```python
@pytest.fixture
def admin_headers(monkeypatch):
    monkeypatch.setenv("ADMIN_API_KEY", "test-admin-key")
    return {"X-Admin-Key": "test-admin-key"}


def test_update_wine_changes_single_field_leaves_others(client, admin_headers, seeded_wines):
    response = client.patch(f"/api/wines/{seeded_wines['wine1']}", json={"abv": 14.9}, headers=admin_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["abv"] == 14.9
    assert body["name"] == "Caymus Cabernet Sauvignon"


def test_update_wine_null_clears_nullable_field(client, admin_headers, seeded_wines):
    response = client.patch(f"/api/wines/{seeded_wines['wine1']}", json={"vintage": None}, headers=admin_headers)
    assert response.status_code == 200
    assert response.json()["vintage"] is None


def test_update_wine_unknown_id_returns_404(client, admin_headers):
    response = client.patch("/api/wines/999999", json={"abv": 14.0}, headers=admin_headers)
    assert response.status_code == 404
    assert response.json()["detail"] == "Wine not found"


def test_update_wine_invalid_type_returns_422(client, admin_headers, seeded_wines):
    response = client.patch(f"/api/wines/{seeded_wines['wine1']}", json={"type": "bogus"}, headers=admin_headers)
    assert response.status_code == 422


def test_update_wine_type_normalized_to_lowercase(client, admin_headers, seeded_wines):
    response = client.patch(f"/api/wines/{seeded_wines['wine1']}", json={"type": "WHITE"}, headers=admin_headers)
    assert response.status_code == 200
    assert response.json()["type"] == "white"


def test_update_wine_rating_out_of_range_returns_422(client, admin_headers, seeded_wines):
    response = client.patch(f"/api/wines/{seeded_wines['wine1']}", json={"sweetness": 6}, headers=admin_headers)
    assert response.status_code == 422


def test_update_wine_abv_out_of_range_returns_422(client, admin_headers, seeded_wines):
    response = client.patch(f"/api/wines/{seeded_wines['wine1']}", json={"abv": 101}, headers=admin_headers)
    assert response.status_code == 422


def test_update_wine_reassigns_winery_by_name(client, admin_headers, seeded_wines):
    response = client.patch(
        f"/api/wines/{seeded_wines['wine1']}", json={"winery": "Château Margaux"}, headers=admin_headers
    )
    assert response.status_code == 200
    assert response.json()["winery"] == "Château Margaux"


def test_update_wine_unknown_winery_name_returns_404_and_does_not_create_one(
    client, admin_headers, seeded_wines, db_session
):
    response = client.patch(
        f"/api/wines/{seeded_wines['wine1']}", json={"winery": "Nonexistent Winery"}, headers=admin_headers
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Winery not found"
    assert db_session.query(Winery).filter_by(name="Nonexistent Winery").one_or_none() is None


def test_update_wine_missing_admin_key_returns_401(client, seeded_wines):
    response = client.patch(f"/api/wines/{seeded_wines['wine1']}", json={"abv": 14.0})
    assert response.status_code == 401


def test_update_wine_wrong_admin_key_returns_401(client, admin_headers, seeded_wines):
    response = client.patch(
        f"/api/wines/{seeded_wines['wine1']}", json={"abv": 14.0}, headers={"X-Admin-Key": "wrong-key"}
    )
    assert response.status_code == 401
```

(`Winery` is already imported at the top of `tests/api/test_wines.py` via `from app.models import Grape, Retailer, RetailerListing, Wine, WineGrape, Winery` — no new import needed there.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/api/test_wines.py -v -k "update_wine"`
Expected: FAIL — `405 Method Not Allowed` for every test (no `PATCH /wines/{id}` route exists yet).

- [ ] **Step 3: Write minimal implementation**

In `backend/app/schemas/wine.py`, replace the top of the file (the two import lines) with:

```python
from typing import Annotated, Optional

from pydantic import BaseModel, Field, field_validator
```

Then, directly after those imports and before `class GrapeOut(BaseModel):`, add:

```python
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
        if value is None:
            return value
        normalized = value.lower()
        if normalized not in VALID_TYPES:
            raise ValueError(f"invalid type {value!r}")
        return normalized
```

`type` is normalized to lowercase (not just validated case-insensitively), matching
`scripts/import_wines.py`'s existing `wine_type = _clean(row["type"]).lower()` —
otherwise a `PATCH {"type": "RED"}` would pass validation but store `"RED"`,
inconsistent with every CSV-imported row (always lowercase), and mismatched
against the frontend's lowercase `TYPE_LABELS` lookup.

In `scripts/import_wines.py`, replace:

```python
from app.database.base import get_engine, get_session_factory
from app.models import Grape, Retailer, RetailerListing, Wine, WineGrape, Winery

VALID_TYPES = {"red", "white", "rosé", "sparkling", "dessert", "fortified"}
```

with:

```python
from app.database.base import get_engine, get_session_factory
from app.models import Grape, Retailer, RetailerListing, Wine, WineGrape, Winery
from app.schemas.wine import VALID_TYPES
```

In `backend/app/services/wines.py`, add at the end of the file:

```python
def get_winery_by_name(db: Session, name: str) -> Optional[Winery]:
    return db.query(Winery).filter_by(name=name).one_or_none()


def update_wine(db: Session, wine_id: int, updates: dict) -> Optional[dict]:
    wine = db.get(Wine, wine_id)
    if wine is None:
        return None
    for field, value in updates.items():
        setattr(wine, field, value)
    db.commit()
    return get_wine(db, wine_id)
```

In `backend/app/api/wines.py`, change the import lines:

```python
from app.api.deps import get_db
from app.schemas.wine import WineDetail, WineListResponse
```

to:

```python
from app.api.deps import get_db, require_admin_key
from app.schemas.wine import WineDetail, WineListResponse, WineUpdate
```

Then append this route at the end of the file:

```python
@router.patch("/wines/{wine_id}", response_model=WineDetail, dependencies=[Depends(require_admin_key)])
def update_wine(wine_id: int, body: WineUpdate, db: Session = Depends(get_db)) -> WineDetail:
    updates = body.model_dump(exclude_unset=True)

    if "winery" in updates:
        winery_name = updates.pop("winery")
        winery = wines_service.get_winery_by_name(db, winery_name)
        if winery is None:
            raise HTTPException(status_code=404, detail="Winery not found")
        updates["winery_id"] = winery.id

    result = wines_service.update_wine(db, wine_id, updates)
    if result is None:
        raise HTTPException(status_code=404, detail="Wine not found")
    return WineDetail(**result)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/api/test_wines.py -v`
Expected: PASS — all tests in the file pass, including the 11 new ones.

- [ ] **Step 5: Run the full backend test suite to confirm no regressions**

Run: `pytest -v`
Expected: PASS — no regressions, including `tests/scripts/test_import_wines.py` (confirms moving `VALID_TYPES` didn't change its behavior).

- [ ] **Step 6: Commit**

```bash
git add backend/app/schemas/wine.py scripts/import_wines.py backend/app/services/wines.py backend/app/api/wines.py tests/api/test_wines.py
git commit -m "feat: add PATCH /wines/{id} to edit a wine's own fields"
```

---

### Task 3: Listing CRUD — create, edit, delete a retailer listing

**Files:**
- Modify: `backend/app/schemas/wine.py` (`RetailerListingOut` gains `id`; add `RetailerListingCreate`, `RetailerListingUpdate`)
- Modify: `backend/app/services/wines.py` (imports; add `_listing_to_dict`, `get_or_create_retailer`, `_get_listing_for_wine`, `create_listing`, `update_listing`, `delete_listing`; refactor `get_wine`'s listings construction to use `_listing_to_dict`)
- Modify: `backend/app/api/wines.py` (imports, add 3 routes)
- Test: `tests/api/test_wines.py`

**Interfaces:**
- Consumes: `require_admin_key` from `app.api.deps` (Task 1); the `admin_headers` pytest fixture (Task 2, already in `tests/api/test_wines.py`).
- Produces: nothing later depends on this (last task). `RetailerListingOut` now includes `id: int` — this is a response-shape change every consumer of `GET /wines/{id}` observes (additive only, no existing field removed).

- [ ] **Step 1: Write the failing tests**

Add to `tests/api/test_wines.py`, directly after the last test from Task 2 (`test_update_wine_wrong_admin_key_returns_401`):

```python
def test_get_wine_detail_listing_includes_id(client, seeded_wines):
    response = client.get(f"/api/wines/{seeded_wines['wine1']}")
    body = response.json()
    assert all("id" in listing for listing in body["listings"])


def test_create_listing_adds_new_retailer(client, admin_headers, seeded_wines):
    response = client.post(
        f"/api/wines/{seeded_wines['wine2']}/listings",
        json={"retailer": "Brand New Shop", "price": 25.00, "currency": "usd"},
        headers=admin_headers,
    )
    assert response.status_code == 201
    body = response.json()
    assert body["retailer"] == "Brand New Shop"
    assert body["price"] == 25.00
    assert body["currency"] == "USD"
    assert "id" in body


def test_create_listing_reuses_existing_retailer(client, admin_headers, seeded_wines, db_session):
    client.post(
        f"/api/wines/{seeded_wines['wine2']}/listings",
        json={"retailer": "Total Wine", "price": 10.00},
        headers=admin_headers,
    )
    count = db_session.query(Retailer).filter_by(name="Total Wine").count()
    assert count == 1


def test_create_listing_unknown_wine_returns_404(client, admin_headers):
    response = client.post("/api/wines/999999/listings", json={"retailer": "Some Shop"}, headers=admin_headers)
    assert response.status_code == 404


def test_create_listing_missing_admin_key_returns_401(client, seeded_wines):
    response = client.post(f"/api/wines/{seeded_wines['wine2']}/listings", json={"retailer": "Some Shop"})
    assert response.status_code == 401


def test_update_listing_changes_price_and_bumps_last_verified(client, admin_headers, seeded_wines, db_session):
    wine3 = db_session.get(Wine, seeded_wines["wine3"])
    listing = wine3.listings[0]
    listing_id = listing.id
    before = listing.last_verified_at

    response = client.patch(
        f"/api/wines/{seeded_wines['wine3']}/listings/{listing_id}", json={"price": 199.99}, headers=admin_headers
    )
    assert response.status_code == 200
    assert response.json()["price"] == 199.99

    db_session.refresh(listing)
    assert listing.last_verified_at != before


def test_update_listing_uppercases_currency(client, admin_headers, seeded_wines, db_session):
    wine3 = db_session.get(Wine, seeded_wines["wine3"])
    listing_id = wine3.listings[0].id

    response = client.patch(
        f"/api/wines/{seeded_wines['wine3']}/listings/{listing_id}", json={"currency": "eur"}, headers=admin_headers
    )
    assert response.status_code == 200
    assert response.json()["currency"] == "EUR"


def test_update_listing_from_different_wine_returns_404(client, admin_headers, seeded_wines, db_session):
    wine3 = db_session.get(Wine, seeded_wines["wine3"])
    listing_id = wine3.listings[0].id

    response = client.patch(
        f"/api/wines/{seeded_wines['wine1']}/listings/{listing_id}", json={"price": 1.00}, headers=admin_headers
    )
    assert response.status_code == 404


def test_update_listing_unknown_id_returns_404(client, admin_headers, seeded_wines):
    response = client.patch(
        f"/api/wines/{seeded_wines['wine1']}/listings/999999", json={"price": 1.00}, headers=admin_headers
    )
    assert response.status_code == 404


def test_delete_listing_removes_it(client, admin_headers, seeded_wines, db_session):
    wine3 = db_session.get(Wine, seeded_wines["wine3"])
    listing_id = wine3.listings[0].id

    response = client.delete(f"/api/wines/{seeded_wines['wine3']}/listings/{listing_id}", headers=admin_headers)
    assert response.status_code == 204

    follow_up = client.get(f"/api/wines/{seeded_wines['wine3']}")
    assert follow_up.json()["listings"] == []


def test_delete_listing_from_different_wine_returns_404(client, admin_headers, seeded_wines, db_session):
    wine3 = db_session.get(Wine, seeded_wines["wine3"])
    listing_id = wine3.listings[0].id

    response = client.delete(f"/api/wines/{seeded_wines['wine1']}/listings/{listing_id}", headers=admin_headers)
    assert response.status_code == 404


def test_delete_listing_missing_admin_key_returns_401(client, seeded_wines, db_session):
    wine3 = db_session.get(Wine, seeded_wines["wine3"])
    listing_id = wine3.listings[0].id
    response = client.delete(f"/api/wines/{seeded_wines['wine3']}/listings/{listing_id}")
    assert response.status_code == 401
```

(`Retailer` and `Wine` are already imported at the top of `tests/api/test_wines.py`.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/api/test_wines.py -v -k "listing_id or create_listing or update_listing or delete_listing or listing_includes_id"`
Expected: FAIL — `test_get_wine_detail_listing_includes_id` fails with `KeyError`/`AssertionError` (no `id` field yet); the create/update/delete tests fail with `404`/`405` (no routes exist yet).

- [ ] **Step 3: Write minimal implementation**

In `backend/app/schemas/wine.py`, replace:

```python
class RetailerListingOut(BaseModel):
    retailer: str
    price: Optional[float] = None
    currency: Optional[str] = None
    price_usd_approx: Optional[float] = None
    product_url: Optional[str] = None
    availability: Optional[str] = None
```

with:

```python
class RetailerListingOut(BaseModel):
    id: int
    retailer: str
    price: Optional[float] = None
    currency: Optional[str] = None
    price_usd_approx: Optional[float] = None
    product_url: Optional[str] = None
    availability: Optional[str] = None


class RetailerListingCreate(BaseModel):
    retailer: str
    price: Optional[Annotated[float, Field(ge=0)]] = None
    currency: Optional[str] = None
    availability: Optional[str] = None
    product_url: Optional[str] = None

    @field_validator("currency")
    @classmethod
    def _uppercase_currency(cls, value):
        return value.upper() if value is not None else value


class RetailerListingUpdate(BaseModel):
    price: Optional[Annotated[float, Field(ge=0)]] = None
    currency: Optional[str] = None
    availability: Optional[str] = None
    product_url: Optional[str] = None

    @field_validator("currency")
    @classmethod
    def _uppercase_currency(cls, value):
        return value.upper() if value is not None else value
```

In `backend/app/services/wines.py`, change the top import line:

```python
from typing import Literal, Optional
```

to:

```python
from datetime import datetime, timezone
from typing import Literal, Optional
```

Replace the `get_wine` function's `listings` construction — find:

```python
    data["listings"] = [
        {
            "retailer": retailer_name,
            "price": listing.price,
            "currency": listing.currency,
            "price_usd_approx": approx_usd(listing.price, listing.currency),
            "product_url": listing.product_url,
            "availability": listing.availability,
        }
        for listing, retailer_name in listing_rows
    ]
    return data
```

and replace it with:

```python
    data["listings"] = [_listing_to_dict(listing, retailer_name) for listing, retailer_name in listing_rows]
    return data
```

Then add, above `get_wine` (directly after `_row_to_dict`, before `def list_wines(`):

```python
def _listing_to_dict(listing: RetailerListing, retailer_name: str) -> dict:
    return {
        "id": listing.id,
        "retailer": retailer_name,
        "price": listing.price,
        "currency": listing.currency,
        "price_usd_approx": approx_usd(listing.price, listing.currency),
        "product_url": listing.product_url,
        "availability": listing.availability,
    }
```

Finally, add at the end of the file (after `update_wine`, which Task 2 added):

```python
def get_or_create_retailer(db: Session, name: str) -> Retailer:
    retailer = db.query(Retailer).filter_by(name=name).one_or_none()
    if retailer is None:
        retailer = Retailer(name=name)
        db.add(retailer)
        db.flush()
    return retailer


def _get_listing_for_wine(db: Session, wine_id: int, listing_id: int) -> Optional[RetailerListing]:
    return db.query(RetailerListing).filter_by(id=listing_id, wine_id=wine_id).one_or_none()


def create_listing(db: Session, wine_id: int, data: dict) -> Optional[dict]:
    wine = db.get(Wine, wine_id)
    if wine is None:
        return None
    retailer = get_or_create_retailer(db, data["retailer"])
    now = datetime.now(timezone.utc)
    listing = RetailerListing(
        wine_id=wine_id,
        retailer_id=retailer.id,
        price=data.get("price"),
        currency=data.get("currency"),
        availability=data.get("availability"),
        product_url=data.get("product_url"),
        collected_at=now,
        last_verified_at=now,
    )
    db.add(listing)
    db.commit()
    db.refresh(listing)
    return _listing_to_dict(listing, retailer.name)


def update_listing(db: Session, wine_id: int, listing_id: int, updates: dict) -> Optional[dict]:
    listing = _get_listing_for_wine(db, wine_id, listing_id)
    if listing is None:
        return None
    for field, value in updates.items():
        setattr(listing, field, value)
    listing.last_verified_at = datetime.now(timezone.utc)
    db.commit()
    retailer = db.get(Retailer, listing.retailer_id)
    return _listing_to_dict(listing, retailer.name)


def delete_listing(db: Session, wine_id: int, listing_id: int) -> bool:
    listing = _get_listing_for_wine(db, wine_id, listing_id)
    if listing is None:
        return False
    db.delete(listing)
    db.commit()
    return True
```

In `backend/app/api/wines.py`, change the import line:

```python
from app.schemas.wine import WineDetail, WineListResponse, WineUpdate
```

to:

```python
from app.schemas.wine import (
    RetailerListingCreate,
    RetailerListingOut,
    RetailerListingUpdate,
    WineDetail,
    WineListResponse,
    WineUpdate,
)
```

Then append these three routes at the end of the file:

```python
@router.post(
    "/wines/{wine_id}/listings",
    response_model=RetailerListingOut,
    status_code=201,
    dependencies=[Depends(require_admin_key)],
)
def create_listing(wine_id: int, body: RetailerListingCreate, db: Session = Depends(get_db)) -> RetailerListingOut:
    result = wines_service.create_listing(db, wine_id, body.model_dump())
    if result is None:
        raise HTTPException(status_code=404, detail="Wine not found")
    return RetailerListingOut(**result)


@router.patch(
    "/wines/{wine_id}/listings/{listing_id}",
    response_model=RetailerListingOut,
    dependencies=[Depends(require_admin_key)],
)
def update_listing(
    wine_id: int, listing_id: int, body: RetailerListingUpdate, db: Session = Depends(get_db)
) -> RetailerListingOut:
    updates = body.model_dump(exclude_unset=True)
    result = wines_service.update_listing(db, wine_id, listing_id, updates)
    if result is None:
        raise HTTPException(status_code=404, detail="Listing not found")
    return RetailerListingOut(**result)


@router.delete(
    "/wines/{wine_id}/listings/{listing_id}",
    status_code=204,
    dependencies=[Depends(require_admin_key)],
)
def delete_listing(wine_id: int, listing_id: int, db: Session = Depends(get_db)) -> None:
    deleted = wines_service.delete_listing(db, wine_id, listing_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Listing not found")
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/api/test_wines.py -v`
Expected: PASS — all tests in the file pass, including the 12 new ones.

- [ ] **Step 5: Run the full backend test suite to confirm no regressions**

Run: `pytest -v`
Expected: PASS — no regressions anywhere (`tests/scripts`, `tests/models`, `tests/database`, `tests/api`, `tests/services`).

- [ ] **Step 6: Commit**

```bash
git add backend/app/schemas/wine.py backend/app/services/wines.py backend/app/api/wines.py tests/api/test_wines.py
git commit -m "feat: add create/update/delete endpoints for retailer listings"
```
