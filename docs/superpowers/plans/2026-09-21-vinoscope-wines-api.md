# VinoScope Wines API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a FastAPI app with a read-only Wines API — `GET /api/wines` (filterable, sortable, paginated list) and `GET /api/wines/{id}` (full detail) — on top of the existing data layer, which already holds 100 real wines in Postgres.

**Architecture:** Layered: thin FastAPI route handlers in `app/api/`, query-building in `app/services/wines.py`, response shapes in `app/schemas/wine.py`. Synchronous SQLAlchemy throughout, reusing `app.database.base.get_engine`/`get_session_factory` from the data layer phase — no async. The DB session dependency (`app/api/deps.py`) lazily creates its engine/session-factory on first use rather than at import time, so importing the app never requires `DATABASE_URL` to already be loaded.

**Tech Stack:** Python 3.11+, FastAPI, Pydantic (via FastAPI), uvicorn, SQLAlchemy 2.0, PostgreSQL (existing `vinoscope`/`vinoscope_test` databases), pytest + FastAPI `TestClient` + httpx.

## Global Constraints

- Synchronous SQLAlchemy only — no async engine/session, matching the existing `app.database.base` from the data layer phase.
- Layered structure: routes stay thin (parameter parsing + calling a service function + building a response), all query logic lives in `app/services/wines.py`, all response shapes live in `app/schemas/wine.py`.
- `price` on both list and detail views is `MIN(retailer_listings.price)` for that wine; `null` if the wine has no listings.
- `grapes` is built from `wine_grapes` joined to `grapes`, ordered by `percentage` descending with nulls last.
- `GET /api/wines/{id}` on an unknown id returns `404` with body `{"detail": "Wine not found"}`.
- Invalid query params (`sort` outside the allowed set, `limit`/`offset`/`min_price`/`max_price` out of range or non-numeric) return FastAPI's automatic `422` via `Query`/`Literal` constraints declared on the endpoint signature — no manual validation code.
- All tests run against real Postgres (`vinoscope_test`) via FastAPI `TestClient` with a `get_db` dependency override — never mocks.
- Out of scope for this plan: recommendation engine, "similar wines", full-text/fuzzy search, a wine `rating` field, frontend, authentication, write endpoints (create/update/delete via the API — data entry stays on the CSV pipeline).

---

### Task 1: `GET /api/wines` — app skeleton, schemas, list endpoint with filters/sort/pagination

**Files:**
- Create: `backend/app/main.py`
- Create: `backend/app/api/__init__.py`
- Create: `backend/app/api/deps.py`
- Create: `backend/app/api/wines.py`
- Create: `backend/app/schemas/__init__.py`
- Create: `backend/app/schemas/wine.py`
- Create: `backend/app/services/__init__.py`
- Create: `backend/app/services/wines.py`
- Modify: `backend/requirements.txt`
- Create: `tests/api/__init__.py`
- Create: `tests/api/conftest.py`
- Test: `tests/api/test_wines.py`

**Interfaces:**
- Consumes: `app.database.base.get_engine`/`get_session_factory` (data layer phase), `app.models.{Wine, Winery, Grape, WineGrape, RetailerListing}` (data layer phase).
- Produces: FastAPI app instance at `app.main.app`. `app.api.deps.get_db` — a FastAPI dependency yielding a `Session`. `app.services.wines.list_wines(db, *, type=None, country=None, grape=None, min_price=None, max_price=None, sort="winery", limit=20, offset=0) -> tuple[int, list[dict]]` (total count, item dicts). `app.services.wines._min_price_subquery()` and `app.services.wines._grapes_for_wine(db, wine_id) -> list[dict]` — both reused by Task 2's `get_wine`. Pydantic schemas `GrapeOut`, `WineListItem`, `WineListResponse` in `app.schemas.wine` — `WineListItem` is reused (subclassed) by Task 2's `WineDetail`.

- [ ] **Step 1: Add new dependencies**

Add to `backend/requirements.txt` (append, don't remove existing lines):
```
fastapi>=0.115
uvicorn[standard]>=0.30
httpx>=0.27
```

Run: `pip install -r backend/requirements.txt`

- [ ] **Step 2: Create the schemas**

`backend/app/schemas/__init__.py`: leave empty.

`backend/app/schemas/wine.py`:
```python
from typing import Optional

from pydantic import BaseModel


class GrapeOut(BaseModel):
    name: str
    percentage: Optional[float] = None


class WineListItem(BaseModel):
    id: int
    name: str
    winery: str
    vintage: Optional[int] = None
    type: str
    country: Optional[str] = None
    region: Optional[str] = None
    grapes: list[GrapeOut]
    price: Optional[float] = None
    image_url: Optional[str] = None
    sweetness: Optional[int] = None
    acidity: Optional[int] = None
    tannin: Optional[int] = None
    body: Optional[int] = None
    fruitiness: Optional[int] = None


class WineListResponse(BaseModel):
    total: int
    items: list[WineListItem]
```

- [ ] **Step 3: Create the DB session dependency**

`backend/app/api/__init__.py`: leave empty.

`backend/app/api/deps.py`:
```python
from functools import lru_cache
from typing import Generator

from sqlalchemy.orm import Session

from app.database.base import get_engine, get_session_factory


@lru_cache
def _get_session_factory():
    engine = get_engine()
    return get_session_factory(engine)


def get_db() -> Generator[Session, None, None]:
    session_factory = _get_session_factory()
    db = session_factory()
    try:
        yield db
    finally:
        db.close()
```

`_get_session_factory` is lazy (only calls `get_engine()`, which reads `DATABASE_URL`, on first actual use) so that importing `app.main` — which happens at test-collection time too — never requires `DATABASE_URL` to already be set.

- [ ] **Step 4: Write the failing tests for the list endpoint**

`tests/api/__init__.py`: leave empty.

`tests/api/conftest.py`:
```python
import os

import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_db
from app.database.base import Base, get_engine, get_session_factory
from app.main import app


@pytest.fixture
def db_session():
    url = os.environ["TEST_DATABASE_URL"]
    engine = get_engine(url)
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    Session = get_session_factory(engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)
        engine.dispose()


@pytest.fixture
def client(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
```

`tests/api/test_wines.py`:
```python
import pytest

from app.models import Grape, Retailer, RetailerListing, Wine, WineGrape, Winery


@pytest.fixture
def seeded_wines(db_session):
    caymus = Winery(name="Caymus Vineyards", country="United States", region="Napa Valley")
    margaux = Winery(name="Château Margaux", country="France", region="Bordeaux")
    db_session.add_all([caymus, margaux])
    db_session.flush()

    cab = Grape(name="Cabernet Sauvignon")
    chard = Grape(name="Chardonnay")
    merlot = Grape(name="Merlot")
    db_session.add_all([cab, chard, merlot])
    db_session.flush()

    total_wine = Retailer(name="Total Wine")
    wine_com = Retailer(name="Wine.com")
    db_session.add_all([total_wine, wine_com])
    db_session.flush()

    wine1 = Wine(
        winery=caymus, name="Caymus Cabernet Sauvignon", vintage=2022, type="red", country="United States"
    )
    wine1.grapes.append(WineGrape(grape=cab, percentage=100))
    wine1.listings.append(RetailerListing(retailer=total_wine, price=79.99, currency="USD"))
    wine1.listings.append(RetailerListing(retailer=wine_com, price=84.99, currency="USD"))

    wine2 = Wine(winery=caymus, name="Caymus Chardonnay", vintage=2021, type="white", country="United States")
    wine2.grapes.append(WineGrape(grape=chard, percentage=None))

    wine3 = Wine(winery=margaux, name="Margaux Bordeaux Blend", vintage=2019, type="red", country="France")
    wine3.grapes.append(WineGrape(grape=cab, percentage=60))
    wine3.grapes.append(WineGrape(grape=merlot, percentage=40))
    wine3.listings.append(RetailerListing(retailer=wine_com, price=250.00, currency="USD"))

    db_session.add_all([wine1, wine2, wine3])
    db_session.commit()

    return {"wine1": wine1.id, "wine2": wine2.id, "wine3": wine3.id}


def test_list_wines_no_filters_returns_all_with_total(client, seeded_wines):
    response = client.get("/api/wines")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 3
    assert len(body["items"]) == 3


def test_list_wines_filters_by_type(client, seeded_wines):
    response = client.get("/api/wines", params={"type": "white"})
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["id"] == seeded_wines["wine2"]


def test_list_wines_filters_by_country(client, seeded_wines):
    response = client.get("/api/wines", params={"country": "France"})
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["id"] == seeded_wines["wine3"]


def test_list_wines_filters_by_grape_substring(client, seeded_wines):
    response = client.get("/api/wines", params={"grape": "cabernet"})
    body = response.json()
    ids = {item["id"] for item in body["items"]}
    assert ids == {seeded_wines["wine1"], seeded_wines["wine3"]}


def test_list_wines_filters_by_price_range(client, seeded_wines):
    response = client.get("/api/wines", params={"min_price": 100, "max_price": 300})
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["id"] == seeded_wines["wine3"]


def test_list_wines_price_filter_excludes_wines_with_no_listings(client, seeded_wines):
    response = client.get("/api/wines", params={"min_price": 0})
    body = response.json()
    ids = {item["id"] for item in body["items"]}
    assert seeded_wines["wine2"] not in ids


def test_list_wines_price_is_minimum_across_listings(client, seeded_wines):
    response = client.get("/api/wines", params={"type": "red", "country": "United States"})
    body = response.json()
    assert body["items"][0]["price"] == 79.99


def test_list_wines_wine_with_no_listings_has_null_price(client, seeded_wines):
    response = client.get("/api/wines", params={"type": "white"})
    body = response.json()
    assert body["items"][0]["price"] is None


def test_list_wines_sort_price_asc_puts_nulls_last(client, seeded_wines):
    response = client.get("/api/wines", params={"sort": "price_asc"})
    body = response.json()
    ids = [item["id"] for item in body["items"]]
    assert ids == [seeded_wines["wine1"], seeded_wines["wine3"], seeded_wines["wine2"]]


def test_list_wines_sort_price_desc_puts_nulls_last(client, seeded_wines):
    response = client.get("/api/wines", params={"sort": "price_desc"})
    body = response.json()
    ids = [item["id"] for item in body["items"]]
    assert ids == [seeded_wines["wine3"], seeded_wines["wine1"], seeded_wines["wine2"]]


def test_list_wines_sort_vintage(client, seeded_wines):
    response = client.get("/api/wines", params={"sort": "vintage"})
    body = response.json()
    ids = [item["id"] for item in body["items"]]
    assert ids == [seeded_wines["wine3"], seeded_wines["wine2"], seeded_wines["wine1"]]


def test_list_wines_default_sort_is_winery_name(client, seeded_wines):
    response = client.get("/api/wines")
    body = response.json()
    ids = [item["id"] for item in body["items"]]
    assert ids == [seeded_wines["wine1"], seeded_wines["wine2"], seeded_wines["wine3"]]


def test_list_wines_blend_grapes_ordered_by_percentage_descending(client, seeded_wines):
    response = client.get("/api/wines", params={"type": "red", "country": "France"})
    body = response.json()
    grapes = body["items"][0]["grapes"]
    assert grapes == [
        {"name": "Cabernet Sauvignon", "percentage": 60.0},
        {"name": "Merlot", "percentage": 40.0},
    ]


def test_list_wines_pagination_limit_and_offset(client, seeded_wines):
    response = client.get("/api/wines", params={"limit": 2, "offset": 0})
    body = response.json()
    assert body["total"] == 3
    assert len(body["items"]) == 2

    response2 = client.get("/api/wines", params={"limit": 2, "offset": 2})
    body2 = response2.json()
    assert len(body2["items"]) == 1


def test_list_wines_invalid_sort_returns_422(client, seeded_wines):
    response = client.get("/api/wines", params={"sort": "bogus"})
    assert response.status_code == 422


def test_list_wines_limit_over_max_returns_422(client, seeded_wines):
    response = client.get("/api/wines", params={"limit": 101})
    assert response.status_code == 422
```

- [ ] **Step 5: Run tests to verify they fail**

Run: `pytest tests/api/test_wines.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.main'`

- [ ] **Step 6: Implement the service layer**

`backend/app/services/__init__.py`: leave empty.

`backend/app/services/wines.py`:
```python
from typing import Literal, Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Grape, RetailerListing, Wine, WineGrape, Winery

SortOption = Literal["price_asc", "price_desc", "vintage", "winery"]


def _min_price_subquery():
    return (
        select(
            RetailerListing.wine_id.label("wine_id"),
            func.min(RetailerListing.price).label("min_price"),
        )
        .group_by(RetailerListing.wine_id)
        .subquery()
    )


def _grapes_for_wine(db: Session, wine_id: int) -> list[dict]:
    rows = (
        db.query(Grape.name, WineGrape.percentage)
        .join(WineGrape, WineGrape.grape_id == Grape.id)
        .filter(WineGrape.wine_id == wine_id)
        .all()
    )
    rows = sorted(rows, key=lambda r: (r[1] is None, -(r[1] or 0)))
    return [{"name": name, "percentage": pct} for name, pct in rows]


def _row_to_dict(wine: Wine, winery_name: str, min_price: Optional[float], db: Session) -> dict:
    return {
        "id": wine.id,
        "name": wine.name,
        "winery": winery_name,
        "vintage": wine.vintage,
        "type": wine.type,
        "country": wine.country,
        "region": wine.region,
        "grapes": _grapes_for_wine(db, wine.id),
        "price": min_price,
        "image_url": wine.image_url,
        "sweetness": wine.sweetness,
        "acidity": wine.acidity,
        "tannin": wine.tannin,
        "body": wine.body,
        "fruitiness": wine.fruitiness,
    }


def list_wines(
    db: Session,
    *,
    type: Optional[str] = None,
    country: Optional[str] = None,
    grape: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    sort: SortOption = "winery",
    limit: int = 20,
    offset: int = 0,
) -> tuple[int, list[dict]]:
    price_sq = _min_price_subquery()

    query = (
        db.query(Wine, Winery.name.label("winery_name"), price_sq.c.min_price)
        .join(Winery, Wine.winery_id == Winery.id)
        .outerjoin(price_sq, price_sq.c.wine_id == Wine.id)
    )

    if type is not None:
        query = query.filter(func.lower(Wine.type) == type.lower())
    if country is not None:
        query = query.filter(func.lower(Wine.country) == country.lower())
    if grape is not None:
        query = query.filter(
            Wine.id.in_(
                select(WineGrape.wine_id)
                .join(Grape, Grape.id == WineGrape.grape_id)
                .where(Grape.name.ilike(f"%{grape}%"))
            )
        )
    if min_price is not None:
        query = query.filter(price_sq.c.min_price >= min_price)
    if max_price is not None:
        query = query.filter(price_sq.c.min_price <= max_price)

    total = query.count()

    if sort == "price_asc":
        query = query.order_by(price_sq.c.min_price.asc().nulls_last(), Wine.id)
    elif sort == "price_desc":
        query = query.order_by(price_sq.c.min_price.desc().nulls_last(), Wine.id)
    elif sort == "vintage":
        query = query.order_by(Wine.vintage.asc().nulls_last(), Wine.id)
    else:
        query = query.order_by(Winery.name.asc(), Wine.id)

    rows = query.offset(offset).limit(limit).all()
    items = [_row_to_dict(wine, winery_name, min_price_val, db) for wine, winery_name, min_price_val in rows]
    return total, items
```

- [ ] **Step 7: Implement the route and app**

`backend/app/api/wines.py`:
```python
from typing import Literal, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.wine import WineListResponse
from app.services import wines as wines_service

router = APIRouter()


@router.get("/wines", response_model=WineListResponse)
def list_wines(
    type: Optional[str] = None,
    country: Optional[str] = None,
    grape: Optional[str] = None,
    min_price: Optional[float] = Query(default=None, ge=0),
    max_price: Optional[float] = Query(default=None, ge=0),
    sort: Literal["price_asc", "price_desc", "vintage", "winery"] = "winery",
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> WineListResponse:
    total, items = wines_service.list_wines(
        db,
        type=type,
        country=country,
        grape=grape,
        min_price=min_price,
        max_price=max_price,
        sort=sort,
        limit=limit,
        offset=offset,
    )
    return WineListResponse(total=total, items=items)
```

`backend/app/main.py`:
```python
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI

from app.api.wines import router as wines_router

app = FastAPI(title="VinoScope API")
app.include_router(wines_router, prefix="/api")
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `pytest tests/api/test_wines.py -v`
Expected: PASS (16 tests)

- [ ] **Step 9: Run the full suite to confirm no regressions**

Run: `pytest -v`
Expected: PASS (data layer's existing tests plus this task's new tests, all green)

- [ ] **Step 10: Commit**

```bash
git add backend/app/main.py backend/app/api backend/app/schemas backend/app/services \
  backend/requirements.txt tests/api
git commit -m "feat: add FastAPI app with filterable/sortable/paginated wines list endpoint"
```

---

### Task 2: `GET /api/wines/{id}` — detail endpoint

**Files:**
- Modify: `backend/app/schemas/wine.py`
- Modify: `backend/app/services/wines.py`
- Modify: `backend/app/api/wines.py`
- Test (modify): `tests/api/test_wines.py`

**Interfaces:**
- Consumes: `app.services.wines._min_price_subquery`, `app.services.wines._grapes_for_wine`, `app.schemas.wine.WineListItem`, and the `seeded_wines` fixture — all from Task 1.
- Produces: `app.services.wines.get_wine(db, wine_id: int) -> Optional[dict]`. `GET /api/wines/{wine_id}` route, 404 on unknown id. Schemas `RetailerListingOut`, `WineDetail` (subclasses `WineListItem`, adds `subregion`, `abv`, `description`, `listings`).

- [ ] **Step 1: Write the failing tests**

Append to `tests/api/test_wines.py`:
```python
def test_get_wine_detail_returns_full_record(client, seeded_wines):
    response = client.get(f"/api/wines/{seeded_wines['wine1']}")
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == seeded_wines["wine1"]
    assert body["name"] == "Caymus Cabernet Sauvignon"
    assert body["winery"] == "Caymus Vineyards"
    assert body["price"] == 79.99
    assert body["grapes"] == [{"name": "Cabernet Sauvignon", "percentage": 100.0}]


def test_get_wine_detail_includes_all_listings(client, seeded_wines):
    response = client.get(f"/api/wines/{seeded_wines['wine1']}")
    body = response.json()
    retailers = {listing["retailer"] for listing in body["listings"]}
    assert retailers == {"Total Wine", "Wine.com"}
    prices = {listing["price"] for listing in body["listings"]}
    assert prices == {79.99, 84.99}


def test_get_wine_detail_blend_wine_includes_ordered_grapes(client, seeded_wines):
    response = client.get(f"/api/wines/{seeded_wines['wine3']}")
    body = response.json()
    assert body["grapes"] == [
        {"name": "Cabernet Sauvignon", "percentage": 60.0},
        {"name": "Merlot", "percentage": 40.0},
    ]


def test_get_wine_detail_unknown_id_returns_404(client, seeded_wines):
    response = client.get("/api/wines/999999")
    assert response.status_code == 404
    assert response.json()["detail"] == "Wine not found"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/api/test_wines.py -k detail -v`
Expected: FAIL — `test_get_wine_detail_*` tests fail with 404 for `/api/wines/{seeded_wines['wine1']}` (route doesn't exist yet, so FastAPI returns 404 for the unmatched path too) or a `KeyError`/import error depending on what's referenced; confirm the failure is because the route/schema don't exist yet, not a typo in the test.

- [ ] **Step 3: Add the schemas**

In `backend/app/schemas/wine.py`, append:
```python
class RetailerListingOut(BaseModel):
    retailer: str
    price: Optional[float] = None
    currency: Optional[str] = None
    product_url: Optional[str] = None
    availability: Optional[str] = None


class WineDetail(WineListItem):
    subregion: Optional[str] = None
    abv: Optional[float] = None
    description: Optional[str] = None
    listings: list[RetailerListingOut]
```

- [ ] **Step 4: Add the service function**

In `backend/app/services/wines.py`, add `Retailer` to the existing import from `app.models` (so the line reads `from app.models import Grape, Retailer, RetailerListing, Wine, WineGrape, Winery`), then append:
```python
def get_wine(db: Session, wine_id: int) -> Optional[dict]:
    price_sq = _min_price_subquery()
    row = (
        db.query(Wine, Winery.name.label("winery_name"), price_sq.c.min_price)
        .join(Winery, Wine.winery_id == Winery.id)
        .outerjoin(price_sq, price_sq.c.wine_id == Wine.id)
        .filter(Wine.id == wine_id)
        .one_or_none()
    )
    if row is None:
        return None
    wine, winery_name, min_price_val = row

    listing_rows = (
        db.query(RetailerListing, Retailer.name.label("retailer_name"))
        .join(Retailer, RetailerListing.retailer_id == Retailer.id)
        .filter(RetailerListing.wine_id == wine_id)
        .all()
    )

    data = _row_to_dict(wine, winery_name, min_price_val, db)
    data["subregion"] = wine.subregion
    data["abv"] = wine.abv
    data["description"] = wine.description
    data["listings"] = [
        {
            "retailer": retailer_name,
            "price": listing.price,
            "currency": listing.currency,
            "product_url": listing.product_url,
            "availability": listing.availability,
        }
        for listing, retailer_name in listing_rows
    ]
    return data
```

- [ ] **Step 5: Add the route**

In `backend/app/api/wines.py`, update the imports (`from fastapi import APIRouter, Depends, HTTPException, Query` and `from app.schemas.wine import WineDetail, WineListResponse`), then append:
```python
@router.get("/wines/{wine_id}", response_model=WineDetail)
def get_wine(wine_id: int, db: Session = Depends(get_db)) -> WineDetail:
    wine = wines_service.get_wine(db, wine_id)
    if wine is None:
        raise HTTPException(status_code=404, detail="Wine not found")
    return WineDetail(**wine)
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pytest tests/api/test_wines.py -v`
Expected: PASS (20 tests — 16 from Task 1 plus 4 new detail tests)

- [ ] **Step 7: Run the full suite**

Run: `pytest -v`
Expected: PASS, all tests green, no regressions in the data layer's tests

- [ ] **Step 8: Manually verify the app actually boots and serves real data**

This step exists because the data layer phase shipped a pipeline that looked correct in tests but didn't run standalone — don't repeat that here.

Run, from the repo root:
```bash
cd backend
uvicorn app.main:app --port 8000 &
sleep 2
curl "http://localhost:8000/api/wines?limit=3"
curl "http://localhost:8000/api/wines/1"
kill %1
cd ..
```
Confirm both `curl` calls return real JSON (not a stack trace or connection error) reflecting actual rows from the `vinoscope` dev database (which has the 100 imported wines). If `uvicorn` isn't on `PATH` as a bare command, use `python -m uvicorn app.main:app --port 8000` instead.

- [ ] **Step 9: Commit**

```bash
git add backend/app/schemas/wine.py backend/app/services/wines.py backend/app/api/wines.py tests/api/test_wines.py
git commit -m "feat: add wine detail endpoint with retailer listings"
```
