import os
import pytest

try:
    from fastapi.testclient import TestClient
except ImportError:  # pragma: no cover
    pytest.skip("fastapi not installed", allow_module_level=True)

# Import app
from server import app

client = TestClient(app)


def _register(email: str):
    res = client.post("/api/auth/register", json={
        "email": email,
        "password": "Testpass123!",
        "name": "AutoFill Test",
    })
    assert res.status_code == 200
    return res.json()["access_token"]


def test_autofill_requires_auth():
    res = client.post("/api/business-profile/autofill", json={})
    assert res.status_code in (401, 403)


def test_autofill_basic_schema():
    token = _register(f"autofill_{os.urandom(4).hex()}@example.com")
    res = client.post(
        "/api/business-profile/autofill",
        headers={"Authorization": f"Bearer {token}"},
        json={"business_name": "Example Pty Ltd"}
    )
    assert res.status_code == 200
    data = res.json()
    assert "patch" in data
    assert "missing_fields" in data
    assert isinstance(data["missing_fields"], list)
