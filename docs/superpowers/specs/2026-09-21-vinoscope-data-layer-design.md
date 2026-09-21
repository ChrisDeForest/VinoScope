# VinoScope — Data Layer Design

Date: 2026-09-21
Status: Approved
Scope: First implementation phase of VinoScope (see `docs/VinoScope_Project_Design.md` for full project vision). This spec covers only the database schema, repo scaffolding, and the manual-collection → cleaning → import pipeline. Backend API, recommendation engine, and frontend are separate future specs.

## Why this phase first

Every later feature (recommendation engine, Explore catalog, wine detail pages, comparisons) depends on having real, structured wine data to work against. This phase produces a working PostgreSQL database populated with an initial ~100 hand-collected, hand-rated wines, plus the repeatable tooling to keep adding to it.

## 1. Repo structure

```
vinoscope/
├── docs/
│   ├── VinoScope_Project_Design.md
│   └── superpowers/specs/          # design docs, this one included
├── backend/
│   ├── app/
│   │   ├── models/                 # SQLAlchemy models
│   │   └── database/               # engine/session setup, env config
│   ├── alembic/                    # migrations
│   ├── requirements.txt
│   └── alembic.ini
├── data/
│   ├── raw/                        # collected CSVs, untouched, one per import batch
│   └── cleaned/                    # output of the normalization step
├── scripts/
│   ├── normalize_wines.py          # cleans/standardizes a raw CSV
│   ├── find_duplicates.py          # flags likely-duplicate rows
│   └── import_wines.py             # loads cleaned CSV into Postgres
├── docker-compose.yml              # postgres service only, for now
├── .env.example
└── .gitignore
```

`frontend/` and the FastAPI `api/`/`schemas/`/`services/`/`recommendation/` folders are intentionally not created yet — they belong to later phases and would sit empty until then. `backend/app/models` and `backend/app/database` are the only backend pieces this phase needs; they stay in place unchanged when the FastAPI app is built around them later.

## 2. Database schema

Scoped to what this phase needs. `food_pairings`/`wine_food_pairings` from the full project doc are deferred to the Phase 2 backend spec — creating them now would just be dead tables.

```
wineries
--------
id
name
country
region
website

wines
-----
id
winery_id        → wineries.id
name
vintage
type              (red / white / rosé / sparkling / dessert / fortified)
country
region
subregion
abv
sweetness         (1-5, nullable)
acidity           (1-5, nullable)
tannin            (1-5, nullable)
body              (1-5, nullable)
fruitiness        (1-5, nullable)
description
image_url
created_at
updated_at

grapes
------
id
name

wine_grapes
-----------
wine_id           → wines.id
grape_id          → grapes.id
percentage        (nullable — not every source gives blend %)

retailers
---------
id
name
website

retailer_listings
------------------
id
wine_id           → wines.id
retailer_id       → retailers.id
price
currency
product_url
availability
source_product_id
collected_at
last_verified_at
```

Design decisions:

- The 1-5 characteristic columns on `wines` are nullable — a wine can exist in the database before it's been rated, rather than being forced to a fake default.
- Grapes live in their own `wine_grapes` join table (not a single string column on `wines`) so blends can be represented properly, e.g. 60% Cabernet Sauvignon / 40% Merlot.
- Provenance (`collected_at`, `last_verified_at`, `source_product_id`) lives on `retailer_listings`, not on `wines`, because the same wine can have multiple listings from different sources collected at different times.

## 3. CSV format

Manual collection produces a CSV with this header:

```csv
name,winery,vintage,grape,grape_pct,type,country,region,subregion,abv,price,currency,sweetness,acidity,tannin,body,fruitiness,description,image_url,source_site,source_url,source_product_id
```

- A blank template lives at `data/raw/wines_template.csv`.
- Every field except `name`, `type`, `source_site`, `source_url` may be blank; blank cells become null DB columns, not fabricated defaults.
- `grape` supports blends as a `;`-separated `Name:pct` list (`Cabernet Sauvignon:60;Merlot:40`) or a single grape name for varietal wines. `grape_pct` is derived from this during normalization and is not filled in by hand.
- `sweetness`/`acidity`/`tannin`/`body`/`fruitiness` are entered manually, informed by online reviews/descriptions and an LLM-assisted pass done externally (outside this pipeline) — the pipeline just consumes whatever values land in the CSV.

## 4. Pipeline

```
data/raw/*.csv
      ↓
normalize_wines.py
  - lowercase/trim text fields
  - strip bottle size from names ("750ml")
  - split "grape" blend string into normalized rows, deriving grape_pct
  - normalize country/region spelling against a small lookup table
  - validate vintage is a 4-digit year or blank
      ↓
data/cleaned/*.csv
      ↓
find_duplicates.py
  - rapidfuzz token_set_ratio on (name, winery) + exact vintage match
  - matches over threshold are written to a review file, never auto-merged
  - reviewed by hand: drop the duplicate row from the cleaned CSV, or
    confirm it's a genuine second listing of the same wine and keep it
      ↓
import_wines.py
  - upserts wineries/grapes/retailers by name (creates if missing)
  - inserts wines + wine_grapes
  - inserts retailer_listings with collected_at = now()
  - idempotent on (winery, name, vintage): re-running the same CSV
    updates existing rows rather than duplicating them
```

## 5. Error handling

`import_wines.py` runs each CSV import inside a single database transaction. If any row fails validation (e.g. an unrecognized `type` value), the script collects and reports every failing row up front and commits nothing — the dataset never ends up partially loaded from a single import run.

## 6. Tooling & testing

- A single `backend/requirements.txt` (sqlalchemy, psycopg, alembic, pandas, rapidfuzz, python-dotenv) covers both the SQLAlchemy models and the `scripts/` pipeline; scripts import models from `backend/app/models` rather than redefining schema.
- `docker-compose.yml` brings up a `postgres` service for local development; `alembic upgrade head` applies the schema in section 2.
- Test coverage for this phase is limited to the pipeline scripts, since there's no app logic yet:
  - `normalize_wines.py` — pytest cases for blend-splitting and name-cleaning edge cases, run against fixture CSVs.
  - `find_duplicates.py` — pytest cases against known duplicate/non-duplicate fixture pairs.
  - `import_wines.py` — an integration test against a throwaway test database.
- After importing the first real batch, spot-check row counts and a few specific wines via `psql` or a small script before relying on the dataset in later phases.

## Out of scope for this phase

- FastAPI backend, recommendation algorithm, weighted distance scoring
- Frontend (React app, any pages)
- `food_pairings` / `wine_food_pairings` tables
- Automated/scraped data collection
- Deployment
