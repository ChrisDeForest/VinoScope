# Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A login-gated admin panel — a small "Admin" link in the header, a `/admin` page with dataset statistics and a searchable wine table, and an "Edit this wine" toggle on `WineDetailPage` — both driving one shared edit component that lets an admin change a wine's own fields, its retailer listings, and its grape blend.

**Architecture:** Two new backend endpoints (`GET /api/admin/stats`, `PUT /api/wines/{id}/grapes`), both protected by the existing `require_admin_key` dependency. The frontend gets a `sessionStorage`-backed admin-key module, an admin API client, and one `WineEditPanel` component (three independently-saveable sections: wine fields, listings, grapes) mounted from both `/admin` and `WineDetailPage`.

**Tech Stack:** FastAPI/Pydantic/SQLAlchemy (backend), React/TypeScript/Vitest (frontend) — no new dependencies.

## Global Constraints

- No new user/account system. Login is a password field checked against the existing `ADMIN_API_KEY` (via the first real admin call succeeding/failing), stored in `sessionStorage` only.
- Both new backend endpoints require `X-Admin-Key` via `require_admin_key` — `401` without it.
- `GET /api/admin/stats` numeric columns: `vintage`, `abv`, `sweetness`, `acidity`, `tannin`, `body`, `fruitiness` (on `Wine`), `price`, `price_usd_approx` (on `RetailerListing`, using the existing `CURRENCY_RATES`/rate-case logic). Categorical columns: `type`, `country`, `region` (on `Wine`), `currency`, `availability` (on `RetailerListing`). Every other column (`name`, `winery`, `retailer`, `description`, `image_url`, `product_url`, `subregion`) is deliberately excluded — too high-cardinality/free-text to be an informative aggregate.
- Empty dataset must not crash `GET /api/admin/stats`: `min`/`max`/`avg` are `null`, counts are `0`.
- `PUT /wines/{id}/grapes` fully replaces the blend (clear + re-populate, matching `scripts/import_wines.py`'s existing `wine.grapes.clear()` pattern) — no per-grape add/remove endpoints. Grape names are get-or-create by name. Duplicate names within one request → `422`. No requirement that percentages sum to 100.
- No new database migration — every field involved already exists on `Wine`/`RetailerListing`/`Grape`/`WineGrape`.

Reference spec: `docs/superpowers/specs/2026-09-23-admin-panel-design.md`

---

### Task 1: Backend — `GET /api/admin/stats`

**Files:**
- Create: `backend/app/schemas/admin.py`
- Create: `backend/app/services/admin.py`
- Create: `backend/app/api/admin.py`
- Modify: `backend/app/main.py` (register the new router)
- Modify: `tests/api/conftest.py` (move the `admin_headers` fixture here from `test_wines.py` so both test files can use it)
- Modify: `tests/api/test_wines.py:67-70` (remove the now-duplicated `admin_headers` fixture)
- Create: `tests/api/test_admin.py`

**Interfaces:**
- Consumes: `require_admin_key` from `app.api.deps`; `CURRENCY_RATES` from `app.services.currency` (same rate-case pattern `backend/app/services/wines.py`'s `_rate_case()` already uses).
- Produces: `admin_service.get_stats(db: Session) -> dict` (keys: `wines_count`, `wineries_count`, `retailers_count`, `listings_count`, `numeric: dict[str, dict]`, `categorical: dict[str, dict[str, int]]`). The `admin_headers` pytest fixture moves to `conftest.py` — Tasks elsewhere in this plan that need it (none do; only Task 2 reuses the one already in `test_wines.py`, unaffected by the move since fixtures in `conftest.py` are automatically available to every test file in the same directory).

- [ ] **Step 1: Write the failing tests**

First, move the fixture. In `tests/api/test_wines.py`, delete these lines (67-70):

```python
@pytest.fixture
def admin_headers(monkeypatch):
    monkeypatch.setenv("ADMIN_API_KEY", "test-admin-key")
    return {"X-Admin-Key": "test-admin-key"}
```

Add the same fixture to `tests/api/conftest.py` (append to the end of the file):

```python
@pytest.fixture
def admin_headers(monkeypatch):
    monkeypatch.setenv("ADMIN_API_KEY", "test-admin-key")
    return {"X-Admin-Key": "test-admin-key"}
```

Create `tests/api/test_admin.py`:

```python
import pytest

from app.models import Retailer, RetailerListing, Wine, Winery


@pytest.fixture
def stats_wines(db_session):
    winery = Winery(name="Stats Cellars", country="United States", region="Somewhere")
    db_session.add(winery)
    db_session.flush()
    retailer = Retailer(name="Stats Retailer")
    db_session.add(retailer)
    db_session.flush()

    wine1 = Wine(
        winery=winery,
        name="Stats Wine A",
        vintage=2020,
        type="red",
        country="United States",
        sweetness=1,
        acidity=3,
        tannin=5,
        body=3,
        fruitiness=3,
        abv=13.0,
    )
    wine1.listings.append(RetailerListing(retailer=retailer, price=50.0, currency="USD", availability="In Stock"))

    wine2 = Wine(
        winery=winery,
        name="Stats Wine B",
        vintage=2022,
        type="white",
        country="France",
    )
    wine2.listings.append(RetailerListing(retailer=retailer))

    db_session.add_all([wine1, wine2])
    db_session.commit()
    return {"wine1": wine1.id, "wine2": wine2.id}


def test_get_admin_stats_counts(client, admin_headers, stats_wines):
    response = client.get("/api/admin/stats", headers=admin_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["wines_count"] == 2
    assert body["wineries_count"] == 1
    assert body["retailers_count"] == 1
    assert body["listings_count"] == 2


def test_get_admin_stats_numeric_aggregates(client, admin_headers, stats_wines):
    response = client.get("/api/admin/stats", headers=admin_headers)
    body = response.json()
    assert body["numeric"]["vintage"] == {"count": 2, "null_count": 0, "min": 2020.0, "max": 2022.0, "avg": 2021.0}
    assert body["numeric"]["sweetness"] == {"count": 1, "null_count": 1, "min": 1.0, "max": 1.0, "avg": 1.0}
    assert body["numeric"]["abv"] == {"count": 1, "null_count": 1, "min": 13.0, "max": 13.0, "avg": 13.0}
    assert body["numeric"]["price"] == {"count": 1, "null_count": 1, "min": 50.0, "max": 50.0, "avg": 50.0}


def test_get_admin_stats_categorical_counts(client, admin_headers, stats_wines):
    response = client.get("/api/admin/stats", headers=admin_headers)
    body = response.json()
    assert body["categorical"]["type"] == {"red": 1, "white": 1}
    assert body["categorical"]["country"] == {"United States": 1, "France": 1}
    assert body["categorical"]["currency"] == {"USD": 1}


def test_get_admin_stats_empty_database_has_no_crash(client, admin_headers):
    response = client.get("/api/admin/stats", headers=admin_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["wines_count"] == 0
    assert body["numeric"]["vintage"] == {"count": 0, "null_count": 0, "min": None, "max": None, "avg": None}
    assert body["categorical"]["type"] == {}


def test_get_admin_stats_missing_admin_key_returns_401(client, stats_wines):
    response = client.get("/api/admin/stats")
    assert response.status_code == 401
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/api/test_admin.py -v`
Expected: FAIL — `404 Not Found` for every request (no `/api/admin/stats` route exists yet), and `tests/api/test_wines.py`'s tests that use `admin_headers` should still pass (fixture just moved, not removed) — run `pytest tests/api/test_wines.py -v -k admin_headers` isn't meaningful since it's a fixture not a test; instead confirm with `pytest tests/api/test_wines.py -v` that nothing broke from the fixture move.

- [ ] **Step 3: Write minimal implementation**

Create `backend/app/schemas/admin.py`:

```python
from typing import Optional

from pydantic import BaseModel


class ColumnStats(BaseModel):
    count: int
    null_count: int
    min: Optional[float] = None
    max: Optional[float] = None
    avg: Optional[float] = None


class AdminStats(BaseModel):
    wines_count: int
    wineries_count: int
    retailers_count: int
    listings_count: int
    numeric: dict[str, ColumnStats]
    categorical: dict[str, dict[str, int]]
```

Create `backend/app/services/admin.py`:

```python
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.models import Retailer, RetailerListing, Wine, Winery
from app.services.currency import CURRENCY_RATES


def _rate_case():
    return case(
        {code: rate for code, rate in CURRENCY_RATES.items()},
        value=func.upper(RetailerListing.currency),
        else_=1.0,
    )


def _numeric_stats(db: Session, total_rows: int, column) -> dict:
    count, min_v, max_v, avg_v = db.execute(
        select(func.count(column), func.min(column), func.max(column), func.avg(column))
    ).one()
    return {
        "count": count,
        "null_count": total_rows - count,
        "min": float(min_v) if min_v is not None else None,
        "max": float(max_v) if max_v is not None else None,
        "avg": round(float(avg_v), 2) if avg_v is not None else None,
    }


def _categorical_counts(db: Session, column) -> dict:
    rows = db.execute(
        select(column, func.count()).where(column.isnot(None)).group_by(column).order_by(func.count().desc())
    ).all()
    return {value: count for value, count in rows}


def get_stats(db: Session) -> dict:
    wines_count = db.scalar(select(func.count()).select_from(Wine))
    wineries_count = db.scalar(select(func.count()).select_from(Winery))
    retailers_count = db.scalar(select(func.count()).select_from(Retailer))
    listings_count = db.scalar(select(func.count()).select_from(RetailerListing))

    usd_price = RetailerListing.price * _rate_case()

    numeric = {
        "vintage": _numeric_stats(db, wines_count, Wine.vintage),
        "abv": _numeric_stats(db, wines_count, Wine.abv),
        "sweetness": _numeric_stats(db, wines_count, Wine.sweetness),
        "acidity": _numeric_stats(db, wines_count, Wine.acidity),
        "tannin": _numeric_stats(db, wines_count, Wine.tannin),
        "body": _numeric_stats(db, wines_count, Wine.body),
        "fruitiness": _numeric_stats(db, wines_count, Wine.fruitiness),
        "price": _numeric_stats(db, listings_count, RetailerListing.price),
        "price_usd_approx": _numeric_stats(db, listings_count, usd_price),
    }

    categorical = {
        "type": _categorical_counts(db, Wine.type),
        "country": _categorical_counts(db, Wine.country),
        "region": _categorical_counts(db, Wine.region),
        "currency": _categorical_counts(db, RetailerListing.currency),
        "availability": _categorical_counts(db, RetailerListing.availability),
    }

    return {
        "wines_count": wines_count,
        "wineries_count": wineries_count,
        "retailers_count": retailers_count,
        "listings_count": listings_count,
        "numeric": numeric,
        "categorical": categorical,
    }
```

Create `backend/app/api/admin.py`:

```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_admin_key
from app.schemas.admin import AdminStats
from app.services import admin as admin_service

router = APIRouter()


@router.get("/admin/stats", response_model=AdminStats, dependencies=[Depends(require_admin_key)])
def get_stats(db: Session = Depends(get_db)) -> AdminStats:
    return AdminStats(**admin_service.get_stats(db))
```

In `backend/app/main.py`, change:

```python
from app.api.wines import router as wines_router
from app.api.recommendations import router as recommendations_router
```

to:

```python
from app.api.admin import router as admin_router
from app.api.wines import router as wines_router
from app.api.recommendations import router as recommendations_router
```

and change:

```python
app.include_router(wines_router, prefix="/api")
app.include_router(recommendations_router, prefix="/api")
```

to:

```python
app.include_router(wines_router, prefix="/api")
app.include_router(recommendations_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/api/test_admin.py tests/api/test_wines.py -v`
Expected: PASS — all tests in both files pass.

- [ ] **Step 5: Run the full backend test suite to confirm no regressions**

Run: `pytest -v`
Expected: PASS — no regressions.

- [ ] **Step 6: Commit**

```bash
git add backend/app/schemas/admin.py backend/app/services/admin.py backend/app/api/admin.py backend/app/main.py tests/api/conftest.py tests/api/test_wines.py tests/api/test_admin.py
git commit -m "feat: add GET /api/admin/stats endpoint"
```

---

### Task 2: Backend — `PUT /api/wines/{id}/grapes`

**Files:**
- Modify: `backend/app/schemas/wine.py` (add `GrapeIn`, `GrapesUpdate`)
- Modify: `backend/app/services/wines.py` (add `get_or_create_grape`, `update_grapes`)
- Modify: `backend/app/api/wines.py` (imports, add the route)
- Test: `tests/api/test_wines.py`

**Interfaces:**
- Consumes: `require_admin_key` from `app.api.deps`; `admin_headers`/`seeded_wines` fixtures (`tests/api/conftest.py`/`test_wines.py`).
- Produces: nothing later in this plan depends on the exact Python function names, but the frontend Task 3 mirrors the endpoint's request/response shape: `PUT /api/wines/{id}/grapes` with body `{"grapes": [{"name": str, "percentage": float | null}]}`, returning a `WineDetail`.

- [ ] **Step 1: Write the failing tests**

Add to `tests/api/test_wines.py`, directly after the last test from the currency/write-api work (the file currently ends with `test_cors_preflight_allows_patch_method` — append after it):

```python
def test_update_grapes_replaces_existing_blend(client, admin_headers, seeded_wines):
    response = client.put(
        f"/api/wines/{seeded_wines['wine1']}/grapes",
        json={"grapes": [{"name": "Petit Verdot", "percentage": 100}]},
        headers=admin_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["grapes"] == [{"name": "Petit Verdot", "percentage": 100.0}]


def test_update_grapes_reuses_existing_grape(client, admin_headers, seeded_wines, db_session):
    client.put(
        f"/api/wines/{seeded_wines['wine1']}/grapes",
        json={"grapes": [{"name": "Cabernet Sauvignon", "percentage": 100}]},
        headers=admin_headers,
    )
    count = db_session.query(Grape).filter_by(name="Cabernet Sauvignon").count()
    assert count == 1


def test_update_grapes_creates_new_grape(client, admin_headers, seeded_wines, db_session):
    response = client.put(
        f"/api/wines/{seeded_wines['wine2']}/grapes",
        json={"grapes": [{"name": "Nebbiolo", "percentage": None}]},
        headers=admin_headers,
    )
    assert response.status_code == 200
    assert db_session.query(Grape).filter_by(name="Nebbiolo").one_or_none() is not None


def test_update_grapes_allows_empty_blend(client, admin_headers, seeded_wines):
    response = client.put(
        f"/api/wines/{seeded_wines['wine1']}/grapes", json={"grapes": []}, headers=admin_headers
    )
    assert response.status_code == 200
    assert response.json()["grapes"] == []


def test_update_grapes_duplicate_name_returns_422(client, admin_headers, seeded_wines):
    response = client.put(
        f"/api/wines/{seeded_wines['wine1']}/grapes",
        json={"grapes": [{"name": "Merlot", "percentage": 50}, {"name": "Merlot", "percentage": 50}]},
        headers=admin_headers,
    )
    assert response.status_code == 422


def test_update_grapes_unknown_wine_returns_404(client, admin_headers):
    response = client.put("/api/wines/999999/grapes", json={"grapes": [{"name": "Merlot"}]}, headers=admin_headers)
    assert response.status_code == 404


def test_update_grapes_missing_admin_key_returns_401(client, seeded_wines):
    response = client.put(f"/api/wines/{seeded_wines['wine1']}/grapes", json={"grapes": []})
    assert response.status_code == 401
```

(`Grape` is already imported at the top of `tests/api/test_wines.py` via `from app.models import Grape, Retailer, RetailerListing, Wine, WineGrape, Winery`.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/api/test_wines.py -v -k update_grapes`
Expected: FAIL — `405 Method Not Allowed` for every test (no `PUT /wines/{id}/grapes` route exists yet).

- [ ] **Step 3: Write minimal implementation**

In `backend/app/schemas/wine.py`, add after `RetailerListingUpdate` and before `WineDetail`:

```python
class GrapeIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Annotated[str, Field(max_length=100)]
    percentage: Optional[Annotated[float, Field(ge=0, le=100)]] = None


class GrapesUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    grapes: list[GrapeIn]

    @field_validator("grapes")
    @classmethod
    def _reject_duplicate_names(cls, value):
        names = [g.name.strip().lower() for g in value]
        if len(names) != len(set(names)):
            raise ValueError("duplicate grape name in request")
        return value
```

In `backend/app/services/wines.py`, add at the end of the file:

```python
def get_or_create_grape(db: Session, name: str) -> Grape:
    grape = db.query(Grape).filter_by(name=name).one_or_none()
    if grape is None:
        grape = Grape(name=name)
        db.add(grape)
        db.flush()
    return grape


def update_grapes(db: Session, wine_id: int, grapes: list[dict]) -> Optional[dict]:
    wine = db.get(Wine, wine_id)
    if wine is None:
        return None
    wine.grapes.clear()
    for entry in grapes:
        grape = get_or_create_grape(db, entry["name"])
        wine.grapes.append(WineGrape(grape=grape, percentage=entry.get("percentage")))
    db.commit()
    return get_wine(db, wine_id)
```

In `backend/app/api/wines.py`, change the schema import:

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

to:

```python
from app.schemas.wine import (
    GrapesUpdate,
    RetailerListingCreate,
    RetailerListingOut,
    RetailerListingUpdate,
    WineDetail,
    WineListResponse,
    WineUpdate,
)
```

Then append this route at the end of the file:

```python
@router.put(
    "/wines/{wine_id}/grapes",
    response_model=WineDetail,
    dependencies=[Depends(require_admin_key)],
)
def update_grapes(wine_id: int, body: GrapesUpdate, db: Session = Depends(get_db)) -> WineDetail:
    result = wines_service.update_grapes(db, wine_id, [g.model_dump() for g in body.grapes])
    if result is None:
        raise HTTPException(status_code=404, detail="Wine not found")
    return WineDetail(**result)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/api/test_wines.py -v`
Expected: PASS — all tests pass, including the 7 new ones.

- [ ] **Step 5: Run the full backend test suite to confirm no regressions**

Run: `pytest -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/schemas/wine.py backend/app/services/wines.py backend/app/api/wines.py tests/api/test_wines.py
git commit -m "feat: add PUT /wines/{id}/grapes to replace a wine's grape blend"
```

---

### Task 3: Frontend — admin auth module, admin API client, and shared type additions

**Files:**
- Modify: `frontend/src/types/wine.ts` (`RetailerListing` gains `id`; add `ColumnStats`, `AdminStats`, `WineUpdatePayload`, `ListingPayload`, `GrapeInput`)
- Create: `frontend/src/services/adminAuth.ts`
- Create: `frontend/src/services/adminApi.ts`
- Modify (fixture-only, to keep the `RetailerListing.id` type change compiling): `frontend/src/components/wine/RetailerListingRow.test.tsx`, `frontend/src/pages/WineDetailPage.test.tsx`
- Test: `frontend/src/services/adminAuth.test.ts` (new), `frontend/src/services/adminApi.test.ts` (new)

**Interfaces:**
- Consumes: nothing (no dependency on Tasks 1-2 for the frontend to compile, though it mirrors their response shapes).
- Produces: `getAdminKey(): string | null`, `setAdminKey(key: string): void`, `clearAdminKey(): void` (`app/services/adminAuth`). `getAdminStats(): Promise<AdminStats>`, `updateWine(id: number, payload: WineUpdatePayload): Promise<WineDetail>`, `updateGrapes(id: number, grapes: GrapeInput[]): Promise<WineDetail>`, `createListing(wineId: number, payload: ListingPayload): Promise<RetailerListing>`, `updateListing(wineId: number, listingId: number, payload: ListingPayload): Promise<RetailerListing>`, `deleteListing(wineId: number, listingId: number): Promise<void>` (`app/services/adminApi`) — Tasks 4-6 import and use these exact names/signatures.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/services/adminAuth.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { getAdminKey, setAdminKey, clearAdminKey } from "./adminAuth";

describe("adminAuth", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("returns null when no key is stored", () => {
    expect(getAdminKey()).toBeNull();
  });

  it("stores and retrieves a key", () => {
    setAdminKey("secret123");
    expect(getAdminKey()).toBe("secret123");
  });

  it("clears a stored key", () => {
    setAdminKey("secret123");
    clearAdminKey();
    expect(getAdminKey()).toBeNull();
  });
});
```

Create `frontend/src/services/adminApi.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getAdminStats,
  updateWine,
  updateGrapes,
  createListing,
  updateListing,
  deleteListing,
} from "./adminApi";
import { setAdminKey, clearAdminKey } from "./adminAuth";
import { ApiError } from "./api";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  sessionStorage.clear();
  setAdminKey("test-key");
});

describe("adminApi", () => {
  it("getAdminStats sends the admin key header", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ wines_count: 0 }) });
    await getAdminStats();
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/admin/stats");
    expect((options.headers as Record<string, string>)["X-Admin-Key"]).toBe("test-key");
  });

  it("updateWine sends a PATCH with the payload", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: 1 }) });
    await updateWine(1, { abv: 14.5 });
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/wines/1");
    expect(options.method).toBe("PATCH");
    expect(JSON.parse(options.body as string)).toEqual({ abv: 14.5 });
  });

  it("updateGrapes sends a PUT to the grapes endpoint", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: 1 }) });
    await updateGrapes(1, [{ name: "Merlot", percentage: 100 }]);
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/wines/1/grapes");
    expect(options.method).toBe("PUT");
    expect(JSON.parse(options.body as string)).toEqual({ grapes: [{ name: "Merlot", percentage: 100 }] });
  });

  it("createListing sends a POST to the listings endpoint", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 201, json: async () => ({ id: 5 }) });
    await createListing(1, { retailer: "Total Wine", price: 50 });
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/wines/1/listings");
    expect(options.method).toBe("POST");
  });

  it("updateListing sends a PATCH to the specific listing", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: 5 }) });
    await updateListing(1, 5, { price: 60 });
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/wines/1/listings/5");
    expect(options.method).toBe("PATCH");
  });

  it("deleteListing sends a DELETE to the specific listing", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 204, json: async () => ({}) });
    await deleteListing(1, 5);
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/wines/1/listings/5");
    expect(options.method).toBe("DELETE");
  });

  it("throws ApiError on a non-ok response", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
    await expect(getAdminStats()).rejects.toBeInstanceOf(ApiError);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm run test -- --run adminAuth.test.ts adminApi.test.ts`
Expected: FAIL — cannot find modules `./adminAuth` / `./adminApi`.

- [ ] **Step 3: Update shared types**

In `frontend/src/types/wine.ts`, replace `RetailerListing`:

```typescript
export interface RetailerListing {
  id: number;
  retailer: string;
  price: number | null;
  currency: string | null;
  price_usd_approx: number | null;
  product_url: string | null;
  availability: string | null;
}
```

Add at the end of the file:

```typescript
export interface ColumnStats {
  count: number;
  null_count: number;
  min: number | null;
  max: number | null;
  avg: number | null;
}

export interface AdminStats {
  wines_count: number;
  wineries_count: number;
  retailers_count: number;
  listings_count: number;
  numeric: Record<string, ColumnStats>;
  categorical: Record<string, Record<string, number>>;
}

export interface WineUpdatePayload {
  name?: string;
  winery?: string;
  vintage?: number | null;
  type?: string;
  country?: string | null;
  region?: string | null;
  subregion?: string | null;
  abv?: number | null;
  sweetness?: number | null;
  acidity?: number | null;
  tannin?: number | null;
  body?: number | null;
  fruitiness?: number | null;
  description?: string | null;
  image_url?: string | null;
}

export interface ListingPayload {
  retailer?: string;
  price?: number | null;
  currency?: string | null;
  availability?: string | null;
  product_url?: string | null;
}

export interface GrapeInput {
  name: string;
  percentage: number | null;
}
```

- [ ] **Step 4: Write the implementation**

Create `frontend/src/services/adminAuth.ts`:

```typescript
const STORAGE_KEY = "vinoscope_admin_key";

export function getAdminKey(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAdminKey(key: string): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, key);
  } catch {
    // sessionStorage unavailable (e.g. private browsing) - the admin session just won't persist.
  }
}

export function clearAdminKey(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
```

Create `frontend/src/services/adminApi.ts`:

```typescript
import type {
  AdminStats,
  GrapeInput,
  ListingPayload,
  RetailerListing,
  WineDetail,
  WineUpdatePayload,
} from "../types/wine";
import { getAdminKey } from "./adminAuth";
import { ApiError } from "./api";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

function adminHeaders(): Record<string, string> {
  const key = getAdminKey();
  return key ? { "X-Admin-Key": key } : {};
}

export async function getAdminStats(): Promise<AdminStats> {
  const response = await fetch(`${API_BASE_URL}/api/admin/stats`, { headers: adminHeaders() });
  if (!response.ok) {
    throw new ApiError(response.status, `Failed to load admin stats (${response.status})`);
  }
  return response.json();
}

export async function updateWine(id: number, payload: WineUpdatePayload): Promise<WineDetail> {
  const response = await fetch(`${API_BASE_URL}/api/wines/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...adminHeaders() },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new ApiError(response.status, `Failed to update wine (${response.status})`);
  }
  return response.json();
}

export async function updateGrapes(id: number, grapes: GrapeInput[]): Promise<WineDetail> {
  const response = await fetch(`${API_BASE_URL}/api/wines/${id}/grapes`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...adminHeaders() },
    body: JSON.stringify({ grapes }),
  });
  if (!response.ok) {
    throw new ApiError(response.status, `Failed to update grapes (${response.status})`);
  }
  return response.json();
}

export async function createListing(wineId: number, payload: ListingPayload): Promise<RetailerListing> {
  const response = await fetch(`${API_BASE_URL}/api/wines/${wineId}/listings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...adminHeaders() },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new ApiError(response.status, `Failed to create listing (${response.status})`);
  }
  return response.json();
}

export async function updateListing(
  wineId: number,
  listingId: number,
  payload: ListingPayload
): Promise<RetailerListing> {
  const response = await fetch(`${API_BASE_URL}/api/wines/${wineId}/listings/${listingId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...adminHeaders() },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new ApiError(response.status, `Failed to update listing (${response.status})`);
  }
  return response.json();
}

export async function deleteListing(wineId: number, listingId: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/wines/${wineId}/listings/${listingId}`, {
    method: "DELETE",
    headers: adminHeaders(),
  });
  if (!response.ok) {
    throw new ApiError(response.status, `Failed to delete listing (${response.status})`);
  }
}
```

Now fix every fixture that constructs a `RetailerListing` literal, so the new `id` field compiles:

In `frontend/src/components/wine/RetailerListingRow.test.tsx`, add `id: 1,` as the first field in all four listing object literals (before `retailer: "..."` in each of the 4 `it(...)` blocks).

In `frontend/src/pages/WineDetailPage.test.tsx`, add `id: 1,` as the first field inside the `listings: [{ ... }]` object (before `retailer: "Total Wine",` at line 39).

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend && npm run test -- --run`
Expected: PASS — no regressions, including the new `adminAuth.test.ts` (3 tests) and `adminApi.test.ts` (7 tests).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types/wine.ts frontend/src/services/adminAuth.ts frontend/src/services/adminAuth.test.ts \
  frontend/src/services/adminApi.ts frontend/src/services/adminApi.test.ts \
  frontend/src/components/wine/RetailerListingRow.test.tsx frontend/src/pages/WineDetailPage.test.tsx
git commit -m "feat: add admin auth module, admin API client, and listing id to types"
```

---

### Task 4: Frontend — `WineEditPanel` (wine fields, listings, grapes)

**Files:**
- Create: `frontend/src/components/admin/WineEditPanel.tsx`
- Create: `frontend/src/components/admin/WineFieldsSection.tsx`
- Create: `frontend/src/components/admin/ListingsSection.tsx`
- Create: `frontend/src/components/admin/GrapesSection.tsx`
- Test: `frontend/src/components/admin/WineFieldsSection.test.tsx`, `frontend/src/components/admin/ListingsSection.test.tsx`, `frontend/src/components/admin/GrapesSection.test.tsx`, `frontend/src/components/admin/WineEditPanel.test.tsx`

**Interfaces:**
- Consumes: `updateWine`, `updateGrapes`, `createListing`, `updateListing`, `deleteListing` from `app/services/adminApi` (Task 3); `getWine`, `ApiError` from `app/services/api` (existing); `WineDetail`, `RetailerListing`, `GrapeInput` types (existing + Task 3).
- Produces: `WineEditPanel({ wine: WineDetail; onUpdated: (wine: WineDetail) => void })` — Tasks 5 and 6 mount this exact component with these exact prop names.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/admin/WineFieldsSection.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WineFieldsSection } from "./WineFieldsSection";
import * as adminApi from "../../services/adminApi";
import type { WineDetail } from "../../types/wine";

vi.mock("../../services/adminApi", async () => {
  const actual = await vi.importActual<typeof import("../../services/adminApi")>("../../services/adminApi");
  return { ...actual, updateWine: vi.fn() };
});

const updateWineMock = adminApi.updateWine as unknown as ReturnType<typeof vi.fn>;

const wine: WineDetail = {
  id: 1,
  name: "Caymus Cabernet Sauvignon",
  winery: "Caymus Vineyards",
  vintage: 2022,
  type: "red",
  country: "United States",
  region: "Napa Valley",
  subregion: null,
  abv: 14.6,
  description: "Bold.",
  grapes: [],
  price: null,
  currency: null,
  price_usd_approx: null,
  image_url: null,
  sweetness: 1,
  acidity: 3,
  tannin: 5,
  body: 5,
  fruitiness: 3,
  listings: [],
};

describe("WineFieldsSection", () => {
  beforeEach(() => {
    updateWineMock.mockReset();
  });

  it("disables Save until a field is changed", () => {
    render(<WineFieldsSection wine={wine} onUpdated={() => {}} />);
    expect(screen.getByRole("button", { name: /save wine/i })).toBeDisabled();
  });

  it("saves only the changed field", async () => {
    const onUpdated = vi.fn();
    updateWineMock.mockResolvedValue({ ...wine, abv: 15.0 });
    render(<WineFieldsSection wine={wine} onUpdated={onUpdated} />);

    const abvInput = screen.getByLabelText(/abv/i);
    await userEvent.clear(abvInput);
    await userEvent.type(abvInput, "15");
    await userEvent.click(screen.getByRole("button", { name: /save wine/i }));

    expect(updateWineMock).toHaveBeenCalledWith(1, { abv: 15 });
    expect(onUpdated).toHaveBeenCalledWith({ ...wine, abv: 15.0 });
  });

  it("shows an error message when the save fails", async () => {
    const { ApiError } = await import("../../services/api");
    updateWineMock.mockRejectedValue(new ApiError(422, "invalid type"));
    render(<WineFieldsSection wine={wine} onUpdated={() => {}} />);

    const nameInput = screen.getByLabelText(/name/i);
    await userEvent.type(nameInput, "!");
    await userEvent.click(screen.getByRole("button", { name: /save wine/i }));

    expect(await screen.findByText("invalid type")).toBeInTheDocument();
  });

  it("clears the admin key and shows a session-expired message on a 401", async () => {
    const { ApiError } = await import("../../services/api");
    const { setAdminKey, getAdminKey } = await import("../../services/adminAuth");
    setAdminKey("stale-key");
    updateWineMock.mockRejectedValue(new ApiError(401, "Invalid or missing admin key"));
    render(<WineFieldsSection wine={wine} onUpdated={() => {}} />);

    await userEvent.type(screen.getByLabelText(/name/i), "!");
    await userEvent.click(screen.getByRole("button", { name: /save wine/i }));

    expect(await screen.findByText(/session expired/i)).toBeInTheDocument();
    expect(getAdminKey()).toBeNull();
  });
});
```

Create `frontend/src/components/admin/ListingsSection.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ListingsSection } from "./ListingsSection";
import * as adminApi from "../../services/adminApi";
import * as api from "../../services/api";
import { ApiError } from "../../services/api";
import type { WineDetail } from "../../types/wine";

vi.mock("../../services/adminApi", async () => {
  const actual = await vi.importActual<typeof import("../../services/adminApi")>("../../services/adminApi");
  return { ...actual, createListing: vi.fn(), updateListing: vi.fn(), deleteListing: vi.fn() };
});
vi.mock("../../services/api", async () => {
  const actual = await vi.importActual<typeof import("../../services/api")>("../../services/api");
  return { ...actual, getWine: vi.fn() };
});

const createListingMock = adminApi.createListing as unknown as ReturnType<typeof vi.fn>;
const updateListingMock = adminApi.updateListing as unknown as ReturnType<typeof vi.fn>;
const deleteListingMock = adminApi.deleteListing as unknown as ReturnType<typeof vi.fn>;
const getWineMock = api.getWine as unknown as ReturnType<typeof vi.fn>;

const wine: WineDetail = {
  id: 1,
  name: "Caymus Cabernet Sauvignon",
  winery: "Caymus Vineyards",
  vintage: 2022,
  type: "red",
  country: null,
  region: null,
  subregion: null,
  abv: null,
  description: null,
  grapes: [],
  price: 79.99,
  currency: "USD",
  price_usd_approx: 79.99,
  image_url: null,
  sweetness: null,
  acidity: null,
  tannin: null,
  body: null,
  fruitiness: null,
  listings: [
    {
      id: 5,
      retailer: "Total Wine",
      price: 79.99,
      currency: "USD",
      price_usd_approx: 79.99,
      product_url: null,
      availability: null,
    },
  ],
};

describe("ListingsSection", () => {
  beforeEach(() => {
    createListingMock.mockReset();
    updateListingMock.mockReset();
    deleteListingMock.mockReset();
    getWineMock.mockReset();
  });

  it("renders each existing listing", () => {
    render(<ListingsSection wine={wine} onUpdated={() => {}} />);
    expect(screen.getByText("Total Wine")).toBeInTheDocument();
  });

  it("saves an edited listing and refreshes the wine", async () => {
    const onUpdated = vi.fn();
    updateListingMock.mockResolvedValue({ ...wine.listings[0], price: 89.99 });
    getWineMock.mockResolvedValue({ ...wine, price: 89.99 });
    render(<ListingsSection wine={wine} onUpdated={onUpdated} />);

    const priceInput = screen.getByLabelText(/total wine price/i);
    await userEvent.clear(priceInput);
    await userEvent.type(priceInput, "89.99");
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));

    expect(updateListingMock).toHaveBeenCalledWith(1, 5, {
      price: 89.99,
      currency: "USD",
      availability: null,
      product_url: null,
    });
    expect(getWineMock).toHaveBeenCalledWith(1);
    expect(onUpdated).toHaveBeenCalledWith({ ...wine, price: 89.99 });
  });

  it("deletes a listing and refreshes the wine", async () => {
    deleteListingMock.mockResolvedValue(undefined);
    getWineMock.mockResolvedValue({ ...wine, listings: [] });
    render(<ListingsSection wine={wine} onUpdated={() => {}} />);

    await userEvent.click(screen.getByRole("button", { name: /delete/i }));

    expect(deleteListingMock).toHaveBeenCalledWith(1, 5);
    expect(getWineMock).toHaveBeenCalledWith(1);
  });

  it("adds a new listing and refreshes the wine", async () => {
    createListingMock.mockResolvedValue({ id: 6, retailer: "Wine.com", price: 50, currency: null, price_usd_approx: 50, product_url: null, availability: null });
    getWineMock.mockResolvedValue(wine);
    render(<ListingsSection wine={wine} onUpdated={() => {}} />);

    await userEvent.type(screen.getByLabelText(/new listing retailer/i), "Wine.com");
    await userEvent.click(screen.getByRole("button", { name: /add listing/i }));

    expect(createListingMock).toHaveBeenCalledWith(1, {
      retailer: "Wine.com",
      price: null,
      currency: null,
      availability: null,
      product_url: null,
    });
    expect(getWineMock).toHaveBeenCalledWith(1);
  });

  it("clears the admin key and shows a session-expired message on a 401", async () => {
    const { setAdminKey, getAdminKey } = await import("../../services/adminAuth");
    setAdminKey("stale-key");
    deleteListingMock.mockRejectedValue(new ApiError(401, "Invalid or missing admin key"));
    render(<ListingsSection wine={wine} onUpdated={() => {}} />);

    await userEvent.click(screen.getByRole("button", { name: /delete/i }));

    expect(await screen.findByText(/session expired/i)).toBeInTheDocument();
    expect(getAdminKey()).toBeNull();
  });
});
```

Create `frontend/src/components/admin/GrapesSection.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GrapesSection } from "./GrapesSection";
import * as adminApi from "../../services/adminApi";
import { ApiError } from "../../services/api";
import type { WineDetail } from "../../types/wine";

vi.mock("../../services/adminApi", async () => {
  const actual = await vi.importActual<typeof import("../../services/adminApi")>("../../services/adminApi");
  return { ...actual, updateGrapes: vi.fn() };
});

const updateGrapesMock = adminApi.updateGrapes as unknown as ReturnType<typeof vi.fn>;

const wine: WineDetail = {
  id: 1,
  name: "Bordeaux Blend",
  winery: "Some Winery",
  vintage: 2020,
  type: "red",
  country: null,
  region: null,
  subregion: null,
  abv: null,
  description: null,
  grapes: [
    { name: "Cabernet Sauvignon", percentage: 60 },
    { name: "Merlot", percentage: 40 },
  ],
  price: null,
  currency: null,
  price_usd_approx: null,
  image_url: null,
  sweetness: null,
  acidity: null,
  tannin: null,
  body: null,
  fruitiness: null,
  listings: [],
};

describe("GrapesSection", () => {
  beforeEach(() => {
    updateGrapesMock.mockReset();
  });

  it("renders existing grape rows", () => {
    render(<GrapesSection wine={wine} onUpdated={() => {}} />);
    expect(screen.getByDisplayValue("Cabernet Sauvignon")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Merlot")).toBeInTheDocument();
  });

  it("adds a blank row", async () => {
    render(<GrapesSection wine={wine} onUpdated={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /add grape/i }));
    expect(screen.getAllByLabelText(/name/i)).toHaveLength(3);
  });

  it("removes a row", async () => {
    render(<GrapesSection wine={wine} onUpdated={() => {}} />);
    await userEvent.click(screen.getAllByRole("button", { name: /remove/i })[1]);
    expect(screen.queryByDisplayValue("Merlot")).not.toBeInTheDocument();
  });

  it("saves the current table, dropping blank-name rows", async () => {
    const onUpdated = vi.fn();
    const updated = { ...wine, grapes: [{ name: "Cabernet Sauvignon", percentage: 60 }, { name: "Merlot", percentage: 40 }, { name: "Petit Verdot", percentage: null }] };
    updateGrapesMock.mockResolvedValue(updated);
    render(<GrapesSection wine={wine} onUpdated={onUpdated} />);

    await userEvent.click(screen.getByRole("button", { name: /add grape/i }));
    const nameInputs = screen.getAllByLabelText(/name/i);
    await userEvent.type(nameInputs[2], "Petit Verdot");
    await userEvent.click(screen.getByRole("button", { name: /save grapes/i }));

    expect(updateGrapesMock).toHaveBeenCalledWith(1, [
      { name: "Cabernet Sauvignon", percentage: 60 },
      { name: "Merlot", percentage: 40 },
      { name: "Petit Verdot", percentage: null },
    ]);
    expect(onUpdated).toHaveBeenCalledWith(updated);
  });

  it("clears the admin key and shows a session-expired message on a 401", async () => {
    const { setAdminKey, getAdminKey } = await import("../../services/adminAuth");
    setAdminKey("stale-key");
    updateGrapesMock.mockRejectedValue(new ApiError(401, "Invalid or missing admin key"));
    render(<GrapesSection wine={wine} onUpdated={() => {}} />);

    await userEvent.click(screen.getByRole("button", { name: /save grapes/i }));

    expect(await screen.findByText(/session expired/i)).toBeInTheDocument();
    expect(getAdminKey()).toBeNull();
  });
});
```

Create `frontend/src/components/admin/WineEditPanel.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WineEditPanel } from "./WineEditPanel";
import type { WineDetail } from "../../types/wine";

const wine: WineDetail = {
  id: 1,
  name: "Test Wine",
  winery: "Test Winery",
  vintage: 2022,
  type: "red",
  country: null,
  region: null,
  subregion: null,
  abv: null,
  description: null,
  grapes: [],
  price: null,
  currency: null,
  price_usd_approx: null,
  image_url: null,
  sweetness: null,
  acidity: null,
  tannin: null,
  body: null,
  fruitiness: null,
  listings: [],
};

describe("WineEditPanel", () => {
  it("renders all three sections", () => {
    render(<WineEditPanel wine={wine} onUpdated={() => {}} />);
    expect(screen.getByText("Wine details")).toBeInTheDocument();
    expect(screen.getByText("Listings")).toBeInTheDocument();
    expect(screen.getByText("Grapes")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm run test -- --run WineFieldsSection ListingsSection GrapesSection WineEditPanel`
Expected: FAIL — cannot find the four component modules.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/components/admin/WineFieldsSection.tsx`:

```tsx
import { useState } from "react";
import type { WineDetail, WineUpdatePayload } from "../../types/wine";
import { updateWine } from "../../services/adminApi";
import { ApiError } from "../../services/api";
import { clearAdminKey } from "../../services/adminAuth";

const WINE_TYPES = ["red", "white", "rosé", "sparkling", "dessert", "fortified"];
const RATING_DIMENSIONS = ["sweetness", "acidity", "tannin", "body", "fruitiness"] as const;

export function WineFieldsSection({
  wine,
  onUpdated,
}: {
  wine: WineDetail;
  onUpdated: (wine: WineDetail) => void;
}) {
  const [form, setForm] = useState({
    name: wine.name,
    winery: wine.winery,
    vintage: wine.vintage,
    type: wine.type,
    country: wine.country ?? "",
    region: wine.region ?? "",
    subregion: wine.subregion ?? "",
    abv: wine.abv,
    sweetness: wine.sweetness,
    acidity: wine.acidity,
    tannin: wine.tannin,
    body: wine.body,
    fruitiness: wine.fruitiness,
    description: wine.description ?? "",
    image_url: wine.image_url ?? "",
  });
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function update<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setDirty((prev) => new Set(prev).add(field as string));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const payload: WineUpdatePayload = {};
    for (const field of dirty) {
      (payload as Record<string, unknown>)[field] = (form as Record<string, unknown>)[field];
    }
    try {
      const updated = await updateWine(wine.id, payload);
      onUpdated(updated);
      setDirty(new Set());
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearAdminKey();
        setError("Session expired — please refresh the page and log in again.");
      } else {
        setError(err instanceof ApiError ? err.message : "Failed to save wine");
      }
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "bg-surface-raised border border-surface-border rounded px-2 py-1 text-ink";

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm uppercase tracking-wide text-ink-muted">Wine details</h2>
      <label className="flex flex-col gap-1 text-sm text-ink-muted">
        Name
        <input value={form.name} onChange={(e) => update("name", e.target.value)} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-ink-muted">
        Winery
        <input value={form.winery} onChange={(e) => update("winery", e.target.value)} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-ink-muted">
        Vintage
        <input
          type="number"
          value={form.vintage ?? ""}
          onChange={(e) => update("vintage", e.target.value === "" ? null : Number(e.target.value))}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-ink-muted">
        Type
        <select value={form.type} onChange={(e) => update("type", e.target.value)} className={inputClass}>
          {WINE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm text-ink-muted">
        Country
        <input value={form.country} onChange={(e) => update("country", e.target.value)} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-ink-muted">
        Region
        <input value={form.region} onChange={(e) => update("region", e.target.value)} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-ink-muted">
        Subregion
        <input
          value={form.subregion}
          onChange={(e) => update("subregion", e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-ink-muted">
        ABV
        <input
          type="number"
          value={form.abv ?? ""}
          onChange={(e) => update("abv", e.target.value === "" ? null : Number(e.target.value))}
          className={inputClass}
        />
      </label>
      {RATING_DIMENSIONS.map((dim) => (
        <label key={dim} className="flex flex-col gap-1 text-sm text-ink-muted capitalize">
          {dim}
          <input
            type="number"
            min={1}
            max={5}
            value={form[dim] ?? ""}
            onChange={(e) => update(dim, e.target.value === "" ? null : Number(e.target.value))}
            className={inputClass}
          />
        </label>
      ))}
      <label className="flex flex-col gap-1 text-sm text-ink-muted">
        Description
        <textarea
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-ink-muted">
        Image URL
        <input
          value={form.image_url}
          onChange={(e) => update("image_url", e.target.value)}
          className={inputClass}
        />
      </label>
      {error ? <p className="text-sm text-red-500">{error}</p> : null}
      <button
        type="button"
        onClick={handleSave}
        disabled={dirty.size === 0 || saving}
        className="self-start bg-accent text-surface text-sm px-3 py-1 rounded disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save wine"}
      </button>
    </div>
  );
}
```

Create `frontend/src/components/admin/ListingsSection.tsx`:

```tsx
import { useState } from "react";
import type { WineDetail, RetailerListing } from "../../types/wine";
import { createListing, updateListing, deleteListing } from "../../services/adminApi";
import { getWine, ApiError } from "../../services/api";
import { clearAdminKey } from "../../services/adminAuth";

const SESSION_EXPIRED_MESSAGE = "Session expired — please refresh the page and log in again.";

function describeError(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.status === 401) {
    clearAdminKey();
    return SESSION_EXPIRED_MESSAGE;
  }
  return err instanceof ApiError ? err.message : fallback;
}

interface ListingEdits {
  price: string;
  currency: string;
  availability: string;
  product_url: string;
}

export function ListingsSection({
  wine,
  onUpdated,
}: {
  wine: WineDetail;
  onUpdated: (wine: WineDetail) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [newListing, setNewListing] = useState({
    retailer: "",
    price: "",
    currency: "",
    availability: "",
    product_url: "",
  });

  async function refresh() {
    const fresh = await getWine(wine.id);
    onUpdated(fresh);
  }

  async function handleSaveListing(listing: RetailerListing, edits: ListingEdits) {
    setError(null);
    try {
      await updateListing(wine.id, listing.id, {
        price: edits.price === "" ? null : Number(edits.price),
        currency: edits.currency === "" ? null : edits.currency,
        availability: edits.availability === "" ? null : edits.availability,
        product_url: edits.product_url === "" ? null : edits.product_url,
      });
      await refresh();
    } catch (err) {
      setError(describeError(err, "Failed to save listing"));
    }
  }

  async function handleDeleteListing(listingId: number) {
    setError(null);
    try {
      await deleteListing(wine.id, listingId);
      await refresh();
    } catch (err) {
      setError(describeError(err, "Failed to delete listing"));
    }
  }

  async function handleAddListing() {
    setError(null);
    try {
      await createListing(wine.id, {
        retailer: newListing.retailer,
        price: newListing.price === "" ? null : Number(newListing.price),
        currency: newListing.currency === "" ? null : newListing.currency,
        availability: newListing.availability === "" ? null : newListing.availability,
        product_url: newListing.product_url === "" ? null : newListing.product_url,
      });
      setNewListing({ retailer: "", price: "", currency: "", availability: "", product_url: "" });
      await refresh();
    } catch (err) {
      setError(describeError(err, "Failed to add listing"));
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm uppercase tracking-wide text-ink-muted">Listings</h2>
      {wine.listings.map((listing) => (
        <ListingRow key={listing.id} listing={listing} onSave={handleSaveListing} onDelete={handleDeleteListing} />
      ))}
      <div className="flex gap-2 items-end flex-wrap">
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Retailer
          <input
            aria-label="New listing retailer"
            value={newListing.retailer}
            onChange={(e) => setNewListing((prev) => ({ ...prev, retailer: e.target.value }))}
            className="bg-surface-raised border border-surface-border rounded px-2 py-1 text-ink"
          />
        </label>
        <button
          type="button"
          onClick={handleAddListing}
          disabled={newListing.retailer === ""}
          className="bg-accent text-surface text-sm px-3 py-1 rounded disabled:opacity-50"
        >
          Add listing
        </button>
      </div>
      {error ? <p className="text-sm text-red-500">{error}</p> : null}
    </div>
  );
}

function ListingRow({
  listing,
  onSave,
  onDelete,
}: {
  listing: RetailerListing;
  onSave: (listing: RetailerListing, edits: ListingEdits) => void;
  onDelete: (listingId: number) => void;
}) {
  const [edits, setEdits] = useState<ListingEdits>({
    price: listing.price === null ? "" : String(listing.price),
    currency: listing.currency ?? "",
    availability: listing.availability ?? "",
    product_url: listing.product_url ?? "",
  });

  return (
    <div className="flex gap-2 items-end flex-wrap border-b border-surface-border pb-2">
      <span className="text-sm text-ink-muted min-w-[8rem]">{listing.retailer}</span>
      <label className="flex flex-col gap-1 text-xs text-ink-muted">
        Price
        <input
          aria-label={`${listing.retailer} price`}
          type="number"
          value={edits.price}
          onChange={(e) => setEdits((prev) => ({ ...prev, price: e.target.value }))}
          className="bg-surface-raised border border-surface-border rounded px-2 py-1 text-ink w-24"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-muted">
        Currency
        <input
          aria-label={`${listing.retailer} currency`}
          value={edits.currency}
          onChange={(e) => setEdits((prev) => ({ ...prev, currency: e.target.value }))}
          className="bg-surface-raised border border-surface-border rounded px-2 py-1 text-ink w-20"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-muted">
        Availability
        <input
          aria-label={`${listing.retailer} availability`}
          value={edits.availability}
          onChange={(e) => setEdits((prev) => ({ ...prev, availability: e.target.value }))}
          className="bg-surface-raised border border-surface-border rounded px-2 py-1 text-ink"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-muted flex-1 min-w-[10rem]">
        Product URL
        <input
          aria-label={`${listing.retailer} product URL`}
          value={edits.product_url}
          onChange={(e) => setEdits((prev) => ({ ...prev, product_url: e.target.value }))}
          className="bg-surface-raised border border-surface-border rounded px-2 py-1 text-ink"
        />
      </label>
      <button type="button" onClick={() => onSave(listing, edits)} className="bg-accent text-surface text-sm px-3 py-1 rounded">
        Save
      </button>
      <button type="button" onClick={() => onDelete(listing.id)} className="text-sm text-red-500 px-3 py-1">
        Delete
      </button>
    </div>
  );
}
```

Create `frontend/src/components/admin/GrapesSection.tsx`:

```tsx
import { useState } from "react";
import type { WineDetail, GrapeInput } from "../../types/wine";
import { updateGrapes } from "../../services/adminApi";
import { ApiError } from "../../services/api";
import { clearAdminKey } from "../../services/adminAuth";

export function GrapesSection({
  wine,
  onUpdated,
}: {
  wine: WineDetail;
  onUpdated: (wine: WineDetail) => void;
}) {
  const [rows, setRows] = useState<{ name: string; percentage: string }[]>(
    wine.grapes.map((g) => ({ name: g.name, percentage: g.percentage === null ? "" : String(g.percentage) }))
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function updateRow(index: number, field: "name" | "percentage", value: string) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function addRow() {
    setRows((prev) => [...prev, { name: "", percentage: "" }]);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const grapes: GrapeInput[] = rows
      .filter((row) => row.name.trim() !== "")
      .map((row) => ({ name: row.name.trim(), percentage: row.percentage === "" ? null : Number(row.percentage) }));
    try {
      const updated = await updateGrapes(wine.id, grapes);
      onUpdated(updated);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearAdminKey();
        setError("Session expired — please refresh the page and log in again.");
      } else {
        setError(err instanceof ApiError ? err.message : "Failed to save grapes");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm uppercase tracking-wide text-ink-muted">Grapes</h2>
      {rows.map((row, index) => (
        <div key={index} className="flex gap-2 items-end">
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            Name
            <input
              aria-label={`Grape ${index + 1} name`}
              value={row.name}
              onChange={(e) => updateRow(index, "name", e.target.value)}
              className="bg-surface-raised border border-surface-border rounded px-2 py-1 text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            Percentage
            <input
              aria-label={`Grape ${index + 1} percentage`}
              type="number"
              value={row.percentage}
              onChange={(e) => updateRow(index, "percentage", e.target.value)}
              className="bg-surface-raised border border-surface-border rounded px-2 py-1 text-ink w-24"
            />
          </label>
          <button type="button" onClick={() => removeRow(index)} className="text-sm text-red-500 px-2 py-1">
            Remove
          </button>
        </div>
      ))}
      <button type="button" onClick={addRow} className="self-start text-sm text-accent">
        + Add grape
      </button>
      {error ? <p className="text-sm text-red-500">{error}</p> : null}
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="self-start bg-accent text-surface text-sm px-3 py-1 rounded disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save grapes"}
      </button>
    </div>
  );
}
```

Create `frontend/src/components/admin/WineEditPanel.tsx`:

```tsx
import type { WineDetail } from "../../types/wine";
import { WineFieldsSection } from "./WineFieldsSection";
import { ListingsSection } from "./ListingsSection";
import { GrapesSection } from "./GrapesSection";

export function WineEditPanel({
  wine,
  onUpdated,
}: {
  wine: WineDetail;
  onUpdated: (wine: WineDetail) => void;
}) {
  return (
    <div className="flex flex-col gap-6 border border-surface-border rounded p-4">
      <WineFieldsSection wine={wine} onUpdated={onUpdated} />
      <ListingsSection wine={wine} onUpdated={onUpdated} />
      <GrapesSection wine={wine} onUpdated={onUpdated} />
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm run test -- --run`
Expected: PASS — no regressions, including all new component tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/admin
git commit -m "feat: add WineEditPanel for editing wine fields, listings, and grapes"
```

---

### Task 5: Frontend — edit toggle on `WineDetailPage`

**Files:**
- Modify: `frontend/src/pages/WineDetailPage.tsx`
- Test: `frontend/src/pages/WineDetailPage.test.tsx`

**Interfaces:**
- Consumes: `getAdminKey` (`app/services/adminAuth`, Task 3), `WineEditPanel` (`app/components/admin/WineEditPanel`, Task 4).
- Produces: nothing later depends on this.

- [ ] **Step 1: Write the failing tests**

Add to `frontend/src/pages/WineDetailPage.test.tsx`, inside the `describe("WineDetailPage", ...)` block, and add the needed imports/mock at the top of the file. Replace the top of the file (imports and the `vi.mock` block) with:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { WineDetailPage } from "./WineDetailPage";
import * as api from "../services/api";
import { ApiError } from "../services/api";
import { setAdminKey, clearAdminKey } from "../services/adminAuth";
import type { WineDetail } from "../types/wine";

vi.mock("../services/api", async () => {
  const actual = await vi.importActual<typeof import("../services/api")>("../services/api");
  return { ...actual, getWine: vi.fn() };
});

const getWineMock = api.getWine as unknown as ReturnType<typeof vi.fn>;
```

(This only adds `userEvent`, `afterEach`, and the `adminAuth` import to the existing import block — everything else stays as it already is.)

Then add these tests inside the `describe` block, after the existing three tests:

```tsx
  it("does not show an edit toggle when not logged in as admin", async () => {
    clearAdminKey();
    getWineMock.mockResolvedValue(fullWine);
    renderDetail();

    await waitFor(() => expect(screen.getByText("Caymus Cabernet Sauvignon")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /edit this wine/i })).not.toBeInTheDocument();
  });

  it("shows an edit toggle when logged in as admin, and reveals the edit panel", async () => {
    setAdminKey("test-key");
    getWineMock.mockResolvedValue(fullWine);
    renderDetail();

    await waitFor(() => expect(screen.getByText("Caymus Cabernet Sauvignon")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /edit this wine/i }));

    expect(screen.getByText("Wine details")).toBeInTheDocument();
    clearAdminKey();
  });
```

And add an `afterEach` inside the `describe` block (alongside the existing `beforeEach`):

```tsx
  afterEach(() => {
    clearAdminKey();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm run test -- --run WineDetailPage`
Expected: FAIL — no "Edit this wine" button exists yet.

- [ ] **Step 3: Write the implementation**

Replace the full contents of `frontend/src/pages/WineDetailPage.tsx`:

```tsx
import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { getWine, ApiError } from "../services/api";
import { useApiQuery } from "../hooks/useApiQuery";
import { CharacteristicBar } from "../components/wine/CharacteristicBar";
import { RetailerListingRow } from "../components/wine/RetailerListingRow";
import { ErrorMessage } from "../components/common/ErrorMessage";
import { Skeleton } from "../components/common/Skeleton";
import { formatVintage } from "../utils/format";
import { getAdminKey } from "../services/adminAuth";
import { WineEditPanel } from "../components/admin/WineEditPanel";
import type { WineDetail } from "../types/wine";

const PLACEHOLDER_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='520'%3E%3Crect width='400' height='520' fill='%232f1b1e'/%3E%3C/svg%3E";

export function WineDetailPage() {
  const { id } = useParams<{ id: string }>();
  const wineId = Number(id);

  const { data, loading, error } = useApiQuery(() => getWine(wineId), [wineId]);
  const [wine, setWine] = useState<WineDetail | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setWine(data);
    setEditing(false);
  }, [data]);

  if (loading) {
    return (
      <div className="flex flex-col md:flex-row gap-8">
        <Skeleton className="w-full md:w-80 h-96" />
        <div className="flex-1 flex flex-col gap-3">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (error instanceof ApiError && error.status === 404) {
    return (
      <div className="text-center py-12">
        <h1 className="font-serif text-2xl text-ink mb-2">Wine not found</h1>
        <Link to="/explore" className="text-accent hover:underline">
          Back to Explore
        </Link>
      </div>
    );
  }

  if (error || !wine) {
    return <ErrorMessage message="Couldn't load this wine. Please try again." />;
  }

  return (
    <div className="flex flex-col md:flex-row gap-8">
      <img
        src={wine.image_url ?? PLACEHOLDER_IMAGE}
        alt={wine.name}
        className="w-full md:w-80 h-96 object-cover bg-surface-raised rounded"
      />

      <div className="flex-1 flex flex-col gap-4">
        <div>
          <span className="inline-block text-xs uppercase tracking-wide text-accent mb-1">{wine.type}</span>
          <h1 className="font-serif text-2xl text-ink">{wine.name}</h1>
          <p className="text-ink-muted">
            {wine.winery} &middot; {formatVintage(wine.vintage)}
          </p>
          <p className="text-ink-muted">{[wine.region, wine.subregion, wine.country].filter(Boolean).join(", ")}</p>
          {getAdminKey() ? (
            <button
              type="button"
              onClick={() => setEditing((prev) => !prev)}
              className="text-sm text-accent hover:underline mt-1"
            >
              {editing ? "Close editor" : "Edit this wine"}
            </button>
          ) : null}
        </div>

        {editing ? <WineEditPanel wine={wine} onUpdated={setWine} /> : null}

        <div className="flex flex-col gap-2">
          <CharacteristicBar label="Sweetness" value={wine.sweetness} />
          <CharacteristicBar label="Acidity" value={wine.acidity} />
          <CharacteristicBar label="Tannin" value={wine.tannin} />
          <CharacteristicBar label="Body" value={wine.body} />
          <CharacteristicBar label="Fruitiness" value={wine.fruitiness} />
        </div>

        <div>
          <h2 className="text-sm uppercase tracking-wide text-ink-muted mb-1">Grapes</h2>
          <p className="text-ink">
            {wine.grapes.length === 0
              ? "Not specified"
              : wine.grapes
                  .map((g) => (g.percentage === null ? g.name : `${g.name} (${g.percentage}%)`))
                  .join(", ")}
          </p>
        </div>

        {wine.abv !== null ? <p className="text-ink-muted text-sm">ABV: {wine.abv}%</p> : null}

        {wine.description ? <p className="text-ink">{wine.description}</p> : null}

        <div>
          <h2 className="text-sm uppercase tracking-wide text-ink-muted mb-1">Retailers</h2>
          {wine.listings.length === 0 ? (
            <p className="text-ink-muted text-sm">No retailers currently listed.</p>
          ) : (
            wine.listings.map((listing) => <RetailerListingRow key={listing.id} listing={listing} />)
          )}
        </div>
      </div>
    </div>
  );
}
```

(Two behavioral changes beyond the edit toggle: `wine` now comes from local state synced from the query via `useEffect`, so `onUpdated`/`setWine` can refresh the displayed record after a save; and `wine.listings.map((listing, i) => ... key={i})` becomes `key={listing.id}`, now that listings carry a stable id.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm run test -- --run`
Expected: PASS — no regressions.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/WineDetailPage.tsx frontend/src/pages/WineDetailPage.test.tsx
git commit -m "feat: add admin edit toggle to WineDetailPage"
```

---

### Task 6: Frontend — `/admin` page, header link, and route

**Files:**
- Create: `frontend/src/pages/AdminPage.tsx`
- Modify: `frontend/src/components/layout/Header.tsx`
- Modify: `frontend/src/App.tsx`
- Test: `frontend/src/pages/AdminPage.test.tsx`, `frontend/src/components/layout/Header.test.tsx` (new)

**Interfaces:**
- Consumes: `getAdminKey`, `setAdminKey`, `clearAdminKey` (Task 3), `getAdminStats` (Task 3), `listWines`, `getWine`, `ApiError` (existing `app/services/api`), `WineEditPanel` (Task 4).
- Produces: nothing later depends on this (last task).

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/pages/AdminPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AdminPage } from "./AdminPage";
import * as adminApi from "../services/adminApi";
import * as api from "../services/api";
import { clearAdminKey, getAdminKey } from "../services/adminAuth";
import { ApiError } from "../services/api";
import type { AdminStats, WineListResponse } from "../types/wine";

vi.mock("../services/adminApi", async () => {
  const actual = await vi.importActual<typeof import("../services/adminApi")>("../services/adminApi");
  return { ...actual, getAdminStats: vi.fn() };
});
vi.mock("../services/api", async () => {
  const actual = await vi.importActual<typeof import("../services/api")>("../services/api");
  return { ...actual, listWines: vi.fn(), getWine: vi.fn() };
});

const getAdminStatsMock = adminApi.getAdminStats as unknown as ReturnType<typeof vi.fn>;
const listWinesMock = api.listWines as unknown as ReturnType<typeof vi.fn>;
const getWineMock = api.getWine as unknown as ReturnType<typeof vi.fn>;

const stats: AdminStats = {
  wines_count: 2,
  wineries_count: 1,
  retailers_count: 1,
  listings_count: 2,
  numeric: { vintage: { count: 2, null_count: 0, min: 2020, max: 2022, avg: 2021 } },
  categorical: { type: { red: 1, white: 1 } },
};

const winesResponse: WineListResponse = {
  total: 1,
  items: [
    {
      id: 1,
      name: "Caymus Cabernet Sauvignon",
      winery: "Caymus Vineyards",
      vintage: 2022,
      type: "red",
      country: "United States",
      region: "Napa Valley",
      grapes: [],
      price: 79.99,
      currency: "USD",
      price_usd_approx: 79.99,
      image_url: null,
      sweetness: 1,
      acidity: 3,
      tannin: 5,
      body: 5,
      fruitiness: 3,
    },
  ],
};

function renderAdmin() {
  render(
    <MemoryRouter>
      <AdminPage />
    </MemoryRouter>
  );
}

describe("AdminPage", () => {
  beforeEach(() => {
    getAdminStatsMock.mockReset();
    listWinesMock.mockReset();
    getWineMock.mockReset();
    clearAdminKey();
  });

  afterEach(() => {
    clearAdminKey();
  });

  it("shows a login form when not logged in", () => {
    renderAdmin();
    expect(screen.getByLabelText(/admin key/i)).toBeInTheDocument();
  });

  it("shows an error and does not log in on a wrong key", async () => {
    getAdminStatsMock.mockRejectedValue(new ApiError(401, "Invalid or missing admin key"));
    renderAdmin();

    await userEvent.type(screen.getByLabelText(/admin key/i), "wrong");
    await userEvent.click(screen.getByRole("button", { name: /log in/i }));

    expect(await screen.findByText(/invalid admin key/i)).toBeInTheDocument();
    expect(getAdminKey()).toBeNull();
  });

  it("logs in and shows the dashboard on a correct key", async () => {
    getAdminStatsMock.mockResolvedValue(stats);
    listWinesMock.mockResolvedValue(winesResponse);
    renderAdmin();

    await userEvent.type(screen.getByLabelText(/admin key/i), "right-key");
    await userEvent.click(screen.getByRole("button", { name: /log in/i }));

    await waitFor(() => expect(screen.getByText(/2 wines/i)).toBeInTheDocument());
    expect(screen.getByText("Caymus Cabernet Sauvignon")).toBeInTheDocument();
  });

  it("expands the edit panel when a wine row is clicked", async () => {
    getAdminStatsMock.mockResolvedValue(stats);
    listWinesMock.mockResolvedValue(winesResponse);
    getWineMock.mockResolvedValue({ ...winesResponse.items[0], subregion: null, abv: null, description: null, listings: [] });
    renderAdmin();

    await userEvent.type(screen.getByLabelText(/admin key/i), "right-key");
    await userEvent.click(screen.getByRole("button", { name: /log in/i }));
    await waitFor(() => expect(screen.getByText("Caymus Cabernet Sauvignon")).toBeInTheDocument());

    await userEvent.click(screen.getByText("Caymus Cabernet Sauvignon"));

    expect(await screen.findByText("Wine details")).toBeInTheDocument();
  });

  it("logs out and returns to the login form", async () => {
    getAdminStatsMock.mockResolvedValue(stats);
    listWinesMock.mockResolvedValue(winesResponse);
    renderAdmin();

    await userEvent.type(screen.getByLabelText(/admin key/i), "right-key");
    await userEvent.click(screen.getByRole("button", { name: /log in/i }));
    await waitFor(() => expect(screen.getByText(/2 wines/i)).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: /log out/i }));

    expect(screen.getByLabelText(/admin key/i)).toBeInTheDocument();
    expect(getAdminKey()).toBeNull();
  });
});
```

Create `frontend/src/components/layout/Header.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Header } from "./Header";

describe("Header", () => {
  it("renders an Admin link pointing to /admin", () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    );
    expect(screen.getByRole("link", { name: /admin/i })).toHaveAttribute("href", "/admin");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm run test -- --run AdminPage Header`
Expected: FAIL — `AdminPage` module doesn't exist; `Header` has no "Admin" link.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/pages/AdminPage.tsx`:

```tsx
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { AdminStats, WineDetail, WineListItem } from "../types/wine";
import { getAdminKey, setAdminKey, clearAdminKey } from "../services/adminAuth";
import { getAdminStats } from "../services/adminApi";
import { listWines, getWine, ApiError } from "../services/api";
import { WineEditPanel } from "../components/admin/WineEditPanel";
import { ErrorMessage } from "../components/common/ErrorMessage";

const PAGE_SIZE = 20;

export function AdminPage() {
  const [authed, setAuthed] = useState(() => getAdminKey() !== null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<WineListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [expandedWine, setExpandedWine] = useState<WineDetail | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    if (!authed) return;
    const id = ++requestId.current;
    setStatsError(null);
    getAdminStats()
      .then((data) => {
        if (id !== requestId.current) return;
        setStats(data);
      })
      .catch((err) => {
        if (id !== requestId.current) return;
        if (err instanceof ApiError && err.status === 401) {
          clearAdminKey();
          setAuthed(false);
          setLoginError("Session expired, please log in again");
        } else {
          setStatsError(err instanceof ApiError ? err.message : "Failed to load statistics");
        }
      });
  }, [authed]);

  useEffect(() => {
    if (!authed) return;
    const id = ++requestId.current;
    listWines({ q: query || undefined, limit: PAGE_SIZE, offset: 0 })
      .then((data) => {
        if (id !== requestId.current) return;
        setItems(data.items);
        setTotal(data.total);
      })
      .catch(() => {
        if (id !== requestId.current) return;
        setItems([]);
        setTotal(0);
      });
  }, [authed, query]);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoginError(null);
    setAdminKey(password);
    try {
      const data = await getAdminStats();
      setStats(data);
      setAuthed(true);
    } catch (err) {
      clearAdminKey();
      setLoginError(err instanceof ApiError && err.status === 401 ? "Invalid admin key" : "Failed to log in");
    }
  }

  function handleLogout() {
    clearAdminKey();
    setAuthed(false);
    setStats(null);
    setExpandedWine(null);
  }

  async function handleRowClick(wineId: number) {
    if (expandedWine?.id === wineId) {
      setExpandedWine(null);
      return;
    }
    const wine = await getWine(wineId);
    setExpandedWine(wine);
  }

  if (!authed) {
    return (
      <form onSubmit={handleLogin} className="max-w-sm flex flex-col gap-3">
        <h1 className="font-serif text-2xl text-ink">Admin Login</h1>
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Admin key
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-surface-raised border border-surface-border rounded px-2 py-1 text-ink"
          />
        </label>
        {loginError ? <p className="text-sm text-red-500">{loginError}</p> : null}
        <button type="submit" className="self-start bg-accent text-surface text-sm px-3 py-1 rounded">
          Log in
        </button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl text-ink">Admin</h1>
        <button type="button" onClick={handleLogout} className="text-sm text-accent">
          Log out
        </button>
      </div>

      <section>
        <h2 className="text-sm uppercase tracking-wide text-ink-muted mb-2">Statistics</h2>
        {statsError ? (
          <ErrorMessage message={statsError} />
        ) : stats ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink">
              {stats.wines_count} wines &middot; {stats.wineries_count} wineries &middot; {stats.retailers_count}{" "}
              retailers &middot; {stats.listings_count} listings
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(stats.numeric).map(([column, s]) => (
                <div key={column} className="border border-surface-border rounded p-2 text-sm">
                  <p className="text-ink-muted uppercase text-xs">{column}</p>
                  <p className="text-ink">
                    min {s.min ?? "—"} &middot; max {s.max ?? "—"} &middot; avg {s.avg ?? "—"}
                  </p>
                  <p className="text-ink-muted text-xs">{s.null_count} missing</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(stats.categorical).map(([column, counts]) => (
                <div key={column} className="border border-surface-border rounded p-2 text-sm">
                  <p className="text-ink-muted uppercase text-xs">{column}</p>
                  {Object.entries(counts).map(([value, count]) => (
                    <p key={value} className="text-ink">
                      {value}: {count}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section>
        <h2 className="text-sm uppercase tracking-wide text-ink-muted mb-2">Wines ({total})</h2>
        <input
          aria-label="Search wines"
          placeholder="Search by name or winery"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="bg-surface-raised border border-surface-border rounded px-2 py-1 text-ink mb-3 w-full max-w-sm"
        />
        <div className="flex flex-col gap-1">
          {items.map((item) => (
            <div key={item.id}>
              <button
                type="button"
                onClick={() => handleRowClick(item.id)}
                className="w-full text-left flex gap-3 items-center border-b border-surface-border py-2 text-sm text-ink hover:text-accent"
              >
                <span className="flex-1">{item.name}</span>
                <span className="text-ink-muted">{item.winery}</span>
                <span className="text-ink-muted">{item.vintage ?? "NV"}</span>
                <span className="text-ink-muted">{item.type}</span>
              </button>
              {expandedWine?.id === item.id ? (
                <WineEditPanel wine={expandedWine} onUpdated={setExpandedWine} />
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
```

In `frontend/src/components/layout/Header.tsx`, replace the full file contents:

```tsx
import { NavLink } from "react-router-dom";
import { ThemeSwitcher } from "./ThemeSwitcher";

const NAV_LINKS = [
  { to: "/explore", label: "Explore" },
  { to: "/discover", label: "Discover" },
  { to: "/pair", label: "Pair" },
  { to: "/compare", label: "Compare" },
  { to: "/learn", label: "Learn" },
];

export function Header() {
  return (
    <header className="border-b border-surface-border">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
        <NavLink to="/" className="font-serif text-lg tracking-wide text-ink">
          VinoScope
        </NavLink>
        <nav className="flex items-center gap-4 text-sm flex-wrap">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => (isActive ? "text-accent" : "text-ink-muted hover:text-ink")}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <ThemeSwitcher />
          <NavLink
            to="/admin"
            className={({ isActive }) => `text-sm ${isActive ? "text-accent" : "text-ink-muted hover:text-ink"}`}
          >
            Admin
          </NavLink>
        </div>
      </div>
    </header>
  );
}
```

In `frontend/src/App.tsx`, change:

```tsx
import { HomePage } from "./pages/HomePage";
import { ExplorePage } from "./pages/ExplorePage";
import { WineDetailPage } from "./pages/WineDetailPage";
import { DiscoverPage } from "./pages/DiscoverPage";
import { PairPage, ComparePage, LearnPage } from "./pages/StubPages";
```

to:

```tsx
import { HomePage } from "./pages/HomePage";
import { ExplorePage } from "./pages/ExplorePage";
import { WineDetailPage } from "./pages/WineDetailPage";
import { DiscoverPage } from "./pages/DiscoverPage";
import { AdminPage } from "./pages/AdminPage";
import { PairPage, ComparePage, LearnPage } from "./pages/StubPages";
```

and change:

```tsx
        <Route path="/discover" element={<DiscoverPage />} />
        <Route path="/pair" element={<PairPage />} />
```

to:

```tsx
        <Route path="/discover" element={<DiscoverPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/pair" element={<PairPage />} />
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm run test -- --run`
Expected: PASS — no regressions, including all new `AdminPage`/`Header` tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/AdminPage.tsx frontend/src/pages/AdminPage.test.tsx \
  frontend/src/components/layout/Header.tsx frontend/src/components/layout/Header.test.tsx frontend/src/App.tsx
git commit -m "feat: add /admin page with statistics dashboard and wine editor, plus header link"
```
