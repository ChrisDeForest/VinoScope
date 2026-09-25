# VinoScope

Wine discovery and recommendation platform. See `docs/VinoScope_Project_Design.md`
for the full project vision and `docs/superpowers/specs/` for phase-by-phase
design docs.

## Data layer setup

1. Copy the environment file:
   `cp .env.example .env`
   Set `ADMIN_API_KEY` in `.env` to a real secret value before the write endpoints
   (`PATCH`/`POST`/`DELETE` on `/wines`) will work — until then they correctly
   respond with 401.
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
   you don't know the value). For non-vintage wines, put `NV` in the vintage
   column (or leave it blank).
2. Normalize: `python scripts/normalize_wines.py data/raw/<file>.csv data/cleaned/<file>.csv`
3. Check for duplicates: `python scripts/find_duplicates.py data/cleaned/<file>.csv data/cleaned/<file>.review.csv`
   Review the output file by hand before continuing.
4. Import: `python scripts/import_wines.py data/cleaned/<file>.csv`
5. Verify: `python scripts/verify_import.py`
6. Bottle images (optional, not part of the backend app): `pip install -r
   scripts/requirements-images.txt`, then see `scripts/process_wine_images.py`
   and `data/images/manifest.csv`. The dev venv already has these for running
   `tests/scripts/`.

## Frontend setup

1. Copy the environment file:
   `cp frontend/.env.example frontend/.env`
2. Install dependencies:
   `cd frontend && npm install && cd ..`
3. Start the backend API (the frontend needs it for data):
   `cd backend && uvicorn app.main:app --port 8000`
4. In a separate terminal, start the frontend dev server:
   `cd frontend && npm run dev`
5. Open the printed local URL (default `http://localhost:5173`).
6. Run frontend tests: `cd frontend && npm run test`
