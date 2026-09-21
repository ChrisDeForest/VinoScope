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
