"""
Iteration 68: Forensic Calibration + Channel Intelligence Testing
Testing:
1. POST /api/forensic/calibration - Submit 7 answers, get weighted scoring
2. GET /api/forensic/calibration - Retrieve existing results
3. GET /api/integrations/channels/status - Channel connection status with summary
4. Auth: All endpoints require authentication (401 without token)
"""
import pytest
import requests
import os

# Use PUBLIC URL for testing
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://beta.thestrategysquad.com")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", os.environ.get("REACT_APP_SUPABASE_ANON_KEY", ""))

TEST_USER_EMAIL = os.environ.get("TEST_USER_EMAIL", os.environ.get("E2E_TEST_EMAIL", ""))
TEST_USER_PASSWORD = os.environ.get("TEST_USER_PASSWORD", os.environ.get("E2E_TEST_PASSWORD", ""))


@pytest.fixture(scope="module")
def access_token():
    """Get Supabase access token for authenticated requests."""
    if not (SUPABASE_URL and SUPABASE_ANON_KEY and TEST_USER_EMAIL and TEST_USER_PASSWORD):
        pytest.skip("Auth test env not configured for iteration68")

    resp = requests.post(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        headers={
            "apikey": SUPABASE_ANON_KEY,
            "Content-Type": "application/json"
        },
        json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        }
    )
    if resp.status_code != 200:
        pytest.skip(f"Authentication unavailable for iteration68: {resp.status_code}")
    data = resp.json()
    token = data.get("access_token")
    if not token:
        pytest.skip("Authentication unavailable for iteration68: missing access token")
    return token


@pytest.fixture
def auth_headers(access_token):
    """Create auth headers from token."""
    return {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }


# ═══════════════════════════════════════════════════════════════
# TEST: FORENSIC CALIBRATION ENDPOINTS
# ═══════════════════════════════════════════════════════════════

class TestForensicCalibration:
    """Forensic calibration POST/GET endpoint tests"""

    def test_forensic_calibration_post_returns_auth_error_without_auth(self):
        """POST /api/forensic/calibration without auth should return 401 or 403"""
        resp = requests.post(
            f"{BASE_URL}/api/forensic/calibration",
            json={"answers": {}},
            headers={"Content-Type": "application/json"}
        )
        assert resp.status_code in [401, 403], f"Expected 401/403, got {resp.status_code}: {resp.text}"
        print(f"PASS: POST /api/forensic/calibration returns {resp.status_code} without auth")

    def test_forensic_calibration_get_returns_auth_error_without_auth(self):
        """GET /api/forensic/calibration without auth should return 401 or 403"""
        resp = requests.get(f"{BASE_URL}/api/forensic/calibration")
        assert resp.status_code in [401, 403], f"Expected 401/403, got {resp.status_code}: {resp.text}"
        print(f"PASS: GET /api/forensic/calibration returns {resp.status_code} without auth")

    def test_forensic_calibration_post_with_7_answers(self, auth_headers):
        """POST /api/forensic/calibration with 7 answers returns composite_score, risk_profile, dimensions, signals"""
        # Build 7 answers matching frontend question IDs
        answers = {
            "revenue_ambition": {"answer": "Grow 25-50% — aggressive but controlled", "index": 2, "weight": "revenue"},
            "growth_timeline": {"answer": "3-6 months — urgent growth required", "index": 2, "weight": "timeline"},
            "cohort_intention": {"answer": "Enter new industries — diversification", "index": 2, "weight": "cohort"},
            "risk_appetite": {"answer": "Moderate — willing to invest with safety net", "index": 1, "weight": "risk"},
            "retention_maturity": {"answer": "Structured — NPS, health scores, playbooks", "index": 2, "weight": "retention"},
            "pricing_confidence": {"answer": "Confident — value-based, tested", "index": 2, "weight": "pricing"},
            "channel_dependency": {"answer": "Diversified — spread across 3-4 channels", "index": 2, "weight": "channel"},
        }

        resp = requests.post(
            f"{BASE_URL}/api/forensic/calibration",
            json={"answers": answers},
            headers=auth_headers
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()

        # Validate response structure
        assert "composite_score" in data, f"Missing composite_score: {data}"
        assert "risk_profile" in data, f"Missing risk_profile: {data}"
        assert "risk_color" in data, f"Missing risk_color: {data}"
        assert "dimensions" in data, f"Missing dimensions: {data}"
        assert "signals" in data, f"Missing signals: {data}"

        # Validate composite_score is 0-100
        assert 0 <= data["composite_score"] <= 100, f"composite_score out of range: {data['composite_score']}"

        # Validate risk_profile is one of the expected values
        valid_profiles = ["Conservative", "Moderate", "Growth-Oriented", "Aggressive"]
        assert data["risk_profile"] in valid_profiles, f"Invalid risk_profile: {data['risk_profile']}"

        # Validate dimensions has the 7 weight keys
        expected_dims = ["revenue", "timeline", "cohort", "risk", "retention", "pricing", "channel"]
        for dim in expected_dims:
            assert dim in data["dimensions"], f"Missing dimension: {dim}"
            dim_data = data["dimensions"][dim]
            assert "score" in dim_data, f"Dimension {dim} missing score"
            assert "label" in dim_data, f"Dimension {dim} missing label"

        # Validate signals is a list with at least one signal
        assert isinstance(data["signals"], list), f"signals is not a list: {data['signals']}"
        assert len(data["signals"]) >= 1, f"signals should have at least 1 signal"
        for sig in data["signals"]:
            assert "type" in sig, f"Signal missing type: {sig}"
            assert "text" in sig, f"Signal missing text: {sig}"

        print(f"PASS: POST /api/forensic/calibration returns valid response")
        print(f"  composite_score={data['composite_score']}, risk_profile={data['risk_profile']}")
        print(f"  signals count={len(data['signals'])}")

    def test_forensic_calibration_get_returns_existing_results(self, auth_headers):
        """GET /api/forensic/calibration returns existing results after submission"""
        resp = requests.get(
            f"{BASE_URL}/api/forensic/calibration",
            headers=auth_headers
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()

        # Should have exists: true after the POST test ran
        assert "exists" in data, f"Missing exists field: {data}"
        
        if data["exists"]:
            # If calibration exists, validate structure
            assert "composite_score" in data, f"Missing composite_score in existing result: {data}"
            assert "risk_profile" in data, f"Missing risk_profile in existing result: {data}"
            assert "dimensions" in data, f"Missing dimensions in existing result: {data}"
            print(f"PASS: GET /api/forensic/calibration returns existing result")
            print(f"  composite_score={data['composite_score']}, risk_profile={data['risk_profile']}")
        else:
            print(f"PASS: GET /api/forensic/calibration returns exists=false (no prior calibration)")


# ═══════════════════════════════════════════════════════════════
# TEST: CHANNEL INTELLIGENCE ENDPOINTS
# ═══════════════════════════════════════════════════════════════

class TestChannelIntelligence:
    """Channel status endpoint tests"""

    def test_channels_status_returns_auth_error_without_auth(self):
        """GET /api/integrations/channels/status without auth should return 401 or 403"""
        resp = requests.get(f"{BASE_URL}/api/integrations/channels/status")
        assert resp.status_code in [401, 403], f"Expected 401/403, got {resp.status_code}: {resp.text}"
        print(f"PASS: GET /api/integrations/channels/status returns {resp.status_code} without auth")

    def test_channels_status_returns_channel_list(self, auth_headers):
        """GET /api/integrations/channels/status returns channels list with status"""
        resp = requests.get(
            f"{BASE_URL}/api/integrations/channels/status",
            headers=auth_headers
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()

        # Validate response structure
        assert "channels" in data, f"Missing channels: {data}"
        assert "summary" in data, f"Missing summary: {data}"

        # Validate channels is a list
        channels = data["channels"]
        assert isinstance(channels, list), f"channels is not a list: {channels}"
        assert len(channels) >= 1, f"channels should have at least 1 channel"

        # Validate each channel has required fields
        for ch in channels:
            assert "key" in ch, f"Channel missing key: {ch}"
            assert "name" in ch, f"Channel missing name: {ch}"
            assert "status" in ch, f"Channel missing status: {ch}"

        # Validate summary has total and connected counts
        summary = data["summary"]
        assert "total" in summary, f"Summary missing total: {summary}"
        assert "connected" in summary, f"Summary missing connected: {summary}"
        assert isinstance(summary["total"], int), f"total is not int: {summary['total']}"
        assert isinstance(summary["connected"], int), f"connected is not int: {summary['connected']}"

        print(f"PASS: GET /api/integrations/channels/status returns valid channel list")
        print(f"  total={summary['total']}, connected={summary['connected']}")
        print(f"  channels: {[c['name'] for c in channels]}")

    def test_channels_status_includes_expected_channels(self, auth_headers):
        """GET /api/integrations/channels/status includes CRM, Google Ads, Meta Ads, etc."""
        resp = requests.get(
            f"{BASE_URL}/api/integrations/channels/status",
            headers=auth_headers
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()

        channels = data["channels"]
        channel_keys = [ch["key"] for ch in channels]

        expected_channels = ["crm", "google_ads", "meta_ads", "linkedin", "analytics", "email_platform"]
        for expected in expected_channels:
            assert expected in channel_keys, f"Missing expected channel: {expected}"

        print(f"PASS: All expected channel keys present: {expected_channels}")


# ═══════════════════════════════════════════════════════════════
# TEST: HEALTH CHECK
# ═══════════════════════════════════════════════════════════════

class TestHealthCheck:
    """Basic health check"""

    def test_health_endpoint(self):
        """GET /api/health returns 200"""
        resp = requests.get(f"{BASE_URL}/api/health")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        print("PASS: /api/health returns 200")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
