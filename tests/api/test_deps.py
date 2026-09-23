import pytest
from fastapi import HTTPException

from app.api.deps import require_admin_key


def test_require_admin_key_raises_401_when_header_missing(monkeypatch):
    monkeypatch.setenv("ADMIN_API_KEY", "secret123")
    with pytest.raises(HTTPException) as exc_info:
        require_admin_key(x_admin_key=None)
    assert exc_info.value.status_code == 401


def test_require_admin_key_raises_401_when_header_wrong(monkeypatch):
    monkeypatch.setenv("ADMIN_API_KEY", "secret123")
    with pytest.raises(HTTPException) as exc_info:
        require_admin_key(x_admin_key="wrong-key")
    assert exc_info.value.status_code == 401


def test_require_admin_key_passes_when_header_matches(monkeypatch):
    monkeypatch.setenv("ADMIN_API_KEY", "secret123")
    require_admin_key(x_admin_key="secret123")


def test_require_admin_key_raises_401_when_env_var_unset(monkeypatch):
    monkeypatch.delenv("ADMIN_API_KEY", raising=False)
    with pytest.raises(HTTPException) as exc_info:
        require_admin_key(x_admin_key="anything")
    assert exc_info.value.status_code == 401
