# NV Vintage Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the wine data pipeline accept the literal value `NV` (case-insensitive) in the `vintage` CSV column, treating it the same as a blank/unknown vintage — both resolve to `Wine.vintage = None`.

**Architecture:** No schema, model, API, or frontend changes. `Wine.vintage` stays a nullable `int`; the frontend already renders `null` as `"NV"` (`frontend/src/utils/format.ts`). Only the two pipeline scripts (`scripts/normalize_wines.py`, `scripts/import_wines.py`) and their test suites change.

**Tech Stack:** Python, pandas, SQLAlchemy, pytest (existing pipeline stack — no new dependencies).

## Global Constraints

- `NV` matching is the literal two-letter string, case-insensitive (`NV`, `nv`, `Nv`, `nV`), after whitespace trimming. No other variant (`N.V.`, `N/V`, `Non-Vintage`) is recognized — those still raise a validation error.
- No database migration. No changes to `backend/app/models/wine.py`, `backend/app/schemas/wine.py`, or any frontend file.
- No new sample data rows are added to `data/raw/*.csv` as part of this change.

Reference spec: `docs/superpowers/specs/2026-09-22-nv-vintage-design.md`

---

### Task 1: `normalize_wines.py` accepts NV

**Files:**
- Modify: `scripts/normalize_wines.py:52-58` (`validate_vintage`)
- Test: `tests/scripts/test_normalize_wines.py`

**Interfaces:**
- Consumes: nothing new — `clean_text` (already defined in this file) is reused.
- Produces: `validate_vintage(vintage: str | None) -> int | None` — unchanged signature, now also returns `None` for a case-insensitive `"NV"` input. Task 2 does not call this function directly (it has its own separate validation in `import_wines.py`), so no other task depends on this change.

- [ ] **Step 1: Write the failing test**

Add this test to `tests/scripts/test_normalize_wines.py`, directly after `test_validate_vintage_rejects_non_year_value` (after line 62):

```python
def test_validate_vintage_accepts_nv_case_insensitive():
    assert validate_vintage("NV") is None
    assert validate_vintage("nv") is None
    assert validate_vintage("Nv") is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/scripts/test_normalize_wines.py::test_validate_vintage_accepts_nv_case_insensitive -v`
Expected: FAIL — `ValueError: Invalid vintage: 'NV'` is raised instead of returning `None`.

- [ ] **Step 3: Write minimal implementation**

In `scripts/normalize_wines.py`, replace the existing `validate_vintage` function (lines 52-58):

```python
def validate_vintage(vintage):
    cleaned = clean_text(vintage)
    if cleaned is None:
        return None
    if not re.fullmatch(r"\d{4}", cleaned):
        raise ValueError(f"Invalid vintage: {vintage!r}")
    return int(cleaned)
```

with:

```python
def validate_vintage(vintage):
    cleaned = clean_text(vintage)
    if cleaned is None:
        return None
    if cleaned.upper() == "NV":
        return None
    if not re.fullmatch(r"\d{4}", cleaned):
        raise ValueError(f"Invalid vintage: {vintage!r}")
    return int(cleaned)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/scripts/test_normalize_wines.py -v`
Expected: PASS — all tests in the file pass, including the new one and the existing `test_validate_vintage_rejects_non_year_value` (which asserts `"22"` still raises).

- [ ] **Step 5: Commit**

```bash
git add scripts/normalize_wines.py tests/scripts/test_normalize_wines.py
git commit -m "feat: accept NV as a valid vintage in normalize_wines.py"
```

---

### Task 2: `import_wines.py` accepts NV

**Files:**
- Modify: `scripts/import_wines.py:45-84` (`validate_row`)
- Modify: `scripts/import_wines.py:126-150` (`upsert_wine`, specifically the `vintage` line at 130)
- Test: `tests/scripts/test_import_wines.py`

**Interfaces:**
- Consumes: `_clean(value) -> str | None` (already defined in this file, unchanged).
- Produces: `import_csv(csv_path, database_url=...) -> int` (unchanged signature/behavior) now additionally accepts CSV rows whose `vintage` cell is `NV` (case-insensitive), importing them with `Wine.vintage = None` instead of raising `ImportValidationError`.

- [ ] **Step 1: Write the failing test**

Add this test to `tests/scripts/test_import_wines.py`, directly after `test_import_csv_is_idempotent_on_winery_name_vintage` (the block ending before `test_import_csv_rejects_non_numeric_vintage` at line 139):

```python
def test_import_csv_accepts_nv_vintage(tmp_path, test_db_url):
    csv_path = _write_csv(
        tmp_path,
        [
            "NV Brut Champagne,Some Winery,NV,Chardonnay;Pinot Noir,60.0;40.0,"
            "sparkling,France,Champagne,,12.0,49.99,USD,2,4,2,3,2,,,"
            "Total Wine,https://example.com/nv,XYZ789"
        ],
    )

    count = import_csv(csv_path, database_url=test_db_url)
    assert count == 1

    engine = get_engine(test_db_url)
    Session = get_session_factory(engine)
    session = Session()
    try:
        wine = session.query(Wine).filter_by(name="NV Brut Champagne").one()
        assert wine.vintage is None
    finally:
        session.close()
        engine.dispose()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/scripts/test_import_wines.py::test_import_csv_accepts_nv_vintage -v`
Expected: FAIL — `ImportValidationError` is raised because `validate_row` reports `invalid vintage 'NV'`.

- [ ] **Step 3: Write minimal implementation**

In `scripts/import_wines.py`, in `validate_row`, replace the `INT_FIELDS` loop (lines 61-66):

```python
    for field_name in INT_FIELDS:
        value = _clean(row.get(field_name))
        if value is not None:
            _, ok = _try_parse_numeric(value, int)
            if not ok:
                errors.append(f"invalid {field_name} {value!r}")
```

with:

```python
    for field_name in INT_FIELDS:
        value = _clean(row.get(field_name))
        if value is not None:
            if field_name == "vintage" and value.upper() == "NV":
                continue
            _, ok = _try_parse_numeric(value, int)
            if not ok:
                errors.append(f"invalid {field_name} {value!r}")
```

Then, in `upsert_wine`, replace the vintage line (line 130):

```python
    vintage = int(row["vintage"]) if _clean(row.get("vintage")) else None
```

with:

```python
    vintage_raw = _clean(row.get("vintage"))
    vintage = None if vintage_raw is None or vintage_raw.upper() == "NV" else int(vintage_raw)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/scripts/test_import_wines.py -v`
Expected: PASS — all tests in the file pass, including the new one and the existing `test_import_csv_rejects_non_numeric_vintage` (which asserts `"not-a-year"` still raises).

- [ ] **Step 5: Run the full test suite to confirm no regressions**

Run: `pytest -v`
Expected: PASS — all tests pass, no regressions elsewhere in the pipeline, backend, or frontend test suites.

- [ ] **Step 6: Commit**

```bash
git add scripts/import_wines.py tests/scripts/test_import_wines.py
git commit -m "feat: accept NV as a valid vintage in import_wines.py"
```
