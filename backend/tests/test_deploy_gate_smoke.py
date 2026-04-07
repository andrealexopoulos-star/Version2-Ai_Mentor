"""
Deploy gate smoke tests.
Keeps deployment gating focused on stable runtime behavior.
"""

import os
import requests
import time

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")


class TestDeployGateSmoke:
    def test_backend_health(self):
        # Retry quickly to absorb transient startup races, but fail hard on degraded health.
        response = None
        for attempt in range(3):
            response = requests.get(f"{BASE_URL}/api/health", timeout=15)
            if response.status_code == 200:
                break
            if attempt < 2:
                time.sleep(2)

        assert response is not None
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"

    def test_api_root(self):
        response = requests.get(f"{BASE_URL}/api/", timeout=15)
        assert response.status_code == 200
        data = response.json()
        assert "message" in data

    def test_admin_prompts_auth_gate(self):
        response = requests.get(f"{BASE_URL}/api/admin/prompts", timeout=15)
        assert response.status_code in [401, 403]
        assert "detail" in response.json()

    def test_calibration_status_auth_gate(self):
        response = requests.get(f"{BASE_URL}/api/calibration/status", timeout=15)
        assert response.status_code in [401, 403]
        assert "detail" in response.json()

    def test_google_oauth_endpoint(self):
        response = requests.get(f"{BASE_URL}/api/auth/supabase/oauth/google", timeout=15)
        assert response.status_code == 200
        data = response.json()
        assert "url" in data
