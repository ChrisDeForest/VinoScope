from functools import lru_cache
from typing import Generator

from sqlalchemy.orm import Session

from app.database.base import get_engine, get_session_factory


@lru_cache
def _get_session_factory():
    engine = get_engine()
    return get_session_factory(engine)


def get_db() -> Generator[Session, None, None]:
    session_factory = _get_session_factory()
    db = session_factory()
    try:
        yield db
    finally:
        db.close()
