from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.main import api_docs_settings


def test_docs_are_served_outside_production():
    assert api_docs_settings({}) == {"docs_url": "/docs", "redoc_url": "/redoc", "openapi_url": "/openapi.json"}
    assert api_docs_settings({"VINOSCOPE_ENV": "development"})["docs_url"] == "/docs"


def test_docs_are_hidden_in_production():
    assert api_docs_settings({"VINOSCOPE_ENV": "production"}) == {
        "docs_url": None,
        "redoc_url": None,
        "openapi_url": None,
    }


def test_a_production_app_does_not_serve_the_docs_or_schema():
    app = FastAPI(**api_docs_settings({"VINOSCOPE_ENV": "production"}))
    with TestClient(app) as client:
        for path in ("/docs", "/redoc", "/openapi.json"):
            assert client.get(path).status_code == 404
