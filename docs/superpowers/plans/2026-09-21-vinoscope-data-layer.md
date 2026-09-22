# VinoScope Data Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a working PostgreSQL database (via Docker), the SQLAlchemy models and Alembic migration that define its schema, and the three-stage `normalize → find-duplicates → import` pipeline that turns a hand-collected CSV of wines into rows in that database.

**Architecture:** A `backend/app` package holds the SQLAlchemy models and DB connection helpers (these will later be reused by the FastAPI app, in a future phase). A separate top-level `scripts/` package holds the CSV pipeline, which imports the models from `backend/app` but has no other dependency on a web framework. Postgres runs locally via `docker-compose.yml`. Tests run against a second `vinoscope_test` database on the same Postgres instance, created automatically by a Postgres init script.

**Tech Stack:** Python 3.11+, SQLAlchemy 2.0 (declarative `Mapped`/`mapped_column` style), psycopg 3, Alembic, pandas, rapidfuzz, python-dotenv, pytest, PostgreSQL 17 via Docker Compose.

## Global Constraints

- Database is PostgreSQL, run locally via Docker Compose; this phase's `docker-compose.yml` defines only the `postgres` service (no backend/frontend services yet).
- `backend/requirements.txt` is the single dependency list for both the app models and the `scripts/` pipeline: sqlalchemy, psycopg, alembic, pandas, rapidfuzz, python-dotenv, pytest.
- `wines.sweetness`, `wines.acidity`, `wines.tannin`, `wines.body`, `wines.fruitiness` are nullable integer columns (1-5 scale) — never default them to a fake value.
- Raw CSV header is exactly: `name,winery,vintage,grape,grape_pct,type,country,region,subregion,abv,price,currency,sweetness,acidity,tannin,body,fruitiness,description,image_url,source_site,source_url,source_product_id`.
- Duplicate detection writes a review CSV for a human to check; it never auto-merges or auto-deletes rows.
- `import_wines.py` validates every row in a CSV before writing anything, and commits the whole file in a single transaction — one bad row means zero rows imported.
- `import_wines.py` is idempotent on `(winery, name, vintage)`: re-running the same CSV updates the existing wine rather than creating a duplicate. Each import run still adds a new `retailer_listings` row (it represents "checked again on this date").
- Out of scope for this plan: FastAPI app/routes, the recommendation algorithm, the frontend, `food_pairings`/`wine_food_pairings` tables, automated/scraped data collection, deployment.

---

### Task 1: Project scaffolding + Postgres connectivity

**Files:**
- Create: `docker-compose.yml`
- Create: `backend/db-init/init-test-db.sql`
- Create: `.env.example`
- Create: `.gitignore`
- Create: `pytest.ini`
- Create: `backend/requirements.txt`
- Create: `backend/app/__init__.py`
- Create: `backend/app/database/__init__.py`
- Create: `backend/app/database/base.py`
- Create: `tests/__init__.py`
- Create: `tests/conftest.py`
- Create: `tests/database/__init__.py`
- Test: `tests/database/test_base.py`

**Interfaces:**
- Produces: `Base` (SQLAlchemy `DeclarativeBase` subclass), `get_engine(database_url: str | None = None) -> Engine`, `get_session_factory(engine: Engine) -> sessionmaker` — all in `app.database.base`. Every later task's models/scripts import from here.

- [ ] **Step 1: Create the scaffolding files**

`docker-compose.yml`:
```yaml
services:
  postgres:
    image: postgres:17
    environment:
      POSTGRES_USER: vinoscope
      POSTGRES_PASSWORD: vinoscope
      POSTGRES_DB: vinoscope
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./backend/db-init/init-test-db.sql:/docker-entrypoint-initdb.d/init-test-db.sql

volumes:
  pgdata:
```

`backend/db-init/init-test-db.sql`:
```sql
CREATE DATABASE vinoscope_test;
```

`.env.example`:
```
DATABASE_URL=postgresql+psycopg://vinoscope:vinoscope@localhost:5432/vinoscope
TEST_DATABASE_URL=postgresql+psycopg://vinoscope:vinoscope@localhost:5432/vinoscope_test
```

`.gitignore`:
```
__pycache__/
*.pyc
.env
.venv/
*.egg-info/
.pytest_cache/
```

`pytest.ini`:
```ini
[pytest]
pythonpath = backend .
testpaths = tests
```

`backend/requirements.txt`:
```
sqlalchemy>=2.0
psycopg[binary]>=3.1
alembic>=1.13
pandas>=2.2
rapidfuzz>=3.9
python-dotenv>=1.0
pytest>=8.0
```

`tests/conftest.py`:
```python
from dotenv import load_dotenv

load_dotenv()
```

Leave `backend/app/__init__.py`, `backend/app/database/__init__.py`, `tests/__init__.py`, and `tests/database/__init__.py` empty.

- [ ] **Step 2: Copy `.env.example` to `.env` and start Postgres**

Run:
```bash
cp .env.example .env
pip install -r backend/requirements.txt
docker compose up -d postgres
```

Wait for readiness — run this and expect `accepting connections`:
```bash
docker compose exec postgres pg_isready -U vinoscope
```

- [ ] **Step 3: Write the failing connectivity test**

`tests/database/test_base.py`:
```python
import os

from sqlalchemy import text

from app.database.base import get_engine


def test_get_engine_connects_to_test_database():
    engine = get_engine(os.environ["TEST_DATABASE_URL"])
    with engine.connect() as conn:
        result = conn.execute(text("SELECT 1"))
        assert result.scalar() == 1
    engine.dispose()
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pytest tests/database/test_base.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.database.base'` (the module doesn't exist yet).

- [ ] **Step 5: Implement `app/database/base.py`**

`backend/app/database/base.py`:
```python
import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker


class Base(DeclarativeBase):
    pass


def get_engine(database_url: str | None = None):
    url = database_url or os.environ["DATABASE_URL"]
    return create_engine(url, future=True)


def get_session_factory(engine):
    return sessionmaker(bind=engine, expire_on_commit=False, future=True)
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pytest tests/database/test_base.py -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add docker-compose.yml backend/db-init backend/requirements.txt backend/app \
  .env.example .gitignore pytest.ini tests/conftest.py tests/__init__.py \
  tests/database
git commit -m "feat: scaffold project and add Postgres connection helpers"
```

---

### Task 2: SQLAlchemy models

**Files:**
- Create: `backend/app/models/__init__.py`
- Create: `backend/app/models/winery.py`
- Create: `backend/app/models/grape.py`
- Create: `backend/app/models/retailer.py`
- Create: `backend/app/models/wine.py`
- Create: `backend/app/models/wine_grape.py`
- Create: `backend/app/models/retailer_listing.py`
- Create: `tests/models/__init__.py`
- Test: `tests/models/test_models.py`

**Interfaces:**
- Consumes: `Base` from `app.database.base` (Task 1).
- Produces: `Winery`, `Grape`, `Retailer`, `Wine`, `WineGrape`, `RetailerListing` model classes, importable from `app.models`. `Base.metadata` includes all six tables (`wineries`, `grapes`, `retailers`, `wines`, `wine_grapes`, `retailer_listings`) once `app.models` has been imported.

- [ ] **Step 1: Write the failing round-trip test**

`tests/models/test_models.py`:
```python
import os

from app.database.base import Base, get_engine, get_session_factory
from app.models import Winery, Grape, Wine, WineGrape, Retailer, RetailerListing


def _fresh_session():
    engine = get_engine(os.environ["TEST_DATABASE_URL"])
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    Session = get_session_factory(engine)
    return Session(), engine


def test_wine_with_winery_grapes_and_listing_round_trips():
    session, engine = _fresh_session()
    try:
        winery = Winery(name="Caymus Vineyards", country="USA", region="Napa Valley")
        cab = Grape(name="Cabernet Sauvignon")
        merlot = Grape(name="Merlot")
        wine = Wine(
            winery=winery,
            name="Caymus Cabernet Sauvignon",
            vintage=2022,
            type="red",
            country="USA",
            region="Napa Valley",
            abv=14.6,
            sweetness=1,
            acidity=3,
            tannin=5,
            body=5,
            fruitiness=3,
        )
        wine.grapes.append(WineGrape(grape=cab, percentage=60))
        wine.grapes.append(WineGrape(grape=merlot, percentage=40))
        retailer = Retailer(name="Total Wine")
        wine.listings.append(
            RetailerListing(
                retailer=retailer,
                price=79.99,
                currency="USD",
                product_url="https://example.com/wine",
            )
        )

        session.add(wine)
        session.commit()

        stored = session.query(Wine).filter_by(name="Caymus Cabernet Sauvignon").one()
        assert stored.winery.name == "Caymus Vineyards"
        assert {g.grape.name for g in stored.grapes} == {"Cabernet Sauvignon", "Merlot"}
        assert stored.listings[0].retailer.name == "Total Wine"
        assert stored.sweetness == 1
        assert stored.tannin == 5
    finally:
        session.close()
        Base.metadata.drop_all(engine)
        engine.dispose()


def test_wine_rating_columns_are_nullable():
    session, engine = _fresh_session()
    try:
        winery = Winery(name="Unrated Winery")
        wine = Wine(winery=winery, name="Unrated Wine", type="red")
        session.add(wine)
        session.commit()

        stored = session.query(Wine).filter_by(name="Unrated Wine").one()
        assert stored.sweetness is None
        assert stored.acidity is None
        assert stored.tannin is None
        assert stored.body is None
        assert stored.fruitiness is None
    finally:
        session.close()
        Base.metadata.drop_all(engine)
        engine.dispose()
```

Leave `tests/models/__init__.py` empty.

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/models/test_models.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.models'`

- [ ] **Step 3: Implement the model files**

`backend/app/models/winery.py`:
```python
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class Winery(Base):
    __tablename__ = "wineries"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    country: Mapped[str | None] = mapped_column(String(100))
    region: Mapped[str | None] = mapped_column(String(100))
    website: Mapped[str | None] = mapped_column(String(500))

    wines: Mapped[list["Wine"]] = relationship(back_populates="winery")
```

`backend/app/models/grape.py`:
```python
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class Grape(Base):
    __tablename__ = "grapes"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
```

`backend/app/models/retailer.py`:
```python
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class Retailer(Base):
    __tablename__ = "retailers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    website: Mapped[str | None] = mapped_column(String(500))
```

`backend/app/models/wine.py`:
```python
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class Wine(Base):
    __tablename__ = "wines"

    id: Mapped[int] = mapped_column(primary_key=True)
    winery_id: Mapped[int] = mapped_column(ForeignKey("wineries.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    vintage: Mapped[int | None] = mapped_column()
    type: Mapped[str] = mapped_column(String(20), nullable=False)
    country: Mapped[str | None] = mapped_column(String(100))
    region: Mapped[str | None] = mapped_column(String(100))
    subregion: Mapped[str | None] = mapped_column(String(100))
    abv: Mapped[float | None] = mapped_column()
    sweetness: Mapped[int | None] = mapped_column()
    acidity: Mapped[int | None] = mapped_column()
    tannin: Mapped[int | None] = mapped_column()
    body: Mapped[int | None] = mapped_column()
    fruitiness: Mapped[int | None] = mapped_column()
    description: Mapped[str | None] = mapped_column(String)
    image_url: Mapped[str | None] = mapped_column(String(1000))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    winery: Mapped["Winery"] = relationship(back_populates="wines")
    grapes: Mapped[list["WineGrape"]] = relationship(back_populates="wine", cascade="all, delete-orphan")
    listings: Mapped[list["RetailerListing"]] = relationship(back_populates="wine")
```

`backend/app/models/wine_grape.py`:
```python
from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class WineGrape(Base):
    __tablename__ = "wine_grapes"

    wine_id: Mapped[int] = mapped_column(ForeignKey("wines.id"), primary_key=True)
    grape_id: Mapped[int] = mapped_column(ForeignKey("grapes.id"), primary_key=True)
    percentage: Mapped[float | None] = mapped_column()

    wine: Mapped["Wine"] = relationship(back_populates="grapes")
    grape: Mapped["Grape"] = relationship()
```

`backend/app/models/retailer_listing.py`:
```python
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class RetailerListing(Base):
    __tablename__ = "retailer_listings"

    id: Mapped[int] = mapped_column(primary_key=True)
    wine_id: Mapped[int] = mapped_column(ForeignKey("wines.id"), nullable=False)
    retailer_id: Mapped[int] = mapped_column(ForeignKey("retailers.id"), nullable=False)
    price: Mapped[float | None] = mapped_column()
    currency: Mapped[str | None] = mapped_column(String(10))
    product_url: Mapped[str | None] = mapped_column(String(1000))
    availability: Mapped[str | None] = mapped_column(String(50))
    source_product_id: Mapped[str | None] = mapped_column(String(200))
    collected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    wine: Mapped["Wine"] = relationship(back_populates="listings")
    retailer: Mapped["Retailer"] = relationship()
```

`backend/app/models/__init__.py`:
```python
from app.database.base import Base
from app.models.winery import Winery
from app.models.grape import Grape
from app.models.retailer import Retailer
from app.models.wine import Wine
from app.models.wine_grape import WineGrape
from app.models.retailer_listing import RetailerListing

__all__ = [
    "Base",
    "Winery",
    "Grape",
    "Retailer",
    "Wine",
    "WineGrape",
    "RetailerListing",
]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/models/test_models.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/models tests/models
git commit -m "feat: add SQLAlchemy models for wines, wineries, grapes, and retailer listings"
```

---

### Task 3: Alembic migration

**Files:**
- Create: `backend/alembic.ini`
- Create: `backend/alembic/env.py`
- Create: `backend/alembic/script.py.mako`
- Create: `backend/alembic/versions/` (initial migration file generated by `alembic revision --autogenerate`)
- Create: `tests/database/test_migrations.py`

**Interfaces:**
- Consumes: `Base` and `app.models` from Task 2 (so `Base.metadata` knows about all six tables before autogenerate runs).
- Produces: `alembic upgrade head` / `alembic downgrade base` commands (run from the `backend/` directory) that create/drop the `wineries`, `grapes`, `retailers`, `wines`, `wine_grapes`, `retailer_listings` tables.

- [ ] **Step 1: Create the Alembic config files**

`backend/alembic.ini`:
```ini
[alembic]
script_location = alembic
prepend_sys_path = .
sqlalchemy.url =

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console
qualname =

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
```

`backend/alembic/script.py.mako`:
```mako
"""${message}

Revision ID: ${up_revision}
Revises: ${down_revision | comma,n}
Create Date: ${create_date}

"""
from alembic import op
import sqlalchemy as sa
${imports if imports else ""}

# revision identifiers, used by Alembic.
revision = ${repr(up_revision)}
down_revision = ${repr(down_revision)}
branch_labels = ${repr(branch_labels)}
depends_on = ${repr(depends_on)}


def upgrade() -> None:
    ${upgrades if upgrades else "pass"}


def downgrade() -> None:
    ${downgrades if downgrades else "pass"}
```

`backend/alembic/env.py`:
```python
import os
import sys
from logging.config import fileConfig

from alembic import context
from dotenv import load_dotenv
from sqlalchemy import engine_from_config, pool

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv()

from app.models import Base  # noqa: E402  (registers all models on Base.metadata)

config = context.config
config.set_main_option("sqlalchemy.url", os.environ["DATABASE_URL"])

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

Create the empty directory `backend/alembic/versions/`.

- [ ] **Step 2: Generate the initial migration against the dev database**

Run (from the repo root):
```bash
cd backend
alembic revision --autogenerate -m "create initial schema"
cd ..
```

Open the generated file under `backend/alembic/versions/` and confirm it creates all six tables (`wineries`, `grapes`, `retailers`, `wines`, `wine_grapes`, `retailer_listings`) with no unexpected drops — autogenerate compares against whatever is currently in the `vinoscope` database, which should be empty at this point.

- [ ] **Step 3: Write the migration verification test**

`tests/database/test_migrations.py`:
```python
import os
import subprocess

from sqlalchemy import inspect

from app.database.base import get_engine


def test_alembic_upgrade_creates_expected_tables():
    env = os.environ.copy()
    env["DATABASE_URL"] = env["TEST_DATABASE_URL"]

    subprocess.run(["alembic", "upgrade", "head"], cwd="backend", env=env, check=True)

    engine = get_engine(env["TEST_DATABASE_URL"])
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    engine.dispose()

    expected = {
        "wineries",
        "wines",
        "grapes",
        "wine_grapes",
        "retailers",
        "retailer_listings",
        "alembic_version",
    }
    assert expected.issubset(tables)

    subprocess.run(["alembic", "downgrade", "base"], cwd="backend", env=env, check=True)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/database/test_migrations.py -v`
Expected: PASS (this both proves the migration works and leaves the test database clean afterward via the downgrade step)

- [ ] **Step 5: Apply the migration to the dev database**

Run:
```bash
cd backend
alembic upgrade head
cd ..
```

- [ ] **Step 6: Commit**

```bash
git add backend/alembic.ini backend/alembic tests/database/test_migrations.py
git commit -m "feat: add Alembic migration for initial schema"
```

---

### Task 4: `normalize_wines.py`

**Files:**
- Create: `scripts/__init__.py`
- Create: `scripts/normalize_wines.py`
- Create: `tests/scripts/__init__.py`
- Test: `tests/scripts/test_normalize_wines.py`

**Interfaces:**
- Consumes: nothing from other tasks (pure script, pandas only).
- Produces: `normalize_csv(input_path: str, output_path: str) -> None`, and the pure functions `clean_text`, `strip_bottle_size`, `split_grape_blend`, `normalize_country`, `validate_vintage`, `normalize_row(row: dict) -> dict`, all in `scripts.normalize_wines`. Cleaned CSV output keeps the same header as the raw CSV, with `grape` reduced to a `;`-separated list of names and `grape_pct` populated as a parallel `;`-separated list of percentages (empty string where unknown).

- [ ] **Step 1: Write the failing tests**

`tests/scripts/test_normalize_wines.py`:
```python
import pandas as pd
import pytest

from scripts.normalize_wines import (
    clean_text,
    normalize_country,
    normalize_csv,
    normalize_row,
    split_grape_blend,
    strip_bottle_size,
    validate_vintage,
)


def test_clean_text_strips_whitespace_and_treats_blank_as_none():
    assert clean_text("  Caymus  ") == "Caymus"
    assert clean_text("") is None
    assert clean_text(None) is None
    assert clean_text(float("nan")) is None


def test_strip_bottle_size_removes_size_and_extra_whitespace():
    assert strip_bottle_size("Caymus Cabernet 750ml") == "Caymus Cabernet"
    assert strip_bottle_size("Caymus Cabernet 1.5L") == "Caymus Cabernet"
    assert strip_bottle_size("Caymus Cabernet") == "Caymus Cabernet"


def test_split_grape_blend_parses_multiple_grapes_with_percentages():
    blend = split_grape_blend("Cabernet Sauvignon:60;Merlot:40")
    assert blend == [("Cabernet Sauvignon", 60.0), ("Merlot", 40.0)]


def test_split_grape_blend_handles_single_grape_without_percentage():
    assert split_grape_blend("Chardonnay") == [("Chardonnay", None)]


def test_split_grape_blend_handles_blank_field():
    assert split_grape_blend("") == []
    assert split_grape_blend(None) == []


def test_normalize_country_applies_known_aliases():
    assert normalize_country("usa") == "United States"
    assert normalize_country("US") == "United States"


def test_normalize_country_title_cases_unknown_values():
    assert normalize_country("france") == "France"


def test_validate_vintage_accepts_four_digit_year():
    assert validate_vintage("2022") == 2022


def test_validate_vintage_allows_blank():
    assert validate_vintage("") is None
    assert validate_vintage(None) is None


def test_validate_vintage_rejects_non_year_value():
    with pytest.raises(ValueError):
        validate_vintage("22")


def test_normalize_row_produces_expected_fields():
    row = {
        "name": " Caymus Cabernet Sauvignon 750ml ",
        "winery": "Caymus Vineyards",
        "vintage": "2022",
        "grape": "Cabernet Sauvignon:60;Merlot:40",
        "type": "red",
        "country": "usa",
        "region": "Napa Valley",
    }
    result = normalize_row(row)
    assert result["name"] == "Caymus Cabernet Sauvignon"
    assert result["vintage"] == 2022
    assert result["grape"] == "Cabernet Sauvignon;Merlot"
    assert result["grape_pct"] == "60.0;40.0"
    assert result["country"] == "United States"


def test_normalize_csv_writes_cleaned_output(tmp_path):
    input_csv = tmp_path / "raw.csv"
    input_csv.write_text(
        "name,winery,vintage,grape,grape_pct,type,country,region,subregion,"
        "abv,price,currency,sweetness,acidity,tannin,body,fruitiness,"
        "description,image_url,source_site,source_url,source_product_id\n"
        "Caymus Cabernet Sauvignon 750ml,Caymus Vineyards,2022,"
        "Cabernet Sauvignon:60;Merlot:40,,red,usa,Napa Valley,,14.6,79.99,"
        "USD,1,3,5,5,3,Bold and rich,,Total Wine,https://example.com,ABC123\n"
    )
    output_csv = tmp_path / "cleaned.csv"

    normalize_csv(str(input_csv), str(output_csv))

    out_df = pd.read_csv(output_csv, dtype=str)
    assert out_df.loc[0, "name"] == "Caymus Cabernet Sauvignon"
    assert out_df.loc[0, "country"] == "United States"
    assert out_df.loc[0, "grape"] == "Cabernet Sauvignon;Merlot"
```

Leave `tests/scripts/__init__.py` empty.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/scripts/test_normalize_wines.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'scripts.normalize_wines'`

- [ ] **Step 3: Implement `scripts/normalize_wines.py`**

Leave `scripts/__init__.py` empty.

`scripts/normalize_wines.py`:
```python
import re
import sys

import pandas as pd

BOTTLE_SIZE_PATTERN = re.compile(r"\b\d+(\.\d+)?\s?(ml|l)\b", re.IGNORECASE)

COUNTRY_ALIASES = {
    "usa": "United States",
    "us": "United States",
    "united states of america": "United States",
    "uk": "United Kingdom",
}


def clean_text(value):
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    text = str(value).strip()
    return text if text else None


def strip_bottle_size(name):
    if name is None:
        return None
    cleaned = BOTTLE_SIZE_PATTERN.sub("", name)
    return re.sub(r"\s+", " ", cleaned).strip()


def split_grape_blend(grape_field):
    cleaned = clean_text(grape_field)
    if cleaned is None:
        return []
    blend = []
    for part in (p.strip() for p in cleaned.split(";") if p.strip()):
        if ":" in part:
            name, pct = part.split(":", 1)
            blend.append((name.strip(), float(pct.strip())))
        else:
            blend.append((part, None))
    return blend


def normalize_country(country):
    cleaned = clean_text(country)
    if cleaned is None:
        return None
    return COUNTRY_ALIASES.get(cleaned.lower(), cleaned.title())


def validate_vintage(vintage):
    cleaned = clean_text(vintage)
    if cleaned is None:
        return None
    if not re.fullmatch(r"\d{4}", cleaned):
        raise ValueError(f"Invalid vintage: {vintage!r}")
    return int(cleaned)


def normalize_row(row):
    blend = split_grape_blend(row.get("grape"))
    return {
        "name": strip_bottle_size(clean_text(row.get("name"))),
        "winery": clean_text(row.get("winery")),
        "vintage": validate_vintage(row.get("vintage")),
        "grape": ";".join(name for name, _ in blend),
        "grape_pct": ";".join("" if pct is None else str(pct) for _, pct in blend),
        "type": clean_text(row.get("type")),
        "country": normalize_country(row.get("country")),
        "region": clean_text(row.get("region")),
        "subregion": clean_text(row.get("subregion")),
        "abv": clean_text(row.get("abv")),
        "price": clean_text(row.get("price")),
        "currency": clean_text(row.get("currency")),
        "sweetness": clean_text(row.get("sweetness")),
        "acidity": clean_text(row.get("acidity")),
        "tannin": clean_text(row.get("tannin")),
        "body": clean_text(row.get("body")),
        "fruitiness": clean_text(row.get("fruitiness")),
        "description": clean_text(row.get("description")),
        "image_url": clean_text(row.get("image_url")),
        "source_site": clean_text(row.get("source_site")),
        "source_url": clean_text(row.get("source_url")),
        "source_product_id": clean_text(row.get("source_product_id")),
    }


def normalize_csv(input_path, output_path):
    df = pd.read_csv(input_path, dtype=str)
    rows = [normalize_row(row) for _, row in df.iterrows()]
    pd.DataFrame(rows).to_csv(output_path, index=False)


if __name__ == "__main__":
    normalize_csv(sys.argv[1], sys.argv[2])
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/scripts/test_normalize_wines.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/__init__.py scripts/normalize_wines.py tests/scripts
git commit -m "feat: add CSV normalization script"
```

---

### Task 5: `find_duplicates.py`

**Files:**
- Create: `scripts/find_duplicates.py`
- Test: `tests/scripts/test_find_duplicates.py`

**Interfaces:**
- Consumes: nothing from other tasks (reads a cleaned CSV by column name — `name`, `winery`, `vintage`, matching Task 4's output header).
- Produces: `write_review_file(cleaned_csv_path: str, review_csv_path: str) -> int`, `find_duplicate_pairs(df: pd.DataFrame) -> list[dict]`, `is_likely_duplicate(row_a, row_b) -> bool`, all in `scripts.find_duplicates`.

- [ ] **Step 1: Write the failing tests**

`tests/scripts/test_find_duplicates.py`:
```python
import pandas as pd

from scripts.find_duplicates import find_duplicate_pairs, is_likely_duplicate, write_review_file


def test_is_likely_duplicate_flags_close_name_and_winery_same_vintage():
    row_a = pd.Series({"name": "Caymus Cabernet Sauvignon", "winery": "Caymus Vineyards", "vintage": "2022"})
    row_b = pd.Series({"name": "Caymus Vineyards Cabernet", "winery": "Caymus Vineyards", "vintage": "2022"})
    assert is_likely_duplicate(row_a, row_b) is True


def test_is_likely_duplicate_rejects_different_vintage():
    row_a = pd.Series({"name": "Caymus Cabernet Sauvignon", "winery": "Caymus Vineyards", "vintage": "2022"})
    row_b = pd.Series({"name": "Caymus Cabernet Sauvignon", "winery": "Caymus Vineyards", "vintage": "2021"})
    assert is_likely_duplicate(row_a, row_b) is False


def test_is_likely_duplicate_rejects_unrelated_wines():
    row_a = pd.Series({"name": "Caymus Cabernet Sauvignon", "winery": "Caymus Vineyards", "vintage": "2022"})
    row_b = pd.Series({"name": "Kendall-Jackson Chardonnay", "winery": "Kendall-Jackson", "vintage": "2022"})
    assert is_likely_duplicate(row_a, row_b) is False


def test_find_duplicate_pairs_returns_one_pair_for_three_rows_with_one_duplicate():
    df = pd.DataFrame(
        [
            {"name": "Caymus Cabernet Sauvignon", "winery": "Caymus Vineyards", "vintage": "2022"},
            {"name": "Caymus Vineyards Cabernet", "winery": "Caymus Vineyards", "vintage": "2022"},
            {"name": "Kendall-Jackson Chardonnay", "winery": "Kendall-Jackson", "vintage": "2022"},
        ]
    )
    pairs = find_duplicate_pairs(df)
    assert len(pairs) == 1
    assert pairs[0]["index_a"] == 0
    assert pairs[0]["index_b"] == 1


def test_write_review_file_writes_csv_with_pair_count(tmp_path):
    cleaned_csv = tmp_path / "cleaned.csv"
    cleaned_csv.write_text(
        "name,winery,vintage\n"
        "Caymus Cabernet Sauvignon,Caymus Vineyards,2022\n"
        "Caymus Vineyards Cabernet,Caymus Vineyards,2022\n"
    )
    review_csv = tmp_path / "review.csv"

    count = write_review_file(str(cleaned_csv), str(review_csv))

    assert count == 1
    review_df = pd.read_csv(review_csv)
    assert len(review_df) == 1
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/scripts/test_find_duplicates.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'scripts.find_duplicates'`

- [ ] **Step 3: Implement `scripts/find_duplicates.py`**

```python
import sys

import pandas as pd
from rapidfuzz import fuzz

NAME_THRESHOLD = 90
WINERY_THRESHOLD = 90


def score_pair(row_a, row_b):
    name_score = fuzz.token_set_ratio(str(row_a["name"]), str(row_b["name"]))
    winery_score = fuzz.token_set_ratio(str(row_a["winery"]), str(row_b["winery"]))
    return name_score, winery_score


def is_likely_duplicate(row_a, row_b):
    if str(row_a.get("vintage")) != str(row_b.get("vintage")):
        return False
    name_score, winery_score = score_pair(row_a, row_b)
    return name_score >= NAME_THRESHOLD and winery_score >= WINERY_THRESHOLD


def find_duplicate_pairs(df):
    pairs = []
    for i in range(len(df)):
        for j in range(i + 1, len(df)):
            row_a, row_b = df.iloc[i], df.iloc[j]
            if is_likely_duplicate(row_a, row_b):
                name_score, winery_score = score_pair(row_a, row_b)
                pairs.append(
                    {
                        "index_a": i,
                        "index_b": j,
                        "name_a": row_a["name"],
                        "name_b": row_b["name"],
                        "winery_a": row_a["winery"],
                        "winery_b": row_b["winery"],
                        "vintage": row_a.get("vintage"),
                        "name_score": name_score,
                        "winery_score": winery_score,
                    }
                )
    return pairs


def write_review_file(cleaned_csv_path, review_csv_path):
    df = pd.read_csv(cleaned_csv_path, dtype=str)
    pairs = find_duplicate_pairs(df)
    pd.DataFrame(pairs).to_csv(review_csv_path, index=False)
    return len(pairs)


if __name__ == "__main__":
    count = write_review_file(sys.argv[1], sys.argv[2])
    print(f"Found {count} potential duplicate pair(s). Review: {sys.argv[2]}")
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/scripts/test_find_duplicates.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/find_duplicates.py tests/scripts/test_find_duplicates.py
git commit -m "feat: add fuzzy duplicate detection script"
```

---

### Task 6: `import_wines.py`

**Files:**
- Create: `scripts/import_wines.py`
- Test: `tests/scripts/test_import_wines.py`

**Interfaces:**
- Consumes: `get_engine`/`get_session_factory` (Task 1), `Winery`/`Grape`/`Retailer`/`Wine`/`WineGrape`/`RetailerListing` (Task 2), and the cleaned CSV column format produced by Task 4's `normalize_csv`.
- Produces: `import_csv(csv_path: str, database_url: str | None = None) -> int` (returns rows imported), `ImportValidationError` (raised with `.row_errors: list[tuple[int, str]]` when any row fails validation), all in `scripts.import_wines`.

- [ ] **Step 1: Write the failing tests**

`tests/scripts/test_import_wines.py`:
```python
import os

import pytest

from app.database.base import Base, get_engine, get_session_factory
from app.models import RetailerListing, Wine
from scripts.import_wines import ImportValidationError, import_csv

CLEANED_HEADER = (
    "name,winery,vintage,grape,grape_pct,type,country,region,subregion,"
    "abv,price,currency,sweetness,acidity,tannin,body,fruitiness,"
    "description,image_url,source_site,source_url,source_product_id\n"
)


@pytest.fixture
def test_db_url():
    url = os.environ["TEST_DATABASE_URL"]
    engine = get_engine(url)
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    engine.dispose()
    return url


def _write_csv(tmp_path, rows):
    path = tmp_path / "cleaned.csv"
    path.write_text(CLEANED_HEADER + "\n".join(rows) + "\n")
    return str(path)


def test_import_csv_creates_wine_winery_grapes_and_listing(tmp_path, test_db_url):
    csv_path = _write_csv(
        tmp_path,
        [
            "Caymus Cabernet Sauvignon,Caymus Vineyards,2022,Cabernet Sauvignon;Merlot,60.0;40.0,"
            "red,United States,Napa Valley,,14.6,79.99,USD,1,3,5,5,3,Bold and rich,,"
            "Total Wine,https://example.com/wine,ABC123"
        ],
    )

    count = import_csv(csv_path, database_url=test_db_url)
    assert count == 1

    engine = get_engine(test_db_url)
    Session = get_session_factory(engine)
    session = Session()
    try:
        wine = session.query(Wine).filter_by(name="Caymus Cabernet Sauvignon").one()
        assert wine.winery.name == "Caymus Vineyards"
        assert {g.grape.name for g in wine.grapes} == {"Cabernet Sauvignon", "Merlot"}
        assert wine.tannin == 5

        listing = session.query(RetailerListing).filter_by(wine_id=wine.id).one()
        assert listing.retailer.name == "Total Wine"
        assert listing.price == 79.99
    finally:
        session.close()
        engine.dispose()


def test_import_csv_is_idempotent_on_winery_name_vintage(tmp_path, test_db_url):
    csv_path = _write_csv(
        tmp_path,
        [
            "Caymus Cabernet Sauvignon,Caymus Vineyards,2022,Cabernet Sauvignon,,red,"
            "United States,Napa Valley,,14.6,79.99,USD,1,3,5,5,3,,,"
            "Total Wine,https://example.com/wine,ABC123"
        ],
    )

    import_csv(csv_path, database_url=test_db_url)
    import_csv(csv_path, database_url=test_db_url)

    engine = get_engine(test_db_url)
    Session = get_session_factory(engine)
    session = Session()
    try:
        wines = session.query(Wine).filter_by(name="Caymus Cabernet Sauvignon").all()
        assert len(wines) == 1
        listings = session.query(RetailerListing).all()
        assert len(listings) == 2
    finally:
        session.close()
        engine.dispose()


def test_import_csv_rejects_entire_file_on_invalid_row(tmp_path, test_db_url):
    csv_path = _write_csv(
        tmp_path,
        [
            "Good Wine,Some Winery,2022,,,red,,,,,,,,,,,,,,Total Wine,https://example.com/a,1",
            "Bad Wine,Some Winery,2022,,,not-a-type,,,,,,,,,,,,,,Total Wine,https://example.com/b,2",
        ],
    )

    with pytest.raises(ImportValidationError) as exc_info:
        import_csv(csv_path, database_url=test_db_url)

    assert exc_info.value.row_errors[0][0] == 1

    engine = get_engine(test_db_url)
    Session = get_session_factory(engine)
    session = Session()
    try:
        assert session.query(Wine).count() == 0
    finally:
        session.close()
        engine.dispose()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/scripts/test_import_wines.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'scripts.import_wines'`

- [ ] **Step 3: Implement `scripts/import_wines.py`**

```python
import sys
from datetime import datetime, timezone

import pandas as pd
from sqlalchemy.orm import Session

from app.database.base import get_engine, get_session_factory
from app.models import Grape, Retailer, RetailerListing, Wine, WineGrape, Winery

VALID_TYPES = {"red", "white", "rosé", "sparkling", "dessert", "fortified"}


class ImportValidationError(Exception):
    def __init__(self, row_errors):
        self.row_errors = row_errors
        message = "; ".join(f"row {i}: {err}" for i, err in row_errors)
        super().__init__(message)


def _clean(value):
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    text = str(value).strip()
    return text if text else None


def validate_row(row):
    errors = []
    if not _clean(row.get("name")):
        errors.append("missing name")
    wine_type = _clean(row.get("type"))
    if not wine_type:
        errors.append("missing type")
    elif wine_type.lower() not in VALID_TYPES:
        errors.append(f"invalid type {wine_type!r}")
    if not _clean(row.get("source_site")):
        errors.append("missing source_site")
    if not _clean(row.get("source_url")):
        errors.append("missing source_url")
    return errors


def get_or_create_winery(session: Session, name, country=None, region=None) -> Winery:
    winery = session.query(Winery).filter_by(name=name).one_or_none()
    if winery is None:
        winery = Winery(name=name, country=country, region=region)
        session.add(winery)
        session.flush()
    return winery


def get_or_create_grape(session: Session, name) -> Grape:
    grape = session.query(Grape).filter_by(name=name).one_or_none()
    if grape is None:
        grape = Grape(name=name)
        session.add(grape)
        session.flush()
    return grape


def get_or_create_retailer(session: Session, name) -> Retailer:
    retailer = session.query(Retailer).filter_by(name=name).one_or_none()
    if retailer is None:
        retailer = Retailer(name=name)
        session.add(retailer)
        session.flush()
    return retailer


def parse_grape_blend(grape_field, grape_pct_field):
    grape_names = _clean(grape_field)
    names = [n.strip() for n in grape_names.split(";")] if grape_names else []
    pcts_raw = _clean(grape_pct_field) or ""
    pcts = pcts_raw.split(";") if pcts_raw else []
    blend = []
    for i, name in enumerate(names):
        pct = float(pcts[i]) if i < len(pcts) and pcts[i].strip() else None
        blend.append((name, pct))
    return blend


def upsert_wine(session: Session, row) -> Wine:
    winery = get_or_create_winery(
        session, _clean(row.get("winery")), _clean(row.get("country")), _clean(row.get("region"))
    )
    vintage = int(row["vintage"]) if _clean(row.get("vintage")) else None
    name = _clean(row["name"])
    wine_type = _clean(row["type"]).lower()

    wine = session.query(Wine).filter_by(winery_id=winery.id, name=name, vintage=vintage).one_or_none()
    if wine is None:
        wine = Wine(winery=winery, name=name, vintage=vintage, type=wine_type)
        session.add(wine)
    else:
        wine.type = wine_type

    wine.country = _clean(row.get("country"))
    wine.region = _clean(row.get("region"))
    wine.subregion = _clean(row.get("subregion"))
    wine.abv = float(row["abv"]) if _clean(row.get("abv")) else None
    wine.sweetness = int(row["sweetness"]) if _clean(row.get("sweetness")) else None
    wine.acidity = int(row["acidity"]) if _clean(row.get("acidity")) else None
    wine.tannin = int(row["tannin"]) if _clean(row.get("tannin")) else None
    wine.body = int(row["body"]) if _clean(row.get("body")) else None
    wine.fruitiness = int(row["fruitiness"]) if _clean(row.get("fruitiness")) else None
    wine.description = _clean(row.get("description"))
    wine.image_url = _clean(row.get("image_url"))
    session.flush()

    wine.grapes.clear()
    for grape_name, pct in parse_grape_blend(row.get("grape"), row.get("grape_pct")):
        grape = get_or_create_grape(session, grape_name)
        wine.grapes.append(WineGrape(grape=grape, percentage=pct))

    return wine


def create_retailer_listing(session: Session, wine: Wine, row) -> RetailerListing:
    retailer = get_or_create_retailer(session, _clean(row["source_site"]))
    listing = RetailerListing(
        wine=wine,
        retailer=retailer,
        price=float(row["price"]) if _clean(row.get("price")) else None,
        currency=_clean(row.get("currency")),
        product_url=_clean(row.get("source_url")),
        source_product_id=_clean(row.get("source_product_id")),
        collected_at=datetime.now(timezone.utc),
    )
    session.add(listing)
    return listing


def import_csv(csv_path, database_url=None):
    df = pd.read_csv(csv_path, dtype=str)

    row_errors = [(index, "; ".join(errors)) for index, row in df.iterrows() if (errors := validate_row(row))]
    if row_errors:
        raise ImportValidationError(row_errors)

    engine = get_engine(database_url)
    Session = get_session_factory(engine)
    session = Session()
    try:
        for _, row in df.iterrows():
            wine = upsert_wine(session, row)
            create_retailer_listing(session, wine, row)
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
        engine.dispose()

    return len(df)


if __name__ == "__main__":
    imported = import_csv(sys.argv[1])
    print(f"Imported {imported} wine(s).")
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/scripts/test_import_wines.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/import_wines.py tests/scripts/test_import_wines.py
git commit -m "feat: add wine import script with validation and idempotent upserts"
```

---

### Task 7: Verification script + README

**Files:**
- Create: `scripts/verify_import.py`
- Create: `README.md`
- Test: `tests/scripts/test_verify_import.py`

**Interfaces:**
- Consumes: `get_engine`/`get_session_factory` (Task 1), `Winery`/`Wine`/`RetailerListing` (Task 2).
- Produces: `summarize(database_url: str | None = None) -> dict` with keys `wine_count`, `winery_count`, `listing_count`, `sample` (list of `(name, winery_name, vintage)` tuples), in `scripts.verify_import`.

- [ ] **Step 1: Write the failing test**

`tests/scripts/test_verify_import.py`:
```python
import os

import pytest

from app.database.base import Base, get_engine, get_session_factory
from app.models import Wine, Winery
from scripts.verify_import import summarize


@pytest.fixture
def test_db_url():
    url = os.environ["TEST_DATABASE_URL"]
    engine = get_engine(url)
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    engine.dispose()
    return url


def test_summarize_counts_wines_wineries_and_listings(test_db_url):
    engine = get_engine(test_db_url)
    Session = get_session_factory(engine)
    session = Session()
    winery = Winery(name="Caymus Vineyards")
    wine = Wine(winery=winery, name="Caymus Cabernet Sauvignon", vintage=2022, type="red")
    session.add(wine)
    session.commit()
    session.close()
    engine.dispose()

    summary = summarize(test_db_url)

    assert summary["wine_count"] == 1
    assert summary["winery_count"] == 1
    assert summary["listing_count"] == 0
    assert summary["sample"] == [("Caymus Cabernet Sauvignon", "Caymus Vineyards", 2022)]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/scripts/test_verify_import.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'scripts.verify_import'`

- [ ] **Step 3: Implement `scripts/verify_import.py`**

```python
import os

from app.database.base import get_engine, get_session_factory
from app.models import RetailerListing, Wine, Winery


def summarize(database_url=None):
    engine = get_engine(database_url)
    Session = get_session_factory(engine)
    session = Session()
    try:
        wine_count = session.query(Wine).count()
        winery_count = session.query(Winery).count()
        listing_count = session.query(RetailerListing).count()
        sample = session.query(Wine).order_by(Wine.id).limit(3).all()
        return {
            "wine_count": wine_count,
            "winery_count": winery_count,
            "listing_count": listing_count,
            "sample": [(w.name, w.winery.name, w.vintage) for w in sample],
        }
    finally:
        session.close()
        engine.dispose()


if __name__ == "__main__":
    summary = summarize(os.environ.get("DATABASE_URL"))
    print(f"Wines: {summary['wine_count']}")
    print(f"Wineries: {summary['winery_count']}")
    print(f"Retailer listings: {summary['listing_count']}")
    print("Sample:")
    for name, winery, vintage in summary["sample"]:
        print(f"  - {name} ({winery}, {vintage})")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/scripts/test_verify_import.py -v`
Expected: PASS

- [ ] **Step 5: Write the README**

`README.md`:
```markdown
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
```

- [ ] **Step 6: Commit**

```bash
git add scripts/verify_import.py tests/scripts/test_verify_import.py README.md
git commit -m "feat: add import verification script and setup README"
```
