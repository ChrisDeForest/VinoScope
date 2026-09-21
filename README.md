# VinoScope

Wine discovery and recommendation platform. See `docs/VinoScope_Project_Design.md`
for the full project vision and `docs/superpowers/specs/` for phase-by-phase
design docs.

## Data layer setup

1. Copy the environment file:
   `cp .env.example .env`
2. Install dependencies:
   `pip install -r backend/requirements.txt`
3. Start Postgres:
   `docker compose up -d postgres`
4. Apply migrations:
   `cd backend && alembic upgrade head && cd ..`
5. Run the tests:
   `pytest`

## Adding wines

1. Copy `data/raw/wines_template.csv` to a new file in `data/raw/` and fill in rows
   (see the template header for the expected columns; leave a cell blank if
   you don't know the value).
2. Normalize: `python scripts/normalize_wines.py data/raw/<file>.csv data/cleaned/<file>.csv`
3. Check for duplicates: `python scripts/find_duplicates.py data/cleaned/<file>.csv data/cleaned/<file>.review.csv`
   Review the output file by hand before continuing.
4. Import: `python scripts/import_wines.py data/cleaned/<file>.csv`
5. Verify: `python scripts/verify_import.py`
