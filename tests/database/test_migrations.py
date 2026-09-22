import os
import subprocess

from sqlalchemy import inspect

from app.database.base import get_engine


def test_alembic_upgrade_creates_expected_tables():
    env = os.environ.copy()
    env["DATABASE_URL"] = env["TEST_DATABASE_URL"]
    backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "backend")

    subprocess.run(["alembic", "upgrade", "head"], cwd=backend_dir, env=env, check=True)

    try:
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
    finally:
        subprocess.run(["alembic", "downgrade", "base"], cwd=backend_dir, env=env, check=True)
