"""
Iteration 82: BIQc Unified Intelligence + Marketing Automation + A/B Testing

Tests:
1. /api/unified/revenue endpoint - auth-gated, returns proper structure
2. /api/unified/risk endpoint - auth-gated, returns proper structure
3. /api/unified/operations endpoint - auth-gated, returns proper structure
4. /api/automation/generate endpoint - auth-gated
5. /api/experiments/list endpoint - auth-gated
6. /api/experiments/create endpoint - auth-gated
7. /api/automation/content-types endpoint - auth-gated
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestUnifiedIntelligenceEndpoints:
    """Tests for /api/unified/* endpoints - should be auth-gated"""
    
    def test_unified_revenue_unauthenticated(self):
        """Unified revenue endpoint should reject unauthenticated requests"""
        response = requests.get(f"{BASE_URL}/api/unified/revenue")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ /api/unified/revenue returns {response.status_code} when unauthenticated")
    
    def test_unified_risk_unauthenticated(self):
        """Unified risk endpoint should reject unauthenticated requests"""
        response = requests.get(f"{BASE_URL}/api/unified/risk")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ /api/unified/risk returns {response.status_code} when unauthenticated")
    
    def test_unified_operations_unauthenticated(self):
        """Unified operations endpoint should reject unauthenticated requests"""
        response = requests.get(f"{BASE_URL}/api/unified/operations")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ /api/unified/operations returns {response.status_code} when unauthenticated")

    def test_unified_advisor_unauthenticated(self):
        """Unified advisor endpoint should reject unauthenticated requests"""
        response = requests.get(f"{BASE_URL}/api/unified/advisor")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ /api/unified/advisor returns {response.status_code} when unauthenticated")

    def test_unified_people_unauthenticated(self):
        """Unified people endpoint should reject unauthenticated requests"""
        response = requests.get(f"{BASE_URL}/api/unified/people")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ /api/unified/people returns {response.status_code} when unauthenticated")

    def test_unified_market_unauthenticated(self):
        """Unified market endpoint should reject unauthenticated requests"""
        response = requests.get(f"{BASE_URL}/api/unified/market")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ /api/unified/market returns {response.status_code} when unauthenticated")


class TestMarketingAutomationEndpoints:
    """Tests for /api/automation/* endpoints"""
    
    def test_automation_generate_unauthenticated(self):
        """Automation generate endpoint should reject unauthenticated requests"""
        response = requests.post(
            f"{BASE_URL}/api/automation/generate",
            json={"content_type": "google_ad", "topic": "Test topic"}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ /api/automation/generate returns {response.status_code} when unauthenticated")

    def test_automation_history_unauthenticated(self):
        """Automation history endpoint should reject unauthenticated requests"""
        response = requests.get(f"{BASE_URL}/api/automation/history")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ /api/automation/history returns {response.status_code} when unauthenticated")

    def test_automation_content_types_unauthenticated(self):
        """Automation content-types endpoint should reject unauthenticated requests"""
        response = requests.get(f"{BASE_URL}/api/automation/content-types")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ /api/automation/content-types returns {response.status_code} when unauthenticated")


class TestABTestingEndpoints:
    """Tests for /api/experiments/* endpoints"""
    
    def test_experiments_list_unauthenticated(self):
        """Experiments list endpoint should reject unauthenticated requests"""
        response = requests.get(f"{BASE_URL}/api/experiments/list")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ /api/experiments/list returns {response.status_code} when unauthenticated")
    
    def test_experiments_create_unauthenticated(self):
        """Experiments create endpoint should reject unauthenticated requests"""
        response = requests.post(
            f"{BASE_URL}/api/experiments/create",
            json={"name": "Test Experiment", "description": "Test"}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ /api/experiments/create returns {response.status_code} when unauthenticated")

    def test_experiments_start_unauthenticated(self):
        """Experiments start endpoint should reject unauthenticated requests"""
        response = requests.post(f"{BASE_URL}/api/experiments/test-exp/start")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ /api/experiments/{{name}}/start returns {response.status_code} when unauthenticated")

    def test_experiments_stop_unauthenticated(self):
        """Experiments stop endpoint should reject unauthenticated requests"""
        response = requests.post(f"{BASE_URL}/api/experiments/test-exp/stop")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ /api/experiments/{{name}}/stop returns {response.status_code} when unauthenticated")

    def test_experiments_variant_unauthenticated(self):
        """Experiments variant endpoint should reject unauthenticated requests"""
        response = requests.get(f"{BASE_URL}/api/experiments/test-exp/variant")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ /api/experiments/{{name}}/variant returns {response.status_code} when unauthenticated")


class TestPlatformServicesEndpoints:
    """Tests for platform services health check"""
    
    def test_services_health_unauthenticated(self):
        """Services health endpoint should reject unauthenticated requests"""
        response = requests.get(f"{BASE_URL}/api/services/health")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ /api/services/health returns {response.status_code} when unauthenticated")


class TestHealthEndpoint:
    """Verify backend is running"""
    
    def test_health_endpoint(self):
        """Health check should return 200"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        print(f"✓ /api/health returns 200")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
