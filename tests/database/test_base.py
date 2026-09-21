import os

from sqlalchemy import text

from app.database.base import get_engine


def test_get_engine_connects_to_test_database():
    engine = get_engine(os.environ["TEST_DATABASE_URL"])
    with engine.connect() as conn:
        result = conn.execute(text("SELECT 1"))
        assert result.scalar() == 1
    engine.dispose()
