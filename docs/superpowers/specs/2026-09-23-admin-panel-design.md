# Admin Panel — Design

## Problem

The write API added earlier this session (`PATCH /wines/{id}`, listing
CRUD) has no frontend UI — the only way to use it is `curl` with an
`X-Admin-Key` header. There's also no way to see aggregate information
about the wine dataset (how many wines, what the price/rating distributions
look like, which types/countries/currencies are represented) without
querying the database directly. This spec adds a login-gated admin panel
that surfaces both: editing (wine fields, listings, and now grape blends)
and dataset statistics.

## Decision

- **Auth:** no new user/account system. A password-only login form asks
  for the existing shared `ADMIN_API_KEY`, stores it in `sessionStorage`
  (cleared when the tab closes), and every admin API call attaches it as
  `X-Admin-Key`. Login is "verified" by the first real admin call (the
  stats fetch) succeeding or failing with 401 — no separate verification
  endpoint.
- **Two entry points, one edit component:** a `WineEditPanel` component
  (wine fields, listings, and grape blend, each independently saveable) is
  mounted both on `WineDetailPage` (behind an "Edit this wine" toggle that
  only appears when an admin key is stored) and inside the new `/admin`
  page's wine table (click a row to expand it there). One component, two
  mount points — no duplicate editors.
- **New backend surface:** `GET /api/admin/stats` (dataset statistics) and
  `PUT /api/wines/{id}/grapes` (replace a wine's grape blend), both
  protected by the existing `require_admin_key` dependency.
- A small "Admin" button sits to the right of `ThemeSwitcher` in the
  header, linking to `/admin`.

Out of scope: real user accounts, password hashing/rotation, creating a
brand-new wine from the admin page (still CSV-import-only), and the `Pair`
page (separate, later spec).

## Backend: `GET /api/admin/stats`

Protected by `require_admin_key`. No request body/params. Response:

```python
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

`numeric` covers, computed via SQL aggregates (`func.count`, `func.min`,
`func.max`, `func.avg`) rather than pulling every row into Python:
`vintage`, `abv`, `sweetness`, `acidity`, `tannin`, `body`, `fruitiness`
(all on `Wine`), plus `price` and `price_usd_approx` (on
`RetailerListing`, using the same `approx_usd`/rate-table logic the
currency feature already built — `price_usd_approx` isn't a stored column,
so it's computed the same way `_row_to_dict` already does). `avg` is
rounded to 2dp; on an empty table (no wines yet), `count`/`null_count` are
`0` and `min`/`max`/`avg` are `null` — no division-by-zero.

`categorical` covers `type`, `country`, `region` (on `Wine`) and
`currency`, `availability` (on `RetailerListing`): `{value: count}`, via
`GROUP BY` + `count`, sorted descending by count in the service layer
before returning (Python `dict` preserves insertion order, so this fixes
the response's display order without the frontend needing to sort).

**Columns deliberately excluded from stats:** `name`, `winery`, `retailer`,
`description`, `image_url`, `product_url`, `subregion`. These are
high-cardinality free text (e.g. 143 distinct wineries across 200 wines —
a value-count table there is just a long list of mostly-1s, not an
informative stat) or not meaningfully aggregable at all. "Stats about
every column" is interpreted as "every column where an aggregate is
actually informative," not literally every column in the schema.

## Backend: `PUT /api/wines/{id}/grapes`

Protected by `require_admin_key`. Replaces the wine's entire grape blend —
matches how `scripts/import_wines.py`'s `upsert_wine` already treats
blends (`wine.grapes.clear()` then re-populate), rather than adding
per-grape add/remove endpoints. A wine's grapes are typically a handful of
rows, and the UI edits a small local table before saving the whole thing
at once, so a full-replace endpoint matches both the existing data
convention and the natural UI interaction.

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

`name` is get-or-create by name (`backend/app/services/wines.py` gains a
`get_or_create_grape`, mirroring the `get_or_create_retailer` it already
has) — grape variety names don't carry the same duplication risk winery
names do (no fuzzy-matching concern has come up for grapes anywhere in
this project, same reasoning already used for retailers). No requirement
that percentages sum to 100 — the existing data already has wines with
partially- or un-specified percentages (`percentage: null`), and enforcing
a sum constraint isn't something this feature asks for. 404 if the wine
doesn't exist. Returns the updated `WineDetail` (so the frontend refreshes
its whole view of the wine, including the grapes list, from one response,
consistent with how `PATCH /wines/{id}` already returns the full updated
`WineDetail`).

## Frontend: auth

`frontend/src/services/adminAuth.ts`: `getAdminKey(): string | null`,
`setAdminKey(key: string): void`, `clearAdminKey(): void` — thin wrapper
over `sessionStorage`. `frontend/src/services/adminApi.ts`: the admin-only
API client functions (`getAdminStats`, `updateWine`, `createListing`,
`updateListing`, `deleteListing`, `updateGrapes`), each attaching
`X-Admin-Key: getAdminKey()` and throwing `ApiError` on non-2xx —
mirroring `frontend/src/services/api.ts`'s existing `ApiError`/`fetch`
pattern, kept in a separate file so the public read-only API client
doesn't grow admin-specific concerns.

## Frontend: `WineEditPanel`

Takes a `WineDetail` and an `onUpdated: (wine: WineDetail) => void`
callback. Three independently-saveable sections:

1. **Wine fields** — a form for `name`, `winery`, `vintage`, `type`,
   `country`, `region`, `subregion`, `abv`, the five rating fields,
   `description`, `image_url`. One "Save wine" button calls `updateWine`
   with only the changed fields (`PATCH` semantics — the panel tracks
   which fields the admin actually touched, so an untouched field is
   omitted from the request rather than resent unchanged) and calls
   `onUpdated` with the response.
2. **Listings** — each existing listing rendered as an editable row
   (price, currency, availability, product URL) with its own "Save" and
   "Delete" buttons calling `updateListing`/`deleteListing` immediately
   (not deferred to a page-level save), plus an "Add listing" mini-form
   (retailer name + the same fields) calling `createListing`. Each action
   calls `onUpdated` with a fresh `WineDetail` (re-fetched via `getWine`,
   since listing endpoints return just the listing, not the whole wine).
3. **Grapes** — a table of rows (grape name text input, percentage number
   input, remove button) seeded from the wine's current `grapes`, plus an
   "Add grape" button appending a blank row. Its own "Save grapes" button
   sends the whole current table to `updateGrapes` and calls `onUpdated`
   with the response (which already includes the refreshed `WineDetail`).

## Frontend: mount points

- **`WineDetailPage`**: when `getAdminKey()` is non-null, an "Edit this
  wine" toggle button appears; toggling it renders `WineEditPanel` below
  the existing read view, using the already-fetched `WineDetail`.
- **`/admin` page** (new `AdminPage.tsx`, new route in `App.tsx`): if no
  admin key stored, renders a login form (password input + submit calling
  `getAdminStats` to verify, clearing the key and showing an error on
  401). Once logged in: the stats dashboard (from `getAdminStats`) above a
  compact wine table — reuses `listWines` with a plain text-search input
  (not the full `FilterDrawer`) and load-more pagination, matching
  `ExplorePage`'s existing `loadMoreRequestId`-ref stale-response-guard
  pattern. Each row (name, winery, vintage, type, price) expands
  `WineEditPanel` on click. A "Log out" button calls `clearAdminKey()` and
  returns to the login form.

## Frontend: header button

`frontend/src/components/layout/Header.tsx` gains a small "Admin"
`NavLink` to `/admin`, placed after `ThemeSwitcher` in the existing flex
row.

## Data Flow

```
Login: submit password
  -> setAdminKey(password)
  -> getAdminStats()  (GET /api/admin/stats, X-Admin-Key: password)
     -> 401: clearAdminKey(), show "Invalid admin key"
     -> 200: render dashboard + wine table

Edit grapes on wine 5:
  local table: [{name: "Cabernet Sauvignon", percentage: 60}, {name: "Petit Verdot", percentage: 40}]
  -> updateGrapes(5, {grapes: [...]})  (PUT /api/wines/5/grapes)
  -> get_or_create_grape("Cabernet Sauvignon"), get_or_create_grape("Petit Verdot")
  -> wine.grapes.clear(); wine.grapes = [WineGrape(...), WineGrape(...)]
  -> returns WineDetail with updated grapes
  -> onUpdated(freshWine) re-renders the panel and the read view
```

## Error Handling

- `401` on any admin call — the panel/page should surface this as
  "session expired, please log in again" and clear the stored key (not
  just the initial login form), since the key could be revoked/rotated by
  changing `ADMIN_API_KEY` server-side while a tab still has an old one
  cached.
- `404` on `PUT /wines/{id}/grapes` if the wine doesn't exist (mirrors the
  wine/listing endpoints).
- `422` on a duplicate grape name in one request, an out-of-range
  percentage, or a `type`/rating/`abv`/etc. violation on the wine-fields
  save (existing `WineUpdate` validation, unchanged).
- Empty dataset (`GET /api/admin/stats` with zero wines): all counts `0`,
  `min`/`max`/`avg` `null`, `categorical` empty dicts — no crash.

## Testing

**Backend:**
- `GET /api/admin/stats`: correct aggregates against a seeded fixture
  (known min/max/avg/counts), correct categorical groupings, empty-DB case
  (no division by zero), `401` without the key.
- `PUT /wines/{id}/grapes`: replaces existing blend entirely (old grapes
  gone, new ones present); new grape name get-or-created (no duplicate
  `Grape` row on a second call with the same name); duplicate name within
  one request → `422`; unknown wine → `404`; `401` without the key.

**Frontend:**
- `adminAuth.ts`: get/set/clear round-trip.
- Login flow: wrong key → error shown, key cleared; right key → dashboard
  renders.
- `WineEditPanel`: each of the three sections' save/add/delete actions
  calls the right API function and its `onUpdated` callback; percentage
  and name inputs in the grapes table.
- `WineDetailPage`: edit toggle only appears with a stored key; toggling
  renders the panel.
- `AdminPage`: stats render from a mocked `getAdminStats`; wine table
  search + row-expand renders `WineEditPanel`; log out clears the key and
  returns to the login form.
- Header: "Admin" link present and points to `/admin`.
