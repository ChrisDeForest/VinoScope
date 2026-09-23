# Multi-Currency Price Display — Design

## Problem

Wine pricing lives on `RetailerListing.price` + `RetailerListing.currency`.
`currency` has always been a free-text column, but nothing in the app has
ever used it:

- `formatPrice()` (`frontend/src/utils/format.ts`) hardcodes a `$` prefix
  regardless of the actual currency.
- The list/grid view's `WineListItem.price` (`backend/app/services/wines.py`,
  `_min_price_subquery`) is a bare `float` — the raw minimum price across a
  wine's listings, with no currency attached at all.
- That raw minimum also drives `price_asc`/`price_desc` sort and the
  `min_price`/`max_price` filters on the Explore page.

The project's raw CSV data already contains real, mixed currencies —
`USD`, `EUR`, `ZAR`, `HUF`, `CAD`, and a nonstandard `"EURO"` value in one
file — so comparing/sorting raw numbers across listings is already wrong
today (e.g. a $50 wine would rank "cheaper" than a €45 wine, even though
€45 ≈ $49).

## Decision

1. Add a small, hand-maintained **static approximate USD rate table** in
   the backend. No live FX API — rates are explicitly approximate and
   updated by hand occasionally, which matches the "approximate
   translation" the feature asks for and keeps this dependency-free for a
   class project.
2. Fix currency handling **properly**, not just for display: the list
   view's "cheapest listing per wine" is selected by its approximate
   USD-equivalent value, and price sort/filter operate on that same
   USD-equivalent basis. This avoids silently-wrong cross-currency
   comparisons rather than papering over them with display-only formatting.
3. Normalize known currency aliases (`"EURO"` → `"EUR"`) during CSV
   cleaning, mirroring the existing `COUNTRY_ALIASES` pattern in
   `normalize_wines.py`.

This spec covers currency **display and price consistency only** — it does
not add any way to edit prices after import (that's a separate, later
feature: an "update wine/listing" write API).

## Rate Table & Currency Normalization

### `backend/app/services/currency.py` (new file)

```python
CURRENCY_RATES: dict[str, float] = {
    # Approximate USD value per 1 unit of the given currency.
    # Hand-maintained, not live — refresh occasionally by hand.
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
    """Approximate USD value of a price, rounded to 2dp. None in, None out."""
    if price is None:
        return None
    return round(price * rate_for(currency), 2)
```

This is the single source of truth for rates: both the SQL-side ranking
(section below) and the per-listing Python conversion use it.

### `scripts/normalize_wines.py`

Add, alongside the existing `COUNTRY_ALIASES`:

```python
CURRENCY_ALIASES = {
    "euro": "EUR",
    "euros": "EUR",
    "dollar": "USD",
    "dollars": "USD",
}


def normalize_currency(currency):
    cleaned = clean_text(currency)
    if cleaned is None:
        return None
    return CURRENCY_ALIASES.get(cleaned.lower(), cleaned.upper())
```

`normalize_row` calls `normalize_currency(row.get("currency"))` instead of
the current bare `clean_text(row.get("currency"))`.

## Backend: Cheapest-Listing-by-USD-Equivalent Query

`_min_price_subquery()` in `backend/app/services/wines.py` is replaced by
`_cheapest_listing_subquery()`:

```python
from sqlalchemy import case, func, select
from app.services.currency import CURRENCY_RATES

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

This returns, per wine, the single listing with the lowest approximate
USD-equivalent price: its own `price`, `currency`, and computed
`usd_price`.

**`list_wines`:**
- Joins on `_cheapest_listing_subquery()` instead of `_min_price_subquery()`.
- `min_price`/`max_price` filters compare against `price_sq.c.usd_price`
  instead of the raw `price` column.
- `price_asc`/`price_desc` sort orders by `price_sq.c.usd_price`.
- `_row_to_dict` adds `currency` (from `price_sq.c.currency`) and
  `price_usd_approx` (the fetched `usd_price` value, rounded to 2dp in
  Python — simpler than a SQL-side `func.round` and sufficient at this data
  scale) to the returned dict, alongside the existing `price` (now the
  cheapest listing's own, un-converted price).

**`get_wine`:**
- Same subquery swap for the top-level `price`/`currency`/`price_usd_approx`
  (keeps the detail page's headline price consistent with the list view).
- The existing per-listing `listings` loop (already fetching every
  `RetailerListing` row for the wine) adds `"price_usd_approx":
  approx_usd(listing.price, listing.currency)` per listing, using the
  Python helper directly — no new query needed there.

### Schema changes

`backend/app/schemas/wine.py`:

```python
class WineListItem(BaseModel):
    ...
    price: Optional[float] = None
    currency: Optional[str] = None
    price_usd_approx: Optional[float] = None
    ...

class RetailerListingOut(BaseModel):
    retailer: str
    price: Optional[float] = None
    currency: Optional[str] = None
    price_usd_approx: Optional[float] = None
    product_url: Optional[str] = None
    availability: Optional[str] = None
```

`WineDetail` inherits `currency`/`price_usd_approx` from `WineListItem` for
its headline price; `RetailerListingOut` carries the same pair per listing.

### `frontend/src/types/wine.ts`

`WineListItem` and `RetailerListing` gain `currency: string | null` and
`price_usd_approx: number | null`, mirroring the backend schema changes.

## Frontend Display

### `frontend/src/utils/format.ts`

```typescript
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", CAD: "CA$", AUD: "A$",
  CHF: "CHF ", JPY: "¥", ZAR: "R", HUF: "Ft ",
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
```

Every existing call site of `formatPrice` (`WineCard.tsx`,
`WineDetailPage.tsx`) is updated to pass `wine.currency` /
`listing.currency` as the second argument. `hasApproxUsdConversion` decides
whether to render the "≈ $X USD" line at all: only for a currency this
build has a real rate for (i.e. it's `CURRENCY_SYMBOLS`, not just
"not USD") — see Error Handling / Edge Cases below for why a bare
`currency !== "USD"` check isn't enough.

### `WineCard` (`frontend/src/components/wine/WineCard.tsx`)

Below the existing price line, render the approx-USD line only when the
currency is a recognized non-USD code with a real conversion:

```tsx
<p className="text-sm font-semibold text-ink mt-1">{formatPrice(wine.price, wine.currency)}</p>
{hasApproxUsdConversion(wine.currency, wine.price_usd_approx) ? (
  <p className="text-xs text-ink-muted">{formatApproxUsd(wine.price_usd_approx)}</p>
) : null}
```

### `WineDetailPage` (`frontend/src/pages/WineDetailPage.tsx`)

Same pattern for the headline price. The per-retailer listing rows
(`RetailerListingRow`, if it renders price itself) get the same treatment
using each listing's own `currency`/`price_usd_approx`.

## Error Handling / Edge Cases

- `price` is `None` (no listings, or all listings have a null price): `price`,
  `currency`, `price_usd_approx` all stay `None` — unchanged from today's
  "Price unavailable" behavior.
- `currency` is blank/`None` or an unrecognized code: `rate_for` returns
  `1.0`, so `price_usd_approx == price` (no conversion happened). Showing
  an "≈ $X USD" line in that case would be redundant (same number twice)
  and dishonestly imply we have a real rate for a currency we don't. That's
  why `hasApproxUsdConversion` checks membership in `CURRENCY_SYMBOLS`
  rather than just `currency !== "USD"` — an unrecognized code falls
  through to the plain `"<CODE> price"` display with no conversion line.
- Two listings tied on USD-equivalent price for the same wine: `ROW_NUMBER()`
  breaks ties arbitrarily (stable by the database's row order) — acceptable,
  since the tie means the choice is immaterial to price ranking.

## Testing

**Backend:**
- `tests/scripts/test_normalize_wines.py`: `normalize_currency` maps
  `"EURO"`/`"euro"` → `"EUR"`, passes through unrecognized codes uppercased,
  and blank → `None`.
- New `tests/services/test_currency.py` (or alongside existing service
  tests): `rate_for`/`approx_usd` cases for known codes, unknown codes
  (fallback 1.0), and `None` price/currency.
- `tests/api/test_wines.py`: a wine with a single EUR listing returns
  `currency: "EUR"` and a `price_usd_approx` computed from the rate table;
  a wine with two listings in different currencies picks the one with the
  lower USD-equivalent value as its list-item `price`/`currency`, not
  necessarily the lower raw number; `min_price`/`max_price` filters and
  `price_asc`/`price_desc` sort operate correctly across mixed-currency
  wines (a cheaper-in-USD EUR wine sorts before a pricier-in-USD wine even
  if its raw number is larger).

**Frontend:**
- `format.test.ts`: `formatPrice` for each mapped currency symbol, an
  unrecognized code (falls back to `"<CODE> "` prefix), and `null` price;
  `formatApproxUsd` for a value and for `null`; `hasApproxUsdConversion`
  true for a recognized non-USD code, false for `"USD"`, false for an
  unrecognized code, false for `null` currency.
- `WineCard.test.tsx` / `WineDetailPage.test.tsx`: a EUR-priced wine shows
  both the native-currency price and the "≈ $X USD" line; a USD-priced wine
  shows only the native price with no conversion line.

## Out of Scope

- Any endpoint to create/update/delete wines or listings (separate,
  later feature).
- Live/real-time exchange rates.
- Currency selection/preference per user (USD is always the approximation
  target).
- Converting *stored* prices — the database keeps each listing's original
  price and currency untouched; conversion is purely a query-time/display
  concern.
