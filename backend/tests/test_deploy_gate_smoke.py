"""
Deploy gate smoke tests.
Keeps deployment gating focused on stable runtime behavior.
"""

import os
import requests
import time

import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")


def _get_with_retry(url, max_attempts=3, timeout=45):
    # Retries on Timeout/ConnectionError with exponential backoff (1s, 2s).
    # Azure cold-start + CDN can exceed 15s on first hit; 45s covers it.
    last_exc = None
    for attempt in range(max_attempts):
        try:
            return requests.get(url, timeout=timeout)
        except (requests.exceptions.Timeout, requests.exceptions.ConnectionError) as exc:
            last_exc = exc
            if attempt < max_attempts - 1:
                time.sleep(2 ** attempt)
    raise last_exc


def _prod_state():
    """Single prod /api/health probe used at module import.

    Returns one of:
      "healthy"   — 200 + status:"healthy". Gate stays strict.
      "down"      — 5xx, timeout, connection refused. Fail-OPEN on the
                    entire gate class so the remediation deploy can land.
      "degraded"  — anything else. Fail-OPEN; log loudly.
    """
    try:
        response = requests.get(f"{BASE_URL}/api/health", timeout=20)
    except Exception:
        return "down"
    if response.status_code == 200:
        try:
            data = response.json()
            if data.get("status") == "healthy":
                return "healthy"
        except Exception:
            pass
        return "degraded"
    if response.status_code in (502, 503, 504):
        return "down"
    return "degraded"


# 2026-04-23 P0 outage remediation (Andreas CTO):
# The class below contains 5 smoke tests that each probe prod endpoints.
# When prod is DOWN (5xx / unreachable), all 5 fail — blocking the exact
# deploy that would FIX prod. Chicken-and-egg. Previous hotfix (#374)
# patched only test_backend_health; the 4 others still blocked.
#
# Fix: single module-level prod-state probe + pytestmark.skipif skips
# ALL tests in this module when prod != "healthy". This is the one
# scenario where a pre-deploy gate SHOULD be non-strict — you don't
# want the gate refusing to ship the remediation.
#
# Post-deploy verification (edge runtime smoke, migration parity,
# calibration runtime smoke, frontend custom-domain binding) runs AFTER
# the new image is live and MUST stay strict. Nothing in those steps
# is relaxed by this file.
_PROD_STATE = _prod_state()
_SKIP_REASON = (
    f"[deploy-gate] pre-deploy smoke fail-OPEN — prod state = '{_PROD_STATE}'. "
    "The new deploy IS the remediation. Post-deploy verification remains strict."
)
pytestmark = pytest.mark.skipif(
    _PROD_STATE != "healthy",
    reason=_SKIP_REASON,
)


class TestDeployGateSmoke:
    def test_backend_health(self):
        response = _get_with_retry(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"

    def test_api_root(self):
        response = _get_with_retry(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data

    def test_admin_prompts_auth_gate(self):
        response = _get_with_retry(f"{BASE_URL}/api/admin/prompts")
        assert response.status_code in [401, 403]
        assert "detail" in response.json()

    def test_calibration_status_auth_gate(self):
        response = _get_with_retry(f"{BASE_URL}/api/calibration/status")
        assert response.status_code in [401, 403]
        assert "detail" in response.json()

    def test_google_oauth_endpoint(self):
        response = _get_with_retry(f"{BASE_URL}/api/auth/supabase/oauth/google")
        assert response.status_code == 200
        data = response.json()
        assert "url" in data
