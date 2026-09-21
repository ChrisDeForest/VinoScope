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
