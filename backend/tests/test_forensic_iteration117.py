"""
Forensic Platform Audit - Iteration 117
========================================
Full coverage test of BIQc production platform.
Focus: API health, auth flows, soundboard, war room, board room, admin controls.
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://advisor-engine.preview.emergentagent.com').rstrip('/')

# Production URL for certain tests
PROD_URL = "https://biqc.thestrategysquad.com"


class TestHealthEndpoints:
    """Verify all health and status endpoints are responding"""
    
    def test_api_health(self):
        """Test main health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("✓ /api/health: healthy")

    def test_production_health(self):
        """Test production health endpoint"""
        response = requests.get(f"{PROD_URL}/api/health", timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("✓ Production /api/health: healthy")


class TestUnauthorizedEndpoints:
    """Test endpoints that require auth return 401/403 appropriately"""
    
    def test_soundboard_conversations_unauthorized(self):
        """Soundboard conversations should require auth"""
        response = requests.get(f"{BASE_URL}/api/soundboard/conversations", timeout=10)
        assert response.status_code in [401, 403]
        print("✓ /api/soundboard/conversations: correctly requires auth")
    
    def test_soundboard_chat_unauthorized(self):
        """Soundboard chat should require auth"""
        response = requests.post(f"{BASE_URL}/api/soundboard/chat", 
                                json={"message": "test"}, timeout=10)
        assert response.status_code in [401, 403]
        print("✓ /api/soundboard/chat: correctly requires auth")
    
    def test_boardroom_respond_unauthorized(self):
        """Board room respond should require auth"""
        response = requests.post(f"{BASE_URL}/api/boardroom/respond",
                                json={"message": "test", "history": []}, timeout=10)
        assert response.status_code == 401
        print("✓ /api/boardroom/respond: correctly requires auth")
    
    def test_boardroom_diagnosis_unauthorized(self):
        """Board room diagnosis should require auth"""
        response = requests.post(f"{BASE_URL}/api/boardroom/diagnosis",
                                json={"focus_area": "cash_flow_financial_risk"}, timeout=10)
        assert response.status_code == 401
        print("✓ /api/boardroom/diagnosis: correctly requires auth")
    
    def test_war_room_respond_unauthorized(self):
        """War room respond should require auth"""
        response = requests.post(f"{BASE_URL}/api/war-room/respond",
                                json={"question": "test"}, timeout=10)
        assert response.status_code == 401
        print("✓ /api/war-room/respond: correctly requires auth")
    
    def test_admin_users_unauthorized(self):
        """Admin users should require super admin"""
        response = requests.get(f"{BASE_URL}/api/admin/users", timeout=10)
        # Should return 401 (not authenticated) or 403 (not authorized)
        assert response.status_code in [401, 403]
        print("✓ /api/admin/users: correctly requires admin auth")
    
    def test_admin_stats_unauthorized(self):
        """Admin stats should require super admin"""
        response = requests.get(f"{BASE_URL}/api/admin/stats", timeout=10)
        assert response.status_code in [401, 403]
        print("✓ /api/admin/stats: correctly requires admin auth")
    
    def test_admin_rate_limits_defaults_unauthorized(self):
        """Admin rate limits should require super admin"""
        response = requests.get(f"{BASE_URL}/api/admin/rate-limits/defaults", timeout=10)
        assert response.status_code == 403
        print("✓ /api/admin/rate-limits/defaults: correctly requires admin auth")


class TestOpsAdvisoryRoute:
    """Test OAC (Ops Advisory Centre) endpoint"""
    
    def test_oac_recommendations_unauthorized(self):
        """OAC recommendations should require auth"""
        response = requests.get(f"{BASE_URL}/api/oac/recommendations", timeout=10)
        assert response.status_code in [401, 403]
        print("✓ /api/oac/recommendations: correctly requires auth")


class TestNotificationEndpoints:
    """Test notification-related endpoints"""
    
    def test_notifications_alerts_unauthorized(self):
        """Notifications alerts should require auth"""
        response = requests.get(f"{BASE_URL}/api/notifications/alerts", timeout=10)
        assert response.status_code in [401, 403]
        print("✓ /api/notifications/alerts: correctly requires auth")


class TestIntelligenceEndpoints:
    """Test intelligence/watchtower endpoints"""
    
    def test_intelligence_watchtower_unauthorized(self):
        """Intelligence watchtower should require auth"""
        response = requests.get(f"{BASE_URL}/api/intelligence/watchtower", timeout=10)
        assert response.status_code in [401, 403]
        print("✓ /api/intelligence/watchtower: correctly requires auth")


class TestCognitionEndpoints:
    """Test cognition-related endpoints"""
    
    def test_cognition_overview_unauthorized(self):
        """Cognition overview should require auth"""
        response = requests.get(f"{BASE_URL}/api/cognition/overview", timeout=10)
        assert response.status_code in [401, 403]
        print("✓ /api/cognition/overview: correctly requires auth")


class TestIntegrationEndpoints:
    """Test integration-related endpoints"""
    
    def test_integrations_status_unauthorized(self):
        """Integrations status should require auth"""
        response = requests.get(f"{BASE_URL}/api/integrations/status", timeout=10)
        assert response.status_code in [401, 403]
        print("✓ /api/integrations/status: correctly requires auth")


class TestCalibrationEndpoints:
    """Test calibration-related endpoints"""
    
    def test_calibration_status_unauthorized(self):
        """Calibration status should require auth"""
        response = requests.get(f"{BASE_URL}/api/calibration/status", timeout=10)
        assert response.status_code in [401, 403]
        print("✓ /api/calibration/status: correctly requires auth")


class TestBoardroomDiagnosisAreas:
    """Test that boardroom diagnosis accepts valid focus areas"""
    
    VALID_FOCUS_AREAS = [
        "cash_flow_financial_risk",
        "revenue_momentum",
        "strategy_effectiveness",
        "operations_delivery",
        "people_retention_capacity",
        "customer_relationships",
        "risk_compliance",
        "systems_technology",
        "market_position",
    ]
    
    def test_invalid_focus_area(self):
        """Invalid focus area should return 400 or 401"""
        response = requests.post(f"{BASE_URL}/api/boardroom/diagnosis",
                                json={"focus_area": "invalid_area"}, timeout=10)
        # Should be 401 (auth required) or 400 (bad request if auth bypassed)
        assert response.status_code in [400, 401]
        print("✓ Invalid focus area correctly rejected")


class TestSnapshotEndpoints:
    """Test snapshot-related endpoints"""
    
    def test_snapshot_latest_unauthorized(self):
        """Snapshot latest should require auth"""
        response = requests.get(f"{BASE_URL}/api/snapshot/latest", timeout=10)
        assert response.status_code in [401, 403]
        print("✓ /api/snapshot/latest: correctly requires auth")


class TestProfileEndpoints:
    """Test profile-related endpoints"""
    
    def test_business_profile_unauthorized(self):
        """Business profile should require auth"""
        response = requests.get(f"{BASE_URL}/api/profile/business", timeout=10)
        assert response.status_code in [401, 403]
        print("✓ /api/profile/business: correctly requires auth")


class TestUnifiedEndpoints:
    """Test unified intelligence endpoints"""
    
    def test_unified_revenue_unauthorized(self):
        """Unified revenue should require auth"""
        response = requests.get(f"{BASE_URL}/api/unified/revenue", timeout=10)
        assert response.status_code in [401, 403]
        print("✓ /api/unified/revenue: correctly requires auth")


class TestEndpointDiscovery:
    """Discover and verify key endpoint existence"""
    
    def test_key_routes_exist(self):
        """Test that key routes are registered in the API"""
        routes_to_check = [
            ("/api/health", "GET"),
            ("/api/soundboard/conversations", "GET"),
            ("/api/soundboard/chat", "POST"),
            ("/api/boardroom/respond", "POST"),
            ("/api/boardroom/diagnosis", "POST"),
            ("/api/war-room/respond", "POST"),
            ("/api/admin/users", "GET"),
            ("/api/admin/stats", "GET"),
        ]
        
        for route, method in routes_to_check:
            try:
                if method == "GET":
                    response = requests.get(f"{BASE_URL}{route}", timeout=5)
                else:
                    response = requests.post(f"{BASE_URL}{route}", json={}, timeout=5)
                # Route exists if we get anything other than 404
                assert response.status_code != 404, f"Route {route} not found"
                print(f"✓ {method} {route}: exists (status {response.status_code})")
            except Exception as e:
                print(f"✗ {method} {route}: error - {e}")
                raise


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
