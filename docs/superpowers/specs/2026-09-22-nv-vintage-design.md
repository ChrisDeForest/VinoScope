# NV Vintage Support — Design

## Problem

The wine data pipeline (`scripts/normalize_wines.py` → `scripts/import_wines.py`) only
accepts a blank `vintage` cell or a 4-digit year. Real wines are sometimes
intentionally non-vintage (NV) — e.g. many Champagne and sparkling/fortified
blends — and a data collector typing `NV` into the `vintage` CSV column
currently fails validation with `Invalid vintage: 'NV'`.

The frontend already treats a `null` vintage as `"NV"` for display
(`formatVintage` in `frontend/src/utils/format.ts`), so there's an existing
convention worth reusing rather than inventing a new one.

## Decision

Treat an explicit `NV` the same as "vintage unknown/blank": both normalize to
`vintage = None`. No distinction is made in the data model between "this wine
is deliberately non-vintage" and "we don't have vintage data for this row" —
the app doesn't need that distinction today, and adding it would require a
schema change (e.g. an `is_nv` flag) for no current benefit.

Consequently: **no database migration, no model/schema/API/frontend changes.**
`Wine.vintage` stays a nullable `int`. Only the two data-pipeline scripts
change.

`NV` matching is the literal two-letter string, case-insensitive (`NV`, `nv`,
`Nv`, `nV`), after trimming whitespace. Variants like `N.V.` or `Non-Vintage`
are NOT recognized and continue to raise a validation error, same as any
other invalid value — this catches typos rather than silently swallowing bad
data.

## Changes

### `scripts/normalize_wines.py`

`validate_vintage(vintage)`: after `clean_text`, if the cleaned value
case-insensitively equals `"NV"`, return `None`. Otherwise validation is
unchanged — a 4-digit year parses to `int`, anything else raises
`ValueError(f"Invalid vintage: {vintage!r}")`.

### `scripts/import_wines.py`

- `validate_row`: the `vintage` field currently runs through the generic
  `INT_FIELDS` loop, which would report `invalid vintage 'NV'`. Special-case
  vintage so a cleaned value case-insensitively equal to `"NV"` is treated as
  valid and skips the int-parse check.
- `upsert_wine`: line computing `vintage = int(row["vintage"]) if
  _clean(row.get("vintage")) else None` needs the same `"NV"` → `None`
  handling before attempting `int(...)`, so the resulting `Wine.vintage` is
  `None`.

## Data flow

```
raw CSV cell "NV" / "nv" / "Nv"
  → normalize_wines.py: validate_vintage → None
  → cleaned CSV: blank vintage cell
  → import_wines.py: validate_row (no error) → upsert_wine: vintage = None
  → Wine.vintage = NULL in Postgres
  → API: WineListItem.vintage = null
  → frontend: formatVintage(null) → "NV"  (already implemented, unchanged)
```

## Error handling

Unchanged for every other case: missing/blank vintage → `None` (as today);
a 4-digit year → `int` (as today); any other non-year, non-`NV` string
(typos, `"22"`, `"N.V."`, `"not-a-year"`) → validation error, exactly as
today.

## Testing

TDD, following the existing patterns in these test files:

- `tests/scripts/test_normalize_wines.py`: add assertions that
  `validate_vintage("NV")`, `"nv"`, and `"Nv"` all return `None`.
- `tests/scripts/test_import_wines.py`: add a case importing a CSV row with
  `vintage=NV` and asserting the resulting `Wine.vintage is None` (mirroring
  the existing `test_import_csv_rejects_non_numeric_vintage` and
  `test_import_csv_is_idempotent_on_winery_name_vintage` tests).

No new sample data rows are added to `data/raw/*.csv` as part of this
change — pipeline capability only.

## Out of scope

- Distinguishing "explicitly NV" from "vintage unknown" in the data model.
- Recognizing `NV` variants (`N.V.`, `N/V`, `Non-Vintage`).
- Any frontend change (existing `formatVintage` already handles `null` as
  `"NV"`).
- Adding NV rows to the CSV datasets.
