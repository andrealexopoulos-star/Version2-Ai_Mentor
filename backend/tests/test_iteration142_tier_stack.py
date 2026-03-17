"""
Iteration 142 - Tier Stack and Custom Tier Support Tests

Tests for:
1. Tier model: custom tier is supported in resolver logic and SMB Protect sits before Custom in user-facing pricing labels
2. Client-facing pricing no longer shows Growth label and no longer exposes Super Admin as a client plan label
3. Brain KPI policy still works after custom-tier support changes
4. Brain priorities endpoint still returns valid response after threshold-hit scoring changes
"""
import os
import pytest
import requests
import sys

sys.path.insert(0, '/app/backend')

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://data-pipeline-test-7.preview.emergentagent.com').rstrip('/')

# ============================================
# Tier Stack and Label Verification Tests
# ============================================

class TestTierStackDefinitions:
    """Verify tier_resolver.py has correct tier stack and labels per user spec."""
    
    def test_tier_order_includes_custom(self):
        """Verify TIERS list includes 'custom' tier."""
        from tier_resolver import TIERS
        
        assert 'custom' in TIERS, "custom tier should be in TIERS list"
        assert TIERS.index('custom') > TIERS.index('enterprise'), "custom should come after enterprise in tier list"
    
    def test_brain_plan_labels_no_growth(self):
        """Verify BRAIN_PLAN_LABELS does NOT contain 'Growth' label."""
        from tier_resolver import BRAIN_PLAN_LABELS
        
        labels = list(BRAIN_PLAN_LABELS.values())
        assert 'Growth' not in labels, "Growth label should NOT be in BRAIN_PLAN_LABELS"
    
    def test_brain_plan_labels_smb_protect_before_custom(self):
        """Verify SMB Protect is for 'enterprise' tier and Custom is separate."""
        from tier_resolver import BRAIN_PLAN_LABELS
        
        assert BRAIN_PLAN_LABELS.get('enterprise') == 'SMB Protect', "enterprise tier should show 'SMB Protect'"
        assert BRAIN_PLAN_LABELS.get('custom') == 'Custom', "custom tier should show 'Custom'"
    
    def test_super_admin_not_exposed_as_client_plan_label(self):
        """Verify super_admin resolves to 'Custom' label (not exposed client-facing)."""
        from tier_resolver import BRAIN_PLAN_LABELS
        
        super_admin_label = BRAIN_PLAN_LABELS.get('super_admin')
        assert super_admin_label == 'Custom', f"super_admin label should be 'Custom', got '{super_admin_label}'"
        assert super_admin_label != 'Super Admin', "super_admin should NOT be exposed as 'Super Admin' client-facing"
    
    def test_tier_stack_order_correct(self):
        """Verify tier stack order: Free → Foundation → Performance → SMB Protect → Custom."""
        from tier_resolver import BRAIN_PLAN_LABELS
        
        expected_labels_by_tier = {
            'free': 'Free',
            'starter': 'Foundation',
            'professional': 'Performance',
            'enterprise': 'SMB Protect',
            'custom': 'Custom',
        }
        
        for tier, expected_label in expected_labels_by_tier.items():
            actual_label = BRAIN_PLAN_LABELS.get(tier)
            assert actual_label == expected_label, f"Expected {tier} to have label '{expected_label}', got '{actual_label}'"


class TestCustomTierResolverLogic:
    """Verify tier resolver supports custom tier correctly."""
    
    def test_resolve_tier_custom(self):
        """Verify resolve_tier returns 'custom' for custom subscription tier."""
        from tier_resolver import resolve_tier
        
        user = {'email': 'custom@example.com', 'subscription_tier': 'custom'}
        tier = resolve_tier(user)
        assert tier == 'custom', f"Expected 'custom' tier, got '{tier}'"
    
    def test_tier_rank_custom(self):
        """Verify custom tier has correct rank (between enterprise and super_admin)."""
        from tier_resolver import tier_rank
        
        assert tier_rank('custom') == 4, "custom tier rank should be 4"
        assert tier_rank('enterprise') == 3, "enterprise tier rank should be 3"
        assert tier_rank('super_admin') == 99, "super_admin tier rank should be 99"
        
        # custom > enterprise
        assert tier_rank('custom') > tier_rank('enterprise')
        # super_admin > custom
        assert tier_rank('super_admin') > tier_rank('custom')
    
    def test_has_access_custom_tier(self):
        """Verify custom tier has access to all routes except super_admin."""
        from tier_resolver import has_access
        
        assert has_access('custom', 'free') == True
        assert has_access('custom', 'starter') == True
        assert has_access('custom', 'professional') == True
        assert has_access('custom', 'enterprise') == True
        assert has_access('custom', 'custom') == True
        # custom does NOT have access to super_admin routes
        assert has_access('custom', 'super_admin') == False
    
    def test_get_brain_metric_limit_custom(self):
        """Verify custom tier gets 100 KPI monitors."""
        from tier_resolver import get_brain_metric_limit
        
        assert get_brain_metric_limit('custom') == 100
        assert get_brain_metric_limit({'subscription_tier': 'custom'}) == 100
    
    def test_get_brain_plan_label_custom(self):
        """Verify get_brain_plan_label returns 'Custom' for custom tier."""
        from tier_resolver import get_brain_plan_label
        
        assert get_brain_plan_label('custom') == 'Custom'
        assert get_brain_plan_label({'subscription_tier': 'custom'}) == 'Custom'


# ============================================
# Auth Fixture
# ============================================

@pytest.fixture(scope="module")
def auth_token():
    """Login with super_admin account and get token."""
    response = requests.post(
        f"{BASE_URL}/api/auth/supabase/login",
        json={
            "email": "andre@thestrategysquad.com.au",
            "password": "MasterMind2025*"
        },
        timeout=20
    )
    if response.status_code != 200:
        pytest.skip(f"Login failed: {response.status_code}")
    
    data = response.json()
    token = data.get("session", {}).get("access_token")
    if not token:
        pytest.skip("No access token in login response")
    return token


# ============================================
# Brain KPI Policy API Tests
# ============================================

class TestBrainKpiPolicyAfterCustomTierSupport:
    """Test Brain KPI policy works after custom tier support changes."""
    
    def test_brain_kpis_returns_200(self, auth_token):
        """Verify GET /api/brain/kpis returns 200 OK."""
        response = requests.get(
            f"{BASE_URL}/api/brain/kpis",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=30
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    def test_brain_kpis_returns_plan_policy(self, auth_token):
        """Verify GET /api/brain/kpis returns plan_tier, plan_label, visible_metric_limit."""
        response = requests.get(
            f"{BASE_URL}/api/brain/kpis",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=30
        )
        assert response.status_code == 200
        
        data = response.json()
        
        assert "plan_tier" in data, "Missing plan_tier"
        assert "plan_label" in data, "Missing plan_label"
        assert "visible_metric_limit" in data, "Missing visible_metric_limit"
        
        # super_admin account should resolve to Custom with 100 KPIs
        plan_tier = data.get("plan_tier", "").lower()
        plan_label = data.get("plan_label", "")
        visible_limit = data.get("visible_metric_limit")
        
        assert plan_tier in ["super_admin", "custom"], f"Expected super_admin or custom tier, got {plan_tier}"
        assert plan_label == "Custom", f"Expected plan_label 'Custom', got '{plan_label}'"
        assert visible_limit == 100, f"Expected 100 KPIs, got {visible_limit}"
    
    def test_brain_kpis_no_growth_label_in_response(self, auth_token):
        """Verify GET /api/brain/kpis does NOT return 'Growth' in plan_label."""
        response = requests.get(
            f"{BASE_URL}/api/brain/kpis",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=30
        )
        assert response.status_code == 200
        
        data = response.json()
        plan_label = data.get("plan_label", "")
        
        assert plan_label != "Growth", f"plan_label should NOT be 'Growth', got '{plan_label}'"
    
    def test_brain_kpis_metrics_array_present(self, auth_token):
        """Verify GET /api/brain/kpis returns metrics array with threshold_config."""
        response = requests.get(
            f"{BASE_URL}/api/brain/kpis",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=30
        )
        assert response.status_code == 200
        
        data = response.json()
        metrics = data.get("metrics", [])
        
        assert isinstance(metrics, list)
        assert len(metrics) > 0, "metrics array should not be empty"
        
        # Check first metric has threshold_config
        first_metric = metrics[0]
        assert "threshold_config" in first_metric, "Missing threshold_config in metric"
        
        threshold = first_metric.get("threshold_config", {})
        assert "enabled" in threshold
        assert "comparator" in threshold


class TestBrainPrioritiesAfterThresholdHitChanges:
    """Test Brain priorities endpoint returns valid response after threshold-hit scoring changes."""
    
    def test_brain_priorities_returns_200(self, auth_token):
        """Verify GET /api/brain/priorities returns 200 OK."""
        response = requests.get(
            f"{BASE_URL}/api/brain/priorities",
            params={"recompute": "false"},
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=60
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    def test_brain_priorities_returns_brain_policy(self, auth_token):
        """Verify GET /api/brain/priorities includes brain_policy."""
        response = requests.get(
            f"{BASE_URL}/api/brain/priorities",
            params={"recompute": "false"},
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=60
        )
        assert response.status_code == 200
        
        data = response.json()
        
        assert "brain_policy" in data, "Missing brain_policy"
        policy = data.get("brain_policy", {})
        
        assert "plan_tier" in policy, "Missing plan_tier in brain_policy"
        assert "plan_label" in policy, "Missing plan_label in brain_policy"
        assert "visible_metric_limit" in policy, "Missing visible_metric_limit in brain_policy"
        
        # super_admin account should have 100 KPIs
        assert policy.get("visible_metric_limit") == 100
    
    def test_brain_priorities_returns_concerns_array(self, auth_token):
        """Verify GET /api/brain/priorities returns concerns array."""
        response = requests.get(
            f"{BASE_URL}/api/brain/priorities",
            params={"recompute": "false"},
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=60
        )
        assert response.status_code == 200
        
        data = response.json()
        
        assert "concerns" in data, "Missing concerns array"
        concerns = data.get("concerns", [])
        assert isinstance(concerns, list), "concerns should be an array"
        
        # If concerns exist, verify structure
        if len(concerns) > 0:
            first_concern = concerns[0]
            assert "concern_id" in first_concern
            assert "priority_score" in first_concern
            assert "impact" in first_concern
            assert "urgency" in first_concern
    
    def test_brain_priorities_tier_mode(self, auth_token):
        """Verify GET /api/brain/priorities returns correct tier_mode."""
        response = requests.get(
            f"{BASE_URL}/api/brain/priorities",
            params={"recompute": "false"},
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=60
        )
        assert response.status_code == 200
        
        data = response.json()
        
        tier_mode = data.get("tier_mode")
        # super_admin should resolve to 'custom' tier_mode
        assert tier_mode == "custom", f"Expected tier_mode 'custom', got '{tier_mode}'"


class TestBrainMetricsCoverage:
    """Test Brain metrics coverage endpoint."""
    
    def test_brain_metrics_coverage_returns_200(self, auth_token):
        """Verify GET /api/brain/metrics?include_coverage=true returns 200."""
        response = requests.get(
            f"{BASE_URL}/api/brain/metrics",
            params={"include_coverage": "true"},
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=30
        )
        assert response.status_code == 200
    
    def test_brain_metrics_coverage_includes_threshold_config(self, auth_token):
        """Verify metrics coverage includes threshold_config for each metric."""
        response = requests.get(
            f"{BASE_URL}/api/brain/metrics",
            params={"include_coverage": "true"},
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=30
        )
        assert response.status_code == 200
        
        data = response.json()
        metrics = data.get("metrics", [])
        
        assert len(metrics) > 0
        
        for metric in metrics[:5]:  # Check first 5
            assert "threshold_config" in metric, f"Missing threshold_config in {metric.get('metric_key')}"
            assert "threshold_state" in metric, f"Missing threshold_state in {metric.get('metric_key')}"


# ============================================
# Health Check
# ============================================

class TestHealthCheck:
    """Basic health check."""
    
    def test_health_endpoint(self):
        """Verify /api/health returns healthy."""
        response = requests.get(f"{BASE_URL}/api/health", timeout=30)
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
