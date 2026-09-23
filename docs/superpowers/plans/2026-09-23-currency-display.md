# Multi-Currency Price Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show each wine's price in its real currency, with an approximate USD conversion alongside it when that currency isn't USD, and make price sort/filter/"cheapest listing" logic compare wines on their approximate USD-equivalent value instead of raw, currency-blind numbers.

**Architecture:** A small hand-maintained approximate-rate table (`backend/app/services/currency.py`) is the single source of truth for currency math, consumed both by a SQL window-function query that picks each wine's cheapest listing by USD-equivalent value (`backend/app/services/wines.py`) and by a per-listing Python conversion for the wine detail page. The frontend mirrors the new `currency`/`price_usd_approx` fields and renders them with a currency-aware `formatPrice` plus a new "≈ $X USD" line.

**Tech Stack:** Python/SQLAlchemy 2.0/Postgres (backend), TypeScript/React/Vitest (frontend) — no new dependencies.

## Global Constraints

- Rate table (`backend/app/services/currency.py`, approximate, hand-maintained, no live FX):
  `USD: 1.0, EUR: 1.08, GBP: 1.27, CAD: 0.74, AUD: 0.66, CHF: 1.13, JPY: 0.0067, ZAR: 0.055, HUF: 0.0028, NZD: 0.61`.
- A blank/`None`/unrecognized currency always uses rate `1.0` (treated as already-USD) — this is not an error case.
- Currency matching/lookup is case-insensitive on the way in (`rate_for`), but values stored and returned are always uppercase ISO-style codes.
- The frontend only shows the "≈ $X USD" conversion line when the currency is a *recognized* non-USD code (present in `CURRENCY_SYMBOLS`) — not merely "not USD". An unrecognized code shows its raw price with a `"<CODE> "` prefix and no conversion line, since we have no real rate for it.
- No endpoint to create/update/delete wines or listings — read-only, display-only feature. (A separate future feature will add write endpoints.)
- No live/real-time exchange rates. No per-user currency preference — the approximation target is always USD.
- Stored prices are never modified — conversion is query-time/display-time only.

Reference spec: `docs/superpowers/specs/2026-09-23-currency-display-design.md`

---

### Task 1: Backend currency rate module

**Files:**
- Create: `backend/app/services/currency.py`
- Create: `tests/services/__init__.py` (empty file, matches the `__init__.py` convention already used by `tests/api/`, `tests/models/`, `tests/scripts/`, `tests/database/`)
- Test: `tests/services/test_currency.py`

**Interfaces:**
- Consumes: nothing (no dependencies on other tasks).
- Produces: `CURRENCY_RATES: dict[str, float]`, `rate_for(currency: str | None) -> float`, `approx_usd(price: float | None, currency: str | None) -> float | None`. Task 3 imports `CURRENCY_RATES` and `approx_usd` from this module.

- [ ] **Step 1: Write the failing tests**

Create `tests/services/__init__.py` (empty).

Create `tests/services/test_currency.py`:

```python
from app.services.currency import CURRENCY_RATES, approx_usd, rate_for


def test_rate_for_known_currency_returns_table_value():
    assert rate_for("EUR") == CURRENCY_RATES["EUR"]


def test_rate_for_is_case_insensitive():
    assert rate_for("eur") == CURRENCY_RATES["EUR"]


def test_rate_for_unknown_currency_returns_one():
    assert rate_for("XYZ") == 1.0


def test_rate_for_none_returns_one():
    assert rate_for(None) == 1.0


def test_approx_usd_converts_using_rate():
    assert approx_usd(50.0, "EUR") == round(50.0 * CURRENCY_RATES["EUR"], 2)


def test_approx_usd_unknown_currency_returns_price_unchanged():
    assert approx_usd(50.0, "XYZ") == 50.0


def test_approx_usd_none_currency_returns_price_unchanged():
    assert approx_usd(50.0, None) == 50.0


def test_approx_usd_none_price_returns_none():
    assert approx_usd(None, "EUR") is None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/services/test_currency.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.currency'`

- [ ] **Step 3: Write minimal implementation**

Create `backend/app/services/currency.py`:

```python
# Approximate USD value per 1 unit of the given currency.
# Hand-maintained, not live — refresh occasionally by hand.
CURRENCY_RATES: dict[str, float] = {
    "USD": 1.0,
    "EUR": 1.08,
    "GBP": 1.27,
    "CAD": 0.74,
    "AUD": 0.66,
    "CHF": 1.13,
    "JPY": 0.0067,
    "ZAR": 0.055,
    "HUF": 0.0028,
    "NZD": 0.61,
}


def rate_for(currency: str | None) -> float:
    """Approximate USD rate for a currency code. Unknown/blank -> 1.0 (treated as already-USD)."""
    if currency is None:
        return 1.0
    return CURRENCY_RATES.get(currency.upper(), 1.0)


def approx_usd(price: float | None, currency: str | None) -> float | None:
    """Approximate USD value of a price, rounded to 2dp. None price in, None out."""
    if price is None:
        return None
    return round(price * rate_for(currency), 2)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/services/test_currency.py -v`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/currency.py tests/services/__init__.py tests/services/test_currency.py
git commit -m "feat: add approximate USD currency rate table"
```

---

### Task 2: Currency normalization in the data pipeline

**Files:**
- Modify: `scripts/normalize_wines.py:9-14` (add `CURRENCY_ALIASES` next to `COUNTRY_ALIASES`), `:45-49` area (add `normalize_currency` next to `normalize_country`), `:77` (`normalize_row`'s `"currency"` entry)
- Test: `tests/scripts/test_normalize_wines.py`

**Interfaces:**
- Consumes: nothing (independent of Task 1 and Task 3 — this is the offline CSV-cleaning script, a separate codepath from the backend service).
- Produces: `normalize_currency(currency: str | None) -> str | None`. Nothing later depends on this function directly, but `normalize_row`'s output `"currency"` field is now normalized (aliased + uppercased) rather than merely trimmed.

- [ ] **Step 1: Write the failing tests**

Add to `tests/scripts/test_normalize_wines.py`, directly after `test_normalize_country_title_cases_unknown_values` (after line 49):

```python
def test_normalize_currency_maps_known_aliases():
    assert normalize_currency("EURO") == "EUR"
    assert normalize_currency("euro") == "EUR"
    assert normalize_currency("Euros") == "EUR"


def test_normalize_currency_uppercases_unknown_codes():
    assert normalize_currency("usd") == "USD"
    assert normalize_currency("zar") == "ZAR"


def test_normalize_currency_allows_blank():
    assert normalize_currency("") is None
    assert normalize_currency(None) is None
```

Add `normalize_currency` to the existing import block at the top of the file (currently `from scripts.normalize_wines import (clean_text, normalize_country, normalize_csv, normalize_row, split_grape_blend, strip_bottle_size, validate_vintage)`) — insert it alphabetically:

```python
from scripts.normalize_wines import (
    clean_text,
    normalize_country,
    normalize_currency,
    normalize_csv,
    normalize_row,
    split_grape_blend,
    strip_bottle_size,
    validate_vintage,
)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/scripts/test_normalize_wines.py -v`
Expected: FAIL — `ImportError: cannot import name 'normalize_currency' from 'scripts.normalize_wines'`

- [ ] **Step 3: Write minimal implementation**

In `scripts/normalize_wines.py`, add after the existing `COUNTRY_ALIASES` dict (after line 14):

```python
CURRENCY_ALIASES = {
    "euro": "EUR",
    "euros": "EUR",
    "dollar": "USD",
    "dollars": "USD",
}
```

Add after `normalize_country` (after its closing line, ~line 49):

```python
def normalize_currency(currency):
    cleaned = clean_text(currency)
    if cleaned is None:
        return None
    return CURRENCY_ALIASES.get(cleaned.lower(), cleaned.upper())
```

In `normalize_row`, replace:

```python
        "currency": clean_text(row.get("currency")),
```

with:

```python
        "currency": normalize_currency(row.get("currency")),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/scripts/test_normalize_wines.py -v`
Expected: PASS — all tests in the file pass, including the 3 new ones.

- [ ] **Step 5: Commit**

```bash
git add scripts/normalize_wines.py tests/scripts/test_normalize_wines.py
git commit -m "feat: normalize currency codes and aliases during CSV cleaning"
```

---

### Task 3: Backend — cheapest listing by USD-equivalent value

**Files:**
- Modify: `backend/app/services/wines.py:1-19` (imports, `_min_price_subquery` → `_cheapest_listing_subquery`), `:53-70` (`_row_to_dict`), `:73-132` (`list_wines`), `:135-170` (`get_wine`)
- Modify: `backend/app/schemas/wine.py` (`WineListItem`, `RetailerListingOut`)
- Test: `tests/api/test_wines.py`

**Interfaces:**
- Consumes: `CURRENCY_RATES: dict[str, float]` and `approx_usd(price: float | None, currency: str | None) -> float | None` from `app.services.currency` (Task 1).
- Produces: `WineListItem`/`WineDetail` JSON now includes `currency: str | None` and `price_usd_approx: float | None` alongside `price`. `RetailerListingOut` (each entry in `WineDetail.listings`) includes the same `price_usd_approx: float | None` alongside its existing `price`/`currency`. Task 4 (frontend) mirrors these exact field names and types.

- [ ] **Step 1: Write the failing tests**

Add to `tests/api/test_wines.py`, directly after the `wine_with_all_null_percentage_grapes` fixture (after line 64):

```python
@pytest.fixture
def mixed_currency_wines(db_session):
    winery = Winery(name="Global Cellars", country="France", region="Bordeaux")
    db_session.add(winery)
    db_session.flush()

    grape = Grape(name="Merlot")
    db_session.add(grape)
    db_session.flush()

    retailer = Retailer(name="Euro Wines")
    db_session.add(retailer)
    db_session.flush()

    # Raw price 50.00 EUR ~= $54.00 USD (rate 1.08) -- pricier in USD terms.
    wine_eur = Wine(winery=winery, name="Bordeaux Blend EUR", vintage=2020, type="red", country="France")
    wine_eur.grapes.append(WineGrape(grape=grape, percentage=100))
    wine_eur.listings.append(RetailerListing(retailer=retailer, price=50.00, currency="EUR"))

    # Raw price 52.00 USD -- cheaper in USD terms than the EUR wine above, despite the higher raw number.
    wine_usd = Wine(winery=winery, name="Bordeaux Blend USD", vintage=2020, type="red", country="France")
    wine_usd.grapes.append(WineGrape(grape=grape, percentage=100))
    wine_usd.listings.append(RetailerListing(retailer=retailer, price=52.00, currency="USD"))

    db_session.add_all([wine_eur, wine_usd])
    db_session.commit()

    return {"wine_eur": wine_eur.id, "wine_usd": wine_usd.id}


def test_list_wines_item_includes_currency_and_price_usd_approx(client, mixed_currency_wines):
    response = client.get("/api/wines", params={"q": "Bordeaux Blend EUR"})
    body = response.json()
    item = body["items"][0]
    assert item["price"] == 50.00
    assert item["currency"] == "EUR"
    assert item["price_usd_approx"] == 54.00


def test_list_wines_sort_price_asc_uses_usd_equivalent_not_raw_number(client, mixed_currency_wines):
    response = client.get("/api/wines", params={"sort": "price_asc"})
    body = response.json()
    ids = [item["id"] for item in body["items"]]
    assert ids == [mixed_currency_wines["wine_usd"], mixed_currency_wines["wine_eur"]]


def test_list_wines_price_filter_uses_usd_equivalent_not_raw_number(client, mixed_currency_wines):
    response = client.get("/api/wines", params={"min_price": 53})
    body = response.json()
    ids = {item["id"] for item in body["items"]}
    assert ids == {mixed_currency_wines["wine_eur"]}


def test_get_wine_detail_listing_includes_price_usd_approx(client, mixed_currency_wines):
    response = client.get(f"/api/wines/{mixed_currency_wines['wine_eur']}")
    body = response.json()
    assert body["listings"][0]["price_usd_approx"] == 54.00
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/api/test_wines.py -v -k "mixed_currency or price_usd_approx or uses_usd_equivalent"`
Expected: FAIL — `KeyError: 'currency'` / `KeyError: 'price_usd_approx'` (fields don't exist yet), and the sort/filter tests fail because they currently compare raw numbers.

- [ ] **Step 3: Write minimal implementation**

In `backend/app/schemas/wine.py`, update `WineListItem` (add two fields after `price`):

```python
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
    currency: Optional[str] = None
    price_usd_approx: Optional[float] = None
    image_url: Optional[str] = None
    sweetness: Optional[int] = None
    acidity: Optional[int] = None
    tannin: Optional[int] = None
    body: Optional[int] = None
    fruitiness: Optional[int] = None
```

Update `RetailerListingOut` (add `price_usd_approx` after `currency`):

```python
class RetailerListingOut(BaseModel):
    retailer: str
    price: Optional[float] = None
    currency: Optional[str] = None
    price_usd_approx: Optional[float] = None
    product_url: Optional[str] = None
    availability: Optional[str] = None
```

In `backend/app/services/wines.py`, change the import line (currently `from sqlalchemy import func, or_, select`) to:

```python
from sqlalchemy import case, func, or_, select

from app.services.currency import CURRENCY_RATES, approx_usd
```

Replace `_min_price_subquery` with:

```python
def _rate_case():
    return case(
        {code: rate for code, rate in CURRENCY_RATES.items()},
        value=RetailerListing.currency,
        else_=1.0,
    )


def _cheapest_listing_subquery():
    usd_price = (RetailerListing.price * _rate_case()).label("usd_price")
    ranked = (
        select(
            RetailerListing.wine_id.label("wine_id"),
            RetailerListing.price.label("price"),
            RetailerListing.currency.label("currency"),
            usd_price,
            func.row_number()
            .over(partition_by=RetailerListing.wine_id, order_by=usd_price.asc())
            .label("rn"),
        )
        .where(RetailerListing.price.isnot(None))
        .subquery()
    )
    return select(ranked).where(ranked.c.rn == 1).subquery()
```

Replace `_row_to_dict`:

```python
def _row_to_dict(
    wine: Wine, winery_name: str, price: Optional[float], currency: Optional[str], grapes: list[dict]
) -> dict:
    return {
        "id": wine.id,
        "name": wine.name,
        "winery": winery_name,
        "vintage": wine.vintage,
        "type": wine.type,
        "country": wine.country,
        "region": wine.region,
        "grapes": grapes,
        "price": price,
        "currency": currency,
        "price_usd_approx": approx_usd(price, currency),
        "image_url": wine.image_url,
        "sweetness": wine.sweetness,
        "acidity": wine.acidity,
        "tannin": wine.tannin,
        "body": wine.body,
        "fruitiness": wine.fruitiness,
    }
```

In `list_wines`, replace the entire function body (from `price_sq = _min_price_subquery()` through the final `return total, items`) with:

```python
    price_sq = _cheapest_listing_subquery()

    stmt = (
        select(Wine, Winery.name.label("winery_name"), price_sq.c.price, price_sq.c.currency)
        .join(Winery, Wine.winery_id == Winery.id)
        .outerjoin(price_sq, price_sq.c.wine_id == Wine.id)
    )

    if type is not None:
        stmt = stmt.where(func.lower(Wine.type) == type.lower())
    if country is not None:
        stmt = stmt.where(func.lower(Wine.country) == country.lower())
    if grape is not None:
        stmt = stmt.where(
            Wine.id.in_(
                select(WineGrape.wine_id)
                .join(Grape, Grape.id == WineGrape.grape_id)
                .where(Grape.name.ilike(f"%{_escape_like(grape)}%", escape="\\"))
            )
        )
    if q is not None:
        pattern = f"%{_escape_like(q)}%"
        stmt = stmt.where(or_(Wine.name.ilike(pattern, escape="\\"), Winery.name.ilike(pattern, escape="\\")))
    if min_price is not None:
        stmt = stmt.where(price_sq.c.usd_price >= min_price)
    if max_price is not None:
        stmt = stmt.where(price_sq.c.usd_price <= max_price)

    total = db.scalar(select(func.count()).select_from(stmt.subquery()))

    if sort == "price_asc":
        stmt = stmt.order_by(price_sq.c.usd_price.asc().nulls_last(), Wine.id)
    elif sort == "price_desc":
        stmt = stmt.order_by(price_sq.c.usd_price.desc().nulls_last(), Wine.id)
    elif sort == "vintage":
        stmt = stmt.order_by(Wine.vintage.asc().nulls_last(), Wine.id)
    else:
        stmt = stmt.order_by(Winery.name.asc(), Wine.id)

    rows = db.execute(stmt.offset(offset).limit(limit)).all()
    wine_ids = [wine.id for wine, _, _, _ in rows]
    grapes_by_wine = _grapes_for_wines(db, wine_ids)
    items = [
        _row_to_dict(wine, winery_name, price, currency, grapes_by_wine.get(wine.id, []))
        for wine, winery_name, price, currency in rows
    ]
    return total, items
```

In `get_wine`, replace the query and row unpacking at the top (from the function signature through `wine, winery_name, price, currency = row`):

```python
def get_wine(db: Session, wine_id: int) -> Optional[dict]:
    price_sq = _cheapest_listing_subquery()
    stmt = (
        select(Wine, Winery.name.label("winery_name"), price_sq.c.price, price_sq.c.currency)
        .join(Winery, Wine.winery_id == Winery.id)
        .outerjoin(price_sq, price_sq.c.wine_id == Wine.id)
        .where(Wine.id == wine_id)
    )
    row = db.execute(stmt).one_or_none()
    if row is None:
        return None
    wine, winery_name, price, currency = row
```

(The rest of `get_wine` — the `listing_stmt`/`listing_rows` fetch and the `grapes = ...` line — is unchanged.) Replace the `data = _row_to_dict(...)` call and the `listings` list-comprehension at the bottom:

```python
    data = _row_to_dict(wine, winery_name, price, currency, grapes)
    data["subregion"] = wine.subregion
    data["abv"] = wine.abv
    data["description"] = wine.description
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/api/test_wines.py -v`
Expected: PASS — all tests in the file pass (the existing ones unchanged, since a wine with only-USD listings gets `price_usd_approx == price`; the 4 new ones pass with the corrected USD-equivalent logic).

- [ ] **Step 5: Run the full backend test suite to confirm no regressions**

Run: `pytest -v`
Expected: PASS — no regressions in `tests/scripts`, `tests/models`, `tests/database`, `tests/api`.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/wines.py backend/app/schemas/wine.py tests/api/test_wines.py
git commit -m "feat: pick cheapest listing by USD-equivalent price and expose currency fields"
```

---

### Task 4: Frontend currency display

**Files:**
- Modify: `frontend/src/types/wine.ts` (`WineListItem`, `RetailerListing`)
- Modify: `frontend/src/utils/format.ts` (`formatPrice` signature, add `formatApproxUsd`, `hasApproxUsdConversion`, `CURRENCY_SYMBOLS`)
- Modify: `frontend/src/components/wine/WineCard.tsx`
- Modify: `frontend/src/components/wine/RetailerListingRow.tsx`
- Modify (fixture-only, to keep the type change compiling): `frontend/src/components/wine/WineCard.test.tsx`, `frontend/src/components/wine/WineGrid.test.tsx`, `frontend/src/pages/ExplorePage.test.tsx`, `frontend/src/pages/DiscoverPage.test.tsx`, `frontend/src/pages/WineDetailPage.test.tsx`, `frontend/src/components/wine/RetailerListingRow.test.tsx`
- Test: `frontend/src/utils/format.test.ts` (new), plus new cases in `WineCard.test.tsx` and `RetailerListingRow.test.tsx`

**Interfaces:**
- Consumes: the backend's `WineListItem`/`RetailerListingOut` shape from Task 3 — `currency: string | null` and `price_usd_approx: number | null` alongside `price`.
- Produces: `formatPrice(price: number | null, currency: string | null): string`, `formatApproxUsd(priceUsdApprox: number | null): string`, `hasApproxUsdConversion(currency: string | null, priceUsdApprox: number | null): boolean` — used by `WineCard` and `RetailerListingRow`. Nothing later depends on these (this is the last task).

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/utils/format.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { formatPrice, formatApproxUsd, hasApproxUsdConversion, formatVintage, primaryGrapeLabel } from "./format";

describe("formatPrice", () => {
  it("formats USD with a dollar sign", () => {
    expect(formatPrice(79.99, "USD")).toBe("$79.99");
  });

  it("formats EUR with a euro sign", () => {
    expect(formatPrice(45, "EUR")).toBe("€45.00");
  });

  it("formats GBP with a pound sign", () => {
    expect(formatPrice(30, "GBP")).toBe("£30.00");
  });

  it("falls back to a code prefix for an unrecognized currency", () => {
    expect(formatPrice(100, "XYZ")).toBe("XYZ 100.00");
  });

  it("defaults to a dollar sign when currency is null", () => {
    expect(formatPrice(20, null)).toBe("$20.00");
  });

  it("returns 'Price unavailable' when price is null", () => {
    expect(formatPrice(null, "USD")).toBe("Price unavailable");
  });
});

describe("formatApproxUsd", () => {
  it("formats an approximate USD value", () => {
    expect(formatApproxUsd(48.6)).toBe("≈ $48.60 USD");
  });

  it("returns an empty string when null", () => {
    expect(formatApproxUsd(null)).toBe("");
  });
});

describe("hasApproxUsdConversion", () => {
  it("is true for a recognized non-USD currency with a value", () => {
    expect(hasApproxUsdConversion("EUR", 48.6)).toBe(true);
  });

  it("is false for USD", () => {
    expect(hasApproxUsdConversion("USD", 50)).toBe(false);
  });

  it("is false for an unrecognized currency", () => {
    expect(hasApproxUsdConversion("XYZ", 50)).toBe(false);
  });

  it("is false when currency is null", () => {
    expect(hasApproxUsdConversion(null, 50)).toBe(false);
  });

  it("is false when price_usd_approx is null", () => {
    expect(hasApproxUsdConversion("EUR", null)).toBe(false);
  });
});

describe("formatVintage", () => {
  it("returns NV for null", () => {
    expect(formatVintage(null)).toBe("NV");
  });

  it("returns the year as a string", () => {
    expect(formatVintage(2022)).toBe("2022");
  });
});

describe("primaryGrapeLabel", () => {
  it("returns 'Blend unknown' for no grapes", () => {
    expect(primaryGrapeLabel([])).toBe("Blend unknown");
  });

  it("returns the single grape's name", () => {
    expect(primaryGrapeLabel([{ name: "Chardonnay", percentage: null }])).toBe("Chardonnay");
  });

  it("returns 'Blend' for multiple grapes", () => {
    expect(
      primaryGrapeLabel([
        { name: "Cabernet Sauvignon", percentage: 60 },
        { name: "Merlot", percentage: 40 },
      ])
    ).toBe("Blend");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm run test -- format.test.ts`
Expected: FAIL — `formatPrice`/`formatApproxUsd`/`hasApproxUsdConversion` type errors (wrong arity) / not exported.

- [ ] **Step 3: Update types**

In `frontend/src/types/wine.ts`, replace `WineListItem`:

```typescript
export interface WineListItem {
  id: number;
  name: string;
  winery: string;
  vintage: number | null;
  type: string;
  country: string | null;
  region: string | null;
  grapes: Grape[];
  price: number | null;
  currency: string | null;
  price_usd_approx: number | null;
  image_url: string | null;
  sweetness: number | null;
  acidity: number | null;
  tannin: number | null;
  body: number | null;
  fruitiness: number | null;
}
```

Replace `RetailerListing`:

```typescript
export interface RetailerListing {
  retailer: string;
  price: number | null;
  currency: string | null;
  price_usd_approx: number | null;
  product_url: string | null;
  availability: string | null;
}
```

- [ ] **Step 4: Write the implementation**

Replace the full contents of `frontend/src/utils/format.ts`:

```typescript
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CAD: "CA$",
  AUD: "A$",
  CHF: "CHF ",
  JPY: "¥",
  ZAR: "R",
  HUF: "Ft ",
};

export function formatPrice(price: number | null, currency: string | null): string {
  if (price === null) return "Price unavailable";
  const symbol = currency ? CURRENCY_SYMBOLS[currency] : undefined;
  if (symbol !== undefined) return `${symbol}${price.toFixed(2)}`;
  if (currency) return `${currency} ${price.toFixed(2)}`;
  return `$${price.toFixed(2)}`;
}

export function formatApproxUsd(priceUsdApprox: number | null): string {
  return priceUsdApprox === null ? "" : `≈ $${priceUsdApprox.toFixed(2)} USD`;
}

export function hasApproxUsdConversion(currency: string | null, priceUsdApprox: number | null): boolean {
  return currency !== null && currency !== "USD" && currency in CURRENCY_SYMBOLS && priceUsdApprox !== null;
}

export function formatVintage(vintage: number | null): string {
  return vintage === null ? "NV" : String(vintage);
}

export function primaryGrapeLabel(grapes: { name: string; percentage: number | null }[]): string {
  if (grapes.length === 0) return "Blend unknown";
  if (grapes.length === 1) return grapes[0].name;
  return "Blend";
}
```

- [ ] **Step 5: Run format tests to verify they pass**

Run: `cd frontend && npm run test -- format.test.ts`
Expected: PASS (17 tests)

- [ ] **Step 6: Update `WineCard` and `RetailerListingRow`, and their fixtures**

In `frontend/src/components/wine/WineCard.tsx`, change the import line:

```typescript
import { formatPrice, formatVintage, primaryGrapeLabel, formatApproxUsd, hasApproxUsdConversion } from "../../utils/format";
```

Replace the price paragraph:

```tsx
<p className="text-sm font-semibold text-ink mt-1">{formatPrice(wine.price, wine.currency)}</p>
{hasApproxUsdConversion(wine.currency, wine.price_usd_approx) ? (
  <p className="text-xs text-ink-muted">{formatApproxUsd(wine.price_usd_approx)}</p>
) : null}
```

Replace the full contents of `frontend/src/components/wine/RetailerListingRow.tsx`:

```tsx
import type { RetailerListing } from "../../types/wine";
import { formatPrice, formatApproxUsd, hasApproxUsdConversion } from "../../utils/format";

export function RetailerListingRow({ listing }: { listing: RetailerListing }) {
  return (
    <div className="flex items-center justify-between border-b border-surface-border py-2 last:border-b-0">
      <div>
        <p className="text-sm text-ink">{listing.retailer}</p>
        <p className="text-xs text-ink-muted">{formatPrice(listing.price, listing.currency)}</p>
        {hasApproxUsdConversion(listing.currency, listing.price_usd_approx) ? (
          <p className="text-xs text-ink-muted">{formatApproxUsd(listing.price_usd_approx)}</p>
        ) : null}
      </div>
      {listing.product_url ? (
        <a
          href={listing.product_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-accent hover:underline"
        >
          View Retailer
        </a>
      ) : null}
    </div>
  );
}
```

Now fix every fixture that constructs a full `WineListItem`/`RetailerListing` literal, so the type change compiles:

In `frontend/src/components/wine/WineCard.test.tsx`, in `baseWine`, add two fields right after `price: 79.99,`:

```typescript
  price: 79.99,
  currency: null,
  price_usd_approx: null,
```

In `frontend/src/components/wine/WineGrid.test.tsx`, in the `wine()` factory, add the same two fields right after `price: 20,`.

In `frontend/src/pages/ExplorePage.test.tsx`, in the `makeWine()` factory, add the same two fields right after `price: 20,`.

In `frontend/src/pages/DiscoverPage.test.tsx`, in the `makeItem()` factory, add the same two fields right after `price: 20,`.

In `frontend/src/pages/WineDetailPage.test.tsx`, in `fullWine`, add the same two fields right after the top-level `price: 79.99,` (line 28), and add `price_usd_approx: 79.99,` right after the `currency: "USD",` line inside its `listings[0]` object (after line 39).

In `frontend/src/components/wine/RetailerListingRow.test.tsx`, add `price_usd_approx: 79.99,` right after `currency: "USD",` in the first listing literal (after line 12), and add `price_usd_approx: 50,` right after `currency: "USD",` in the second listing literal (after line 29).

- [ ] **Step 7: Add new behavior tests for the approx-USD line**

Add to `frontend/src/components/wine/WineCard.test.tsx`, inside the `describe("WineCard", ...)` block:

```typescript
  it("shows an approx-USD conversion line for a non-USD priced wine", () => {
    renderCard({ ...baseWine, price: 50, currency: "EUR", price_usd_approx: 54.0 });
    expect(screen.getByText("€50.00")).toBeInTheDocument();
    expect(screen.getByText("≈ $54.00 USD")).toBeInTheDocument();
  });

  it("does not show a conversion line for a USD priced wine", () => {
    renderCard(baseWine);
    expect(screen.queryByText(/≈/)).not.toBeInTheDocument();
  });
```

Add to `frontend/src/components/wine/RetailerListingRow.test.tsx`, inside the `describe("RetailerListingRow", ...)` block:

```typescript
  it("shows an approx-USD conversion line for a non-USD listing", () => {
    render(
      <RetailerListingRow
        listing={{
          retailer: "Euro Wines",
          price: 50,
          currency: "EUR",
          price_usd_approx: 54.0,
          product_url: null,
          availability: null,
        }}
      />
    );
    expect(screen.getByText("€50.00")).toBeInTheDocument();
    expect(screen.getByText("≈ $54.00 USD")).toBeInTheDocument();
  });

  it("does not show a conversion line for a USD listing", () => {
    render(
      <RetailerListingRow
        listing={{
          retailer: "Total Wine",
          price: 79.99,
          currency: "USD",
          price_usd_approx: 79.99,
          product_url: null,
          availability: null,
        }}
      />
    );
    expect(screen.queryByText(/≈/)).not.toBeInTheDocument();
  });
```

- [ ] **Step 8: Run the full frontend test suite to verify everything passes**

Run: `cd frontend && npm run test`
Expected: PASS — no regressions, including the 4 new behavior tests.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/types/wine.ts frontend/src/utils/format.ts frontend/src/utils/format.test.ts \
  frontend/src/components/wine/WineCard.tsx frontend/src/components/wine/WineCard.test.tsx \
  frontend/src/components/wine/RetailerListingRow.tsx frontend/src/components/wine/RetailerListingRow.test.tsx \
  frontend/src/components/wine/WineGrid.test.tsx frontend/src/pages/ExplorePage.test.tsx \
  frontend/src/pages/DiscoverPage.test.tsx frontend/src/pages/WineDetailPage.test.tsx
git commit -m "feat: display currency-aware prices with approximate USD conversion"
```
