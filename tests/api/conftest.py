import os

import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_db
from app.database.base import Base, get_engine, get_session_factory
from app.main import app


@pytest.fixture
def db_session():
    url = os.environ["TEST_DATABASE_URL"]
    engine = get_engine(url)
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    Session = get_session_factory(engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)
        engine.dispose()


@pytest.fixture
def client(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
