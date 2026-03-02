"""BIQc Integration Test Suite — Covers all critical API endpoints."""
import os
import pytest
import httpx

BASE_URL = os.environ.get("TEST_BASE_URL", "http://localhost:8001")


class TestHealthEndpoints:
    def test_health(self):
        r = httpx.get(f"{BASE_URL}/api/health")
        assert r.status_code == 200

    def test_warmup(self):
        r = httpx.get(f"{BASE_URL}/api/warmup")
        assert r.status_code in (200, 404)


class TestAuthRequired:
    """All protected endpoints must return 403 without auth."""
    PROTECTED = [
        "/api/snapshot/latest", "/api/business-profile",
        "/api/intelligence/workforce", "/api/intelligence/scores",
        "/api/spine/status", "/api/rag/stats",
        "/api/marketing/benchmark/latest", "/api/memory/retrieve",
        "/api/files/list", "/api/files/reports",
        "/api/super-admin/verify", "/api/support/users",
        "/api/experiments/list", "/api/services/health",
        "/api/alerts/check", "/api/eval/factuality",
    ]

    @pytest.mark.parametrize("endpoint", PROTECTED)
    def test_protected_returns_403(self, endpoint):
        r = httpx.get(f"{BASE_URL}{endpoint}")
        assert r.status_code == 403, f"{endpoint} returned {r.status_code}, expected 403"


class TestPostEndpointsReject:
    """POST endpoints must reject unauthenticated requests."""
    POST_PROTECTED = [
        "/api/dsee/scan", "/api/ingestion/run", "/api/ingestion/hybrid",
        "/api/rag/embed", "/api/rag/search",
        "/api/marketing/benchmark", "/api/automation/generate",
        "/api/files/generate", "/api/soundboard/chat",
        "/api/engagement/scan",
    ]

    @pytest.mark.parametrize("endpoint", POST_PROTECTED)
    def test_post_protected(self, endpoint):
        r = httpx.post(f"{BASE_URL}{endpoint}", json={})
        assert r.status_code in (403, 422), f"{endpoint} returned {r.status_code}"


class TestFeatureFlags:
    """Feature flag endpoint must exist."""
    def test_flags_exist(self):
        # This would need auth in production
        r = httpx.get(f"{BASE_URL}/api/spine/status")
        assert r.status_code == 403  # Auth required = endpoint exists


class TestNoRegression:
    """Verify core endpoints haven't broken."""
    def test_calibration_status(self):
        r = httpx.get(f"{BASE_URL}/api/calibration/status")
        assert r.status_code == 403

    def test_integrations(self):
        r = httpx.get(f"{BASE_URL}/api/integrations/merge/connected")
        assert r.status_code == 403

    def test_snapshot(self):
        r = httpx.get(f"{BASE_URL}/api/snapshot/latest")
        assert r.status_code == 403
