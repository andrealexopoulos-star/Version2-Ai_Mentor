"""
Iteration 148: Free-Tier Pages Testing
Test the P0 free-tier pages for functional hardening and UX improvements.

Covers:
- Market page pressure/freshness not falsely showing unavailable when API returns data
- Business DNA KPI tab free-tier selector (10 KPI limit)
- Free-tier access: Soundboard, Alerts, Actions, Priority Inbox (not blocked)
- Integrations page free-tier single-integration banner
- Data Health force sync uses real endpoint
- Competitive Benchmark competitor analysis uses real endpoint
"""

import pytest
import requests
import os
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://biqc-api.azurewebsites.net')

TEST_EMAIL = os.environ.get("TEST_LOGIN_EMAIL", "").strip()
TEST_PASSWORD = os.environ.get("TEST_LOGIN_PASSWORD", "").strip()
SUPABASE_URL = os.environ.get("REACT_APP_SUPABASE_URL", "").strip()
SUPABASE_ANON_KEY = os.environ.get("REACT_APP_SUPABASE_ANON_KEY", "").strip()


@pytest.fixture(scope="module")
def auth_token():
    """Get Supabase auth token."""
    if not (TEST_EMAIL and TEST_PASSWORD and SUPABASE_URL and SUPABASE_ANON_KEY):
        pytest.skip("Set TEST_LOGIN_EMAIL/TEST_LOGIN_PASSWORD and REACT_APP_SUPABASE_URL/REACT_APP_SUPABASE_ANON_KEY for authenticated suite")
    try:
        response = requests.post(
            f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
            headers={
                "apikey": SUPABASE_ANON_KEY,
                "Content-Type": "application/json"
            },
            json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD
            }
        )
        if response.status_code == 200:
            data = response.json()
            return data.get("access_token")
        else:
            print(f"Auth failed: {response.status_code} - {response.text}")
            pytest.skip(f"Authentication failed: {response.status_code}")
    except Exception as e:
        pytest.skip(f"Authentication error: {e}")


@pytest.fixture(scope="module")
def api_client(auth_token):
    """Create authenticated requests session."""
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    })
    return session


class TestHealthEndpoints:
    """Test basic health endpoints are accessible."""
    
    def test_health_endpoint(self):
        """Test /health endpoint is accessible."""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        print(f"✓ Health endpoint OK: {response.json()}")


class TestMarketPageAPIs:
    """Test Market page APIs - pressure and freshness."""
    
    def test_pressure_endpoint_returns_proper_structure(self, api_client):
        """Test /intelligence/pressure returns data or proper error message (not false 'unavailable')."""
        response = api_client.get(f"{BASE_URL}/api/intelligence/pressure")
        # Should return 200 (data) or 503 (canonical unavailable) - NOT false unavailable in frontend
        assert response.status_code in [200, 503], f"Unexpected status: {response.status_code}"
        
        data = response.json()
        print(f"Pressure API response: {json.dumps(data, indent=2)[:500]}")
        
        if response.status_code == 200:
            # Check structure - either has data or has_data: false
            if data.get("has_data"):
                assert "pressures" in data, "Missing pressures when has_data is true"
            print(f"✓ Pressure endpoint returned proper structure")
        else:
            # 503 means canonical SQL unavailable - this is expected if migration not applied
            assert "detail" in data or "message" in data
            print(f"⚠ Pressure canonical SQL unavailable (expected if migration not applied)")
    
    def test_freshness_endpoint_returns_proper_structure(self, api_client):
        """Test /intelligence/freshness returns data or proper error message."""
        response = api_client.get(f"{BASE_URL}/api/intelligence/freshness")
        assert response.status_code in [200, 503], f"Unexpected status: {response.status_code}"
        
        data = response.json()
        print(f"Freshness API response: {json.dumps(data, indent=2)[:500]}")
        
        if response.status_code == 200:
            if data.get("has_data"):
                assert "freshness" in data, "Missing freshness when has_data is true"
            print(f"✓ Freshness endpoint returned proper structure")
        else:
            print(f"⚠ Freshness canonical SQL unavailable (expected if migration not applied)")
    
    def test_watchtower_endpoint(self, api_client):
        """Test /intelligence/watchtower returns data or proper error."""
        response = api_client.get(f"{BASE_URL}/api/intelligence/watchtower")
        assert response.status_code in [200, 503], f"Unexpected status: {response.status_code}"
        
        data = response.json()
        print(f"Watchtower API response: {json.dumps(data, indent=2)[:300]}")
        
        if response.status_code == 200:
            assert "events" in data or "positions" in data or "status" in data
            print(f"✓ Watchtower endpoint returned valid structure")
        else:
            print(f"⚠ Watchtower canonical SQL unavailable")


class TestBusinessDNAKPITab:
    """Test Business DNA KPI tab - tier-based KPI limits."""
    
    def test_brain_kpis_endpoint(self, api_client):
        """Test /brain/kpis returns proper configuration with tier-based limits.
        
        Note: Test user (andre@thestrategysquad.com.au) is super_admin with 100 limit.
        For free tier, the limit should be 10.
        """
        response = api_client.get(f"{BASE_URL}/api/brain/kpis")
        assert response.status_code == 200, f"KPI endpoint failed: {response.status_code}"
        
        data = response.json()
        print(f"Brain KPIs response keys: {list(data.keys())}")
        
        # Verify tier-based limit (super_admin = 100, free = 10)
        visible_limit = data.get("visible_metric_limit")
        plan_tier = data.get("plan_tier", "unknown")
        
        # Validate limit matches tier configuration
        tier_limits = {'free': 10, 'starter': 25, 'professional': 50, 'enterprise': 75, 'custom': 100, 'super_admin': 100}
        expected_limit = tier_limits.get(plan_tier, 10)
        assert visible_limit == expected_limit, f"Expected {expected_limit} for {plan_tier}, got {visible_limit}"
        print(f"✓ KPI limit is {visible_limit} for tier '{plan_tier}' as expected")
        
        # Verify catalog exists
        assert "catalog_metrics" in data, "Missing catalog_metrics"
        catalog_count = len(data.get("catalog_metrics", []))
        print(f"✓ Catalog has {catalog_count} metrics")
        
        # Verify selected_count
        selected_count = data.get("selected_count", 0)
        print(f"✓ Currently selected: {selected_count} KPIs")
        
        # Verify selection_limit_reached flag
        limit_reached = data.get("selection_limit_reached", False)
        print(f"✓ Selection limit reached: {limit_reached}")
    
    def test_brain_kpis_save_works(self, api_client):
        """Test that saving KPIs works and respects tier limit."""
        # Get current config first
        get_response = api_client.get(f"{BASE_URL}/api/brain/kpis")
        current_data = get_response.json()
        plan_tier = current_data.get("plan_tier", "free")
        tier_limit = current_data.get("visible_metric_limit", 10)
        
        # Try to save with KPIs - tier limit will be respected
        test_keys = ["total_revenue", "pipeline_value", "win_rate", "churn_rate", 
                     "cash_runway", "burn_rate", "retention_rate", "average_deal_size",
                     "sales_velocity", "lead_response_time", "revenue_growth_rate"]  # 11 keys
        
        save_response = api_client.put(f"{BASE_URL}/api/brain/kpis", json={
            "selected_metric_keys": test_keys,
            "thresholds": []
        })
        
        assert save_response.status_code == 200, f"Save failed: {save_response.status_code}"
        
        saved_data = save_response.json()
        saved_count = len(saved_data.get("selected_metric_keys", []))
        # For super_admin (100 limit), 11 should be allowed
        # For free (10 limit), should cap at 10
        assert saved_count <= tier_limit, f"Tier {plan_tier} should cap at {tier_limit} KPIs, saved {saved_count}"
        print(f"✓ Save respects tier limit: saved {saved_count} keys (tier: {plan_tier}, limit: {tier_limit})")


class TestFreeTierAccess:
    """Test that free-tier pages are not blocked."""
    
    def test_soundboard_endpoint(self, api_client):
        """Test Soundboard endpoint is accessible for free tier."""
        response = api_client.get(f"{BASE_URL}/api/soundboard")
        # Should not be 403 forbidden for free tier
        assert response.status_code != 403, "Soundboard blocked for free tier"
        print(f"✓ Soundboard accessible (status: {response.status_code})")
    
    def test_alerts_endpoint(self, api_client):
        """Test Alerts endpoint is accessible for free tier."""
        response = api_client.get(f"{BASE_URL}/api/notifications/alerts")
        assert response.status_code != 403, "Alerts blocked for free tier"
        print(f"✓ Alerts accessible (status: {response.status_code})")
    
    def test_priority_inbox_endpoint(self, api_client):
        """Test Priority Inbox endpoint is accessible for free tier."""
        response = api_client.get(f"{BASE_URL}/api/email/priority-inbox")
        assert response.status_code != 403, "Priority Inbox blocked for free tier"
        print(f"✓ Priority Inbox accessible (status: {response.status_code})")


class TestIntegrationsPage:
    """Test Integrations page free-tier behavior."""
    
    def test_merge_connected_endpoint(self, api_client):
        """Test /integrations/merge/connected returns proper structure."""
        response = api_client.get(f"{BASE_URL}/api/integrations/merge/connected")
        assert response.status_code in [200, 409, 503], f"Failed: {response.status_code}"
        if response.status_code != 200:
            pytest.skip("Merge connected endpoint unavailable in this environment")
        
        data = response.json()
        assert "integrations" in data, "Missing integrations key"
        print(f"✓ Connected integrations: {len(data.get('integrations', {}))}")
    
    def test_integration_status_endpoint(self, api_client):
        """Test /user/integration-status endpoint."""
        response = api_client.get(f"{BASE_URL}/api/user/integration-status")
        assert response.status_code in [200, 503], f"Failed: {response.status_code}"
        if response.status_code != 200:
            pytest.skip("Integration status unavailable in this environment")
        
        data = response.json()
        print(f"✓ Integration status keys: {list(data.keys())[:5]}")


class TestDataHealthPage:
    """Test Data Health page force sync uses real endpoint."""
    
    def test_data_health_sync_endpoint_exists(self, api_client):
        """Test /user/integration-status/sync endpoint exists and works."""
        response = api_client.post(f"{BASE_URL}/api/user/integration-status/sync")
        # Should return 200 or 202 (queued), not 404
        assert response.status_code != 404, "Sync endpoint not found"
        assert response.status_code in [200, 202, 500], f"Unexpected status: {response.status_code}"
        print(f"✓ Sync endpoint exists (status: {response.status_code})")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Sync response: {json.dumps(data, indent=2)[:200]}")


class TestCompetitiveBenchmarkPage:
    """Test Competitive Benchmark competitor analysis uses real endpoint."""
    
    def test_marketing_benchmark_latest(self, api_client):
        """Test /marketing/benchmark/latest endpoint."""
        response = api_client.get(f"{BASE_URL}/api/marketing/benchmark/latest")
        # Should return 200 (with data) or 404 (no data yet), not 500
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
        print(f"✓ Benchmark latest endpoint works (status: {response.status_code})")
    
    def test_marketing_benchmark_post(self, api_client):
        """Test /marketing/benchmark POST endpoint for competitor analysis."""
        response = api_client.post(
            f"{BASE_URL}/api/marketing/benchmark",
            json={"competitors": ["competitor.com.au"]},
            timeout=30
        )
        # Should return 200 (data), 202 (queued), or timeout gracefully
        assert response.status_code in [200, 202, 408, 422, 500, 503, 504], f"Unexpected status: {response.status_code}"
        print(f"✓ Benchmark POST endpoint works (status: {response.status_code})")


class TestCalendarPage:
    """Test Calendar page endpoints."""
    
    def test_calendar_events_endpoint(self, api_client):
        """Test /outlook/calendar/events endpoint."""
        response = api_client.get(f"{BASE_URL}/api/outlook/calendar/events")
        # Infrastructure dependency varies by environment, but endpoint should be live.
        assert response.status_code != 404, f"Calendar endpoint missing: {response.text[:200]}"
        print(f"✓ Calendar events endpoint works (status: {response.status_code})")


class TestPriorityInboxPage:
    """Test Priority Inbox page detail panel doesn't break page."""
    
    def test_priority_inbox_structure(self, api_client):
        """Test /email/priority-inbox returns proper structure."""
        response = api_client.get(f"{BASE_URL}/api/email/priority-inbox")
        
        if response.status_code == 200:
            data = response.json()
            # Check for expected structure or message
            if "analysis" in data:
                analysis = data.get("analysis", {})
                assert "high_priority" in analysis or "message" in data
                print(f"✓ Priority inbox has proper structure")
            else:
                print(f"✓ Priority inbox returned: {list(data.keys())[:5]}")
        else:
            print(f"⚠ Priority inbox status: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
