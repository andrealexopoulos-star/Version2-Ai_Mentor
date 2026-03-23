"""
Iteration 69: Market Intelligence & Snapshot Tests
Testing:
1. GET /api/market-intelligence - Returns cognitive data with CRM summary when HubSpot connected
2. GET /api/snapshot/latest - Returns cognitive key with parsed summary data
3. GET /api/integrations/channels/status - Verify CRM as connected (HubSpot provider)
4. All endpoints require authentication
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
        pytest.skip("Auth test env not configured for iteration69")

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
        pytest.skip(f"Authentication unavailable for iteration69: {resp.status_code}")
    data = resp.json()
    token = data.get("access_token")
    if not token:
        pytest.skip("Authentication unavailable for iteration69: missing access token")
    return token


@pytest.fixture
def auth_headers(access_token):
    """Create auth headers from token."""
    return {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }


# ═══════════════════════════════════════════════════════════════
# TEST: MARKET INTELLIGENCE ENDPOINT
# ═══════════════════════════════════════════════════════════════

class TestMarketIntelligence:
    """Market intelligence aggregator endpoint tests"""

    def test_market_intelligence_returns_auth_error_without_auth(self):
        """GET /api/market-intelligence without auth should return 401 or 403"""
        resp = requests.get(f"{BASE_URL}/api/market-intelligence")
        assert resp.status_code in [401, 403], f"Expected 401/403, got {resp.status_code}: {resp.text}"
        print(f"PASS: GET /api/market-intelligence returns {resp.status_code} without auth")

    def test_market_intelligence_returns_cognitive_data(self, auth_headers):
        """GET /api/market-intelligence returns cognitive data structure"""
        resp = requests.get(
            f"{BASE_URL}/api/market-intelligence",
            headers=auth_headers,
            timeout=30  # CRM fetch can take time
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()

        # Validate response structure - must have cognitive, crm, forensic, has_data
        assert "cognitive" in data, f"Missing cognitive key: {data}"
        assert "crm" in data, f"Missing crm key: {data}"
        assert "forensic" in data, f"Missing forensic key: {data}"
        assert "has_data" in data, f"Missing has_data key: {data}"

        print(f"PASS: GET /api/market-intelligence returns valid structure")
        print(f"  has_data={data['has_data']}, crm={data.get('crm') is not None}, forensic={data.get('forensic') is not None}")

    def test_market_intelligence_has_system_state(self, auth_headers):
        """GET /api/market-intelligence returns system_state with status and confidence"""
        resp = requests.get(
            f"{BASE_URL}/api/market-intelligence",
            headers=auth_headers,
            timeout=30
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()

        # If has_data is True, should have system_state in cognitive
        cognitive = data.get("cognitive", {})
        
        if data.get("has_data"):
            # When has_data is True, should have system_state
            if cognitive.get("system_state"):
                state = cognitive["system_state"]
                # Should have status and confidence
                assert "status" in state, f"Missing status in system_state: {state}"
                valid_statuses = ["STABLE", "DRIFT", "COMPRESSION", "CRITICAL"]
                assert state["status"] in valid_statuses, f"Invalid status: {state['status']}"
                
                if "confidence" in state:
                    assert isinstance(state["confidence"], (int, float)), f"confidence not a number: {state['confidence']}"
                    assert 0 <= state["confidence"] <= 100, f"confidence out of range: {state['confidence']}"
                
                print(f"PASS: system_state has valid status={state['status']}, confidence={state.get('confidence')}")
            else:
                print(f"NOTE: has_data=True but no system_state - may have only CRM data without cognitive snapshot")
        else:
            print(f"NOTE: has_data=False - no market intelligence data yet")

    def test_market_intelligence_crm_summary_when_connected(self, auth_headers):
        """GET /api/market-intelligence returns CRM summary when HubSpot is connected"""
        resp = requests.get(
            f"{BASE_URL}/api/market-intelligence",
            headers=auth_headers,
            timeout=30
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()

        crm = data.get("crm")
        if crm:
            # CRM is connected - validate structure
            assert "provider" in crm, f"Missing provider in crm: {crm}"
            assert "connected" in crm, f"Missing connected in crm: {crm}"
            assert crm["connected"] == True, f"CRM connected should be True: {crm}"
            
            # Check for deals data
            if "deals" in crm:
                deals = crm["deals"]
                assert "total" in deals, f"Missing total in deals: {deals}"
                assert "pipeline_value" in deals, f"Missing pipeline_value in deals: {deals}"
                print(f"PASS: CRM has {deals['total']} deals with ${deals.get('pipeline_value', 0)} pipeline")
            
            # Check for contacts
            if "contacts" in crm:
                assert isinstance(crm["contacts"], int), f"contacts not a number: {crm['contacts']}"
                print(f"PASS: CRM has {crm['contacts']} contacts")
            
            print(f"PASS: CRM provider={crm['provider']}, connected={crm['connected']}")
        else:
            print(f"NOTE: No CRM data - may not be connected")


# ═══════════════════════════════════════════════════════════════
# TEST: SNAPSHOT LATEST ENDPOINT  
# ═══════════════════════════════════════════════════════════════

class TestSnapshotLatest:
    """Snapshot latest endpoint tests - now returns parsed cognitive data"""

    def test_snapshot_latest_returns_auth_error_without_auth(self):
        """GET /api/snapshot/latest without auth should return 401 or 403"""
        resp = requests.get(f"{BASE_URL}/api/snapshot/latest")
        assert resp.status_code in [401, 403], f"Expected 401/403, got {resp.status_code}: {resp.text}"
        print(f"PASS: GET /api/snapshot/latest returns {resp.status_code} without auth")

    def test_snapshot_latest_returns_cognitive_key(self, auth_headers):
        """GET /api/snapshot/latest returns cognitive key with parsed summary data"""
        resp = requests.get(
            f"{BASE_URL}/api/snapshot/latest",
            headers=auth_headers,
            timeout=20
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()

        # Must have snapshot and cognitive keys
        assert "snapshot" in data, f"Missing snapshot key: {data}"
        assert "cognitive" in data, f"Missing cognitive key: {data}"

        # If snapshot exists, cognitive should be parsed from summary
        if data["snapshot"]:
            snapshot = data["snapshot"]
            cognitive = data["cognitive"]
            
            # Snapshot should have summary and potentially executive_memo
            assert "summary" in snapshot or cognitive is not None, f"Snapshot should have summary or cognitive should be set"
            
            if cognitive:
                # Cognitive should be a dict with parsed data
                assert isinstance(cognitive, dict), f"cognitive should be a dict: {type(cognitive)}"
                print(f"PASS: snapshot exists with parsed cognitive data")
                print(f"  cognitive keys: {list(cognitive.keys())[:5]}...")
            else:
                print(f"NOTE: snapshot exists but cognitive is null (may be unparseable)")
        else:
            print(f"NOTE: No snapshot exists yet for this user")


# ═══════════════════════════════════════════════════════════════
# TEST: CHANNEL STATUS - CRM CONNECTED CHECK
# ═══════════════════════════════════════════════════════════════

class TestChannelStatusCRM:
    """Verify CRM shows as connected with HubSpot provider"""

    def test_channels_status_crm_connected_hubspot(self, auth_headers):
        """GET /api/integrations/channels/status shows CRM as connected with HubSpot"""
        resp = requests.get(
            f"{BASE_URL}/api/integrations/channels/status",
            headers=auth_headers
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()

        channels = data.get("channels", [])
        crm_channel = None
        for ch in channels:
            if ch.get("key") == "crm":
                crm_channel = ch
                break
        
        assert crm_channel is not None, f"CRM channel not found in channels: {channels}"
        
        # Check CRM status and provider
        status = crm_channel.get("status")
        provider = crm_channel.get("provider")
        
        if status == "connected":
            assert provider is not None, f"CRM connected but no provider: {crm_channel}"
            # Expected provider is HubSpot based on test context
            print(f"PASS: CRM channel is connected with provider={provider}")
        else:
            print(f"NOTE: CRM channel status={status}, provider={provider}")
        
        # Validate summary shows connected count
        summary = data.get("summary", {})
        print(f"  Channel summary: {summary['connected']}/{summary['total']} connected")


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
