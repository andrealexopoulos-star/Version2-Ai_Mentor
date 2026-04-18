"""
Deploy gate smoke tests.
Keeps deployment gating focused on stable runtime behavior.
"""

import os
import requests
import time

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


class TestDeployGateSmoke:
    def test_backend_health(self):
        response = None
        for attempt in range(3):
            response = _get_with_retry(f"{BASE_URL}/api/health")
            if response.status_code == 200:
                break
            if attempt < 2:
                time.sleep(2)

        assert response is not None
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
