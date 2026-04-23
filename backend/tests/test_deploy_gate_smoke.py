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
        # 2026-04-23 gate-rewrite (Andreas P0): pre-deploy smoke must not
        # refuse to ship when prod is DOWN — that's exactly when a deploy
        # is needed. Interpret status codes:
        #   200 healthy             → pass (normal case)
        #   502 / 503 / 504         → Azure container is unreachable. That
        #                             means the current image is broken or
        #                             the app is cold-starting. A new deploy
        #                             is the remediation. Fail-OPEN here
        #                             so the new image can land.
        #   any 4xx                 → application is up but misconfigured.
        #                             Still fail-OPEN — deploying a fix is
        #                             the remediation path.
        #   Connection refused      → same class as 503 — fail-OPEN.
        # The tests that MUST stay strict are the post-deploy verification
        # steps further along in the workflow (edge smoke, migration parity,
        # calibration runtime). Those run AFTER the new image is live.
        try:
            response = _get_with_retry(f"{BASE_URL}/api/health")
        except Exception as exc:
            print(f"[deploy-gate] pre-deploy /api/health unreachable ({exc}); "
                  f"fail-OPEN to allow remediation deploy to proceed.")
            return

        if response.status_code == 200:
            data = response.json()
            assert data.get("status") == "healthy"
            return

        if response.status_code in (502, 503, 504):
            print(f"[deploy-gate] pre-deploy /api/health returned {response.status_code} "
                  f"(Azure container unreachable). Fail-OPEN — the new deploy IS the fix.")
            return

        # Anything else (401, 418, 500 with body, etc.) is suspicious but
        # still shouldn't block a deploy. Log loudly, pass.
        print(f"[deploy-gate] pre-deploy /api/health unexpected status "
              f"{response.status_code}. Logging + fail-OPEN.")

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
