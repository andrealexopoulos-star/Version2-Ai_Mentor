"""
Iteration 12: calibration write-path regression guardrails.

This suite validates the modern routerized architecture:
- Runtime endpoint registration/auth behavior
- Source-level write-path guarantees in route modules
"""

import os
from pathlib import Path

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://biqc-api.azurewebsites.net").rstrip("/")
BACKEND_ROOT = Path(__file__).resolve().parents[1]
CALIBRATION_PATH = BACKEND_ROOT / "routes" / "calibration.py"
AUTH_PATH = BACKEND_ROOT / "routes" / "auth.py"
ADMIN_PATH = BACKEND_ROOT / "routes" / "admin.py"
SERVER_PATH = BACKEND_ROOT / "server.py"


def _read(path: Path) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


class TestCalibrationEndpointAuth:
    """All calibration endpoints are registered and require auth when expected."""

    @pytest.mark.parametrize(
        "method,path,payload,allowed",
        [
            ("GET", "/api/calibration/status", None, {401, 403}),
            ("GET", "/api/auth/check-profile", None, {401, 403}),
            ("POST", "/api/calibration/defer", None, {401, 403, 422}),
            ("POST", "/api/calibration/init", None, {401, 403, 422}),
            ("POST", "/api/calibration/answer", {"question_id": 1, "answer": "Test"}, {401, 403, 422}),
            ("POST", "/api/calibration/brain", {"message": "Test", "history": []}, {401, 403, 422}),
            ("POST", "/api/admin/backfill-calibration", None, {401, 403, 422}),
        ],
    )
    def test_auth_guardrails(self, method, path, payload, allowed):
        url = f"{BASE_URL}{path}"
        response = requests.request(method, url, json=payload, timeout=12)
        assert response.status_code != 404, f"Endpoint missing: {method} {path}"
        assert response.status_code in allowed, (
            f"Unexpected status for {method} {path}: {response.status_code} {response.text[:180]}"
        )


class TestCodePathGuards:
    """Static code checks for calibration authority and write-paths."""

    def test_server_includes_calibration_and_admin_routers(self):
        content = _read(SERVER_PATH)
        assert "api_router.include_router(calibration_router)" in content
        assert "api_router.include_router(admin_router)" in content

    def test_calibration_answer_and_brain_write_complete_status(self):
        content = _read(CALIBRATION_PATH)
        assert '@router.post("/calibration/answer")' in content
        assert '@router.post("/calibration/brain")' in content
        assert 'table("user_operator_profile")' in content
        assert '"persona_calibration_status": "complete"' in content

    def test_calibration_defer_writes_deferred_status(self):
        content = _read(CALIBRATION_PATH)
        assert '@router.post("/calibration/defer")' in content
        assert 'table("user_operator_profile")' in content
        assert '"persona_calibration_status": "deferred"' in content

    def test_calibration_init_does_not_reference_removed_column(self):
        content = _read(CALIBRATION_PATH)
        init_start = content.find('@router.post("/calibration/init")')
        answer_start = content.find('@router.post("/calibration/answer")')
        assert init_start >= 0 and answer_start > init_start
        init_section = content[init_start:answer_start]
        assert "calibration_status" not in init_section, (
            "calibration/init should not reference legacy business_profiles.calibration_status"
        )

    def test_auth_check_profile_uses_user_operator_profile_authority(self):
        content = _read(AUTH_PATH)
        assert '@router.get("/auth/check-profile")' in content
        assert 'Single source of truth: user_operator_profile.persona_calibration_status' in content
        assert "table(\"user_operator_profile\").select(" in content
        assert "persona_calibration_status" in content

    def test_admin_backfill_endpoint_writes_user_operator_profile(self):
        content = _read(ADMIN_PATH)
        assert '@router.post("/admin/backfill-calibration")' in content
        assert 'table("user_operator_profile")' in content
        assert '"persona_calibration_status": "complete"' in content


class TestBackendHealth:
    def test_backend_health(self):
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert response.status_code == 200, f"Health check failed: {response.status_code} {response.text[:120]}"
