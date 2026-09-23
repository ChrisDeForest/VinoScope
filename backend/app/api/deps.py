import os
from functools import lru_cache
from typing import Generator

from fastapi import Header, HTTPException
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


def require_admin_key(x_admin_key: str | None = Header(default=None)) -> None:
    expected = os.environ.get("ADMIN_API_KEY")
    if not expected or x_admin_key != expected:
        raise HTTPException(status_code=401, detail="Invalid or missing admin key")
