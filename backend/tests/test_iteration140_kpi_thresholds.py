"""
Iteration 140 - KPI Threshold Configuration and Tier-Aware Policy Tests

Tests for:
1. Tier-aware KPI policy mapping (free 10, starter 25, professional 50, enterprise 75, custom/super_admin 100)
2. GET /api/brain/kpis returns plan_label, visible_metric_limit, threshold_config for metrics
3. PUT /api/brain/kpis saves KPI thresholds and persists them
4. GET /api/brain/metrics?include_coverage=true includes threshold_config metadata
5. GET /api/brain/priorities returns brain_policy metadata
"""
import os
import pytest
import requests
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://kpi-intelligence-1.preview.emergentagent.com').rstrip('/')

# ============================================
# Tier Mapping Tests (Unit-level logic verification)
# ============================================

class TestTierAwareKpiMapping:
    """Test tier_resolver.py has correct KPI limits per plan."""
    
    def test_brain_metric_limits_defined(self):
        """Verify BRAIN_METRIC_LIMITS dict exists with expected values."""
        import sys
        sys.path.insert(0, '/app/backend')
        from tier_resolver import BRAIN_METRIC_LIMITS, BRAIN_PLAN_LABELS
        
        expected_limits = {
            'free': 10,
            'starter': 25,
            'professional': 50,
            'enterprise': 75,
            'super_admin': 100,
        }
        
        for tier, expected_limit in expected_limits.items():
            actual = BRAIN_METRIC_LIMITS.get(tier)
            assert actual == expected_limit, f"Expected {tier} to have {expected_limit} KPIs, got {actual}"
    
    def test_brain_plan_labels_defined(self):
        """Verify BRAIN_PLAN_LABELS has expected human-readable names."""
        import sys
        sys.path.insert(0, '/app/backend')
        from tier_resolver import BRAIN_PLAN_LABELS
        
        expected_labels = {
            'free': 'Free',
            'starter': 'Foundation',
            'professional': 'Performance',
            'enterprise': 'Growth',
            'super_admin': 'Custom',
        }
        
        for tier, expected_label in expected_labels.items():
            actual = BRAIN_PLAN_LABELS.get(tier)
            assert actual == expected_label, f"Expected {tier} label to be '{expected_label}', got '{actual}'"
    
    def test_get_brain_metric_limit_function(self):
        """Verify get_brain_metric_limit() resolves correctly."""
        import sys
        sys.path.insert(0, '/app/backend')
        from tier_resolver import get_brain_metric_limit
        
        assert get_brain_metric_limit('free') == 10
        assert get_brain_metric_limit('starter') == 25
        assert get_brain_metric_limit('professional') == 50
        assert get_brain_metric_limit('enterprise') == 75
        assert get_brain_metric_limit('super_admin') == 100
        
        # Test with dict (user object)
        assert get_brain_metric_limit({'subscription_tier': 'free'}) == 10
        assert get_brain_metric_limit({'subscription_tier': 'enterprise'}) == 75


# ============================================
# Auth Fixture
# ============================================

@pytest.fixture(scope="module")
def auth_token():
    """Login with super_admin/custom account and get token."""
    response = requests.post(
        f"{BASE_URL}/api/auth/supabase/login",
        json={
            "email": "andre@thestrategysquad.com.au",
            "password": "MasterMind2025*"
        },
        timeout=15
    )
    if response.status_code != 200:
        pytest.skip(f"Login failed: {response.status_code} - {response.text}")
    
    data = response.json()
    token = data.get("session", {}).get("access_token")
    if not token:
        pytest.skip("No access token in login response")
    return token


# ============================================
# GET /api/brain/kpis Tests
# ============================================

class TestGetBrainKpis:
    """Test GET /api/brain/kpis endpoint."""
    
    def test_kpis_endpoint_returns_200(self, auth_token):
        """Verify GET /api/brain/kpis returns 200 OK."""
        response = requests.get(
            f"{BASE_URL}/api/brain/kpis",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=30
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_kpis_returns_plan_policy_fields(self, auth_token):
        """Verify response contains plan_tier, plan_label, visible_metric_limit."""
        response = requests.get(
            f"{BASE_URL}/api/brain/kpis",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=30
        )
        assert response.status_code == 200
        
        data = response.json()
        
        # Required policy fields
        assert "plan_tier" in data, "Missing plan_tier"
        assert "plan_label" in data, "Missing plan_label"
        assert "visible_metric_limit" in data, "Missing visible_metric_limit"
        
        print(f"Plan: {data.get('plan_label')} ({data.get('plan_tier')})")
        print(f"Visible metric limit: {data.get('visible_metric_limit')}")
    
    def test_kpis_super_admin_has_100_visible_metrics(self, auth_token):
        """Super admin account should have visible_metric_limit=100."""
        response = requests.get(
            f"{BASE_URL}/api/brain/kpis",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=30
        )
        assert response.status_code == 200
        
        data = response.json()
        
        # super_admin resolves to 'custom' tier with 100 KPIs
        # or super_admin tier directly with 100 KPIs
        visible_limit = data.get("visible_metric_limit")
        plan_tier = data.get("plan_tier", "").lower()
        
        # For this test account, expect either super_admin or custom
        assert plan_tier in ["super_admin", "custom", "enterprise"], \
            f"Expected super_admin/custom/enterprise tier, got {plan_tier}"
        
        # Super admin should have 100 KPIs
        assert visible_limit == 100, \
            f"Expected visible_metric_limit=100 for super_admin, got {visible_limit}"
    
    def test_kpis_returns_metrics_array(self, auth_token):
        """Verify response contains metrics array with threshold_config."""
        response = requests.get(
            f"{BASE_URL}/api/brain/kpis",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=30
        )
        assert response.status_code == 200
        
        data = response.json()
        metrics = data.get("metrics", [])
        
        assert isinstance(metrics, list), "metrics should be an array"
        assert len(metrics) > 0, "metrics array should not be empty"
        
        # Verify first metric has expected structure
        first_metric = metrics[0]
        assert "metric_id" in first_metric, "Missing metric_id"
        assert "metric_name" in first_metric, "Missing metric_name"
        assert "metric_key" in first_metric, "Missing metric_key"
        assert "category" in first_metric, "Missing category"
        assert "threshold_config" in first_metric, "Missing threshold_config"
        
        # Verify threshold_config structure
        threshold = first_metric.get("threshold_config", {})
        assert "enabled" in threshold, "threshold_config missing enabled"
        assert "comparator" in threshold, "threshold_config missing comparator"
        assert "warning_value" in threshold, "threshold_config missing warning_value"
        assert "critical_value" in threshold, "threshold_config missing critical_value"
        
        print(f"Total metrics returned: {len(metrics)}")
        print(f"Sample metric: {first_metric.get('metric_name')} [{first_metric.get('metric_key')}]")


# ============================================
# PUT /api/brain/kpis Tests
# ============================================

class TestPutBrainKpis:
    """Test PUT /api/brain/kpis endpoint for saving thresholds."""
    
    def test_save_single_threshold(self, auth_token):
        """Save a threshold for total_revenue and verify it persists."""
        # First, get current config to find a valid metric_key
        get_response = requests.get(
            f"{BASE_URL}/api/brain/kpis",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=30
        )
        assert get_response.status_code == 200
        
        data = get_response.json()
        metrics = data.get("metrics", [])
        assert len(metrics) > 0, "Need at least one metric to test"
        
        # Use total_revenue if available, else first metric
        test_metric_key = "total_revenue"
        found_key = None
        for m in metrics:
            if m.get("metric_key") == test_metric_key:
                found_key = test_metric_key
                break
        if not found_key:
            found_key = metrics[0].get("metric_key")
        
        # Save a threshold
        put_payload = {
            "thresholds": [
                {
                    "metric_key": found_key,
                    "enabled": True,
                    "comparator": "below",
                    "warning_value": 50000,
                    "critical_value": 25000,
                    "note": "Test threshold from iteration 140"
                }
            ]
        }
        
        put_response = requests.put(
            f"{BASE_URL}/api/brain/kpis",
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            },
            json=put_payload,
            timeout=30
        )
        assert put_response.status_code == 200, f"PUT failed: {put_response.status_code} - {put_response.text}"
        
        put_data = put_response.json()
        assert "message" in put_data, "Expected success message in response"
        print(f"PUT response message: {put_data.get('message')}")
        
        # Now GET again and verify threshold was saved
        time.sleep(0.5)  # Small delay for persistence
        
        verify_response = requests.get(
            f"{BASE_URL}/api/brain/kpis",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=30
        )
        assert verify_response.status_code == 200
        
        verify_data = verify_response.json()
        verify_metrics = verify_data.get("metrics", [])
        
        # Find the metric we saved
        saved_metric = None
        for m in verify_metrics:
            if m.get("metric_key") == found_key:
                saved_metric = m
                break
        
        assert saved_metric is not None, f"Could not find saved metric {found_key}"
        
        threshold = saved_metric.get("threshold_config", {})
        assert threshold.get("enabled") == True, "Expected enabled=True"
        assert threshold.get("comparator") == "below", "Expected comparator=below"
        assert threshold.get("warning_value") == 50000, f"Expected warning_value=50000, got {threshold.get('warning_value')}"
        assert threshold.get("critical_value") == 25000, f"Expected critical_value=25000, got {threshold.get('critical_value')}"
        
        print(f"Verified threshold for {found_key}: {threshold}")
    
    def test_disable_threshold(self, auth_token):
        """Disable a threshold and verify it persists."""
        # First get a metric to test
        get_response = requests.get(
            f"{BASE_URL}/api/brain/kpis",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=30
        )
        assert get_response.status_code == 200
        
        metrics = get_response.json().get("metrics", [])
        test_key = metrics[0].get("metric_key") if metrics else "total_revenue"
        
        # First enable it
        requests.put(
            f"{BASE_URL}/api/brain/kpis",
            headers={"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"},
            json={"thresholds": [{"metric_key": test_key, "enabled": True, "warning_value": 100}]},
            timeout=30
        )
        
        # Now disable it
        put_response = requests.put(
            f"{BASE_URL}/api/brain/kpis",
            headers={"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"},
            json={"thresholds": [{"metric_key": test_key, "enabled": False}]},
            timeout=30
        )
        assert put_response.status_code == 200
        
        # Verify disabled
        time.sleep(0.3)
        verify_response = requests.get(
            f"{BASE_URL}/api/brain/kpis",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=30
        )
        
        verify_data = verify_response.json()
        for m in verify_data.get("metrics", []):
            if m.get("metric_key") == test_key:
                assert m.get("threshold_config", {}).get("enabled") == False, "Expected disabled threshold"
                print(f"Verified threshold disabled for {test_key}")
                break


# ============================================
# GET /api/brain/metrics?include_coverage=true Tests
# ============================================

class TestBrainMetricsWithCoverage:
    """Test /api/brain/metrics with include_coverage=true includes threshold_config."""
    
    def test_metrics_coverage_has_threshold_config(self, auth_token):
        """Verify metrics coverage response includes threshold_config for each metric."""
        response = requests.get(
            f"{BASE_URL}/api/brain/metrics",
            params={"include_coverage": "true"},
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=30
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        metrics = data.get("metrics", [])
        
        assert len(metrics) > 0, "Expected metrics in response"
        
        # Check first few metrics have threshold_config
        for metric in metrics[:3]:
            assert "threshold_config" in metric, f"Missing threshold_config in metric {metric.get('metric_key')}"
            assert "threshold_state" in metric, f"Missing threshold_state in metric {metric.get('metric_key')}"
            
            threshold = metric.get("threshold_config", {})
            assert "enabled" in threshold
            assert "comparator" in threshold
        
        print(f"Verified threshold_config present in {len(metrics)} metrics")
    
    def test_metrics_coverage_respects_visible_limit(self, auth_token):
        """Verify metrics coverage returns only visible_metric_limit metrics."""
        response = requests.get(
            f"{BASE_URL}/api/brain/metrics",
            params={"include_coverage": "true"},
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=30
        )
        assert response.status_code == 200
        
        data = response.json()
        
        visible_limit = data.get("visible_metric_limit")
        metrics_count = len(data.get("metrics", []))
        total_metrics = data.get("total_metrics")
        
        # For super_admin, visible_limit should be 100
        print(f"visible_metric_limit: {visible_limit}")
        print(f"total_metrics (visible): {total_metrics}")
        print(f"metrics array length: {metrics_count}")
        
        # The metrics array should match visible_limit (for this user, 100)
        assert metrics_count == visible_limit, \
            f"Expected {visible_limit} metrics, got {metrics_count}"


# ============================================
# GET /api/brain/priorities Tests
# ============================================

class TestBrainPrioritiesBrainPolicy:
    """Test /api/brain/priorities returns brain_policy metadata."""
    
    def test_priorities_returns_brain_policy(self, auth_token):
        """Verify priorities response includes brain_policy with tier info."""
        response = requests.get(
            f"{BASE_URL}/api/brain/priorities",
            params={"recompute": "false"},
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=45
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # brain_policy should be present
        assert "brain_policy" in data, "Missing brain_policy in priorities response"
        
        policy = data.get("brain_policy", {})
        assert "plan_tier" in policy, "Missing plan_tier in brain_policy"
        assert "plan_label" in policy, "Missing plan_label in brain_policy"
        assert "visible_metric_limit" in policy, "Missing visible_metric_limit in brain_policy"
        
        print(f"brain_policy: {policy}")
        
        # For super_admin, expect 100 visible metrics
        assert policy.get("visible_metric_limit") == 100, \
            f"Expected 100 visible metrics for super_admin, got {policy.get('visible_metric_limit')}"


# ============================================
# Health Check Test
# ============================================

class TestHealthCheck:
    """Basic health check test."""
    
    def test_health_endpoint(self):
        """Verify /api/health returns healthy status."""
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
