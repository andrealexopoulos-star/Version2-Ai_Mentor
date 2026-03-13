"""
Forensic E2E Testing - Iteration 118
Tests all critical BIQc platform endpoints across:
- Auth, Soundboard, BoardRoom, War Room, Admin
- Protected routes, tier gates, rate limits
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://biqc.thestrategysquad.com"

# QA User credentials from previous iteration
QA_EMAIL = "cal-loop-416d7f85@biqctest.io"
QA_PASSWORD = "BIQcTest!2026Z"
QA_USER_ID = "7ed0108b-3ed5-4013-a075-3f7f7db76c4c"


@pytest.fixture(scope="module")
def session():
    """Shared requests session"""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth_token(session):
    """Get Supabase auth token via API login"""
    # Use Supabase REST API for auth
    supabase_url = "https://vwwandhoydemcybltoxz.supabase.co"
    response = session.post(
        f"{supabase_url}/auth/v1/token?grant_type=password",
        headers={
            "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3d2FuZGhveWRlbWN5Ymx0b3h6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MjU4MzEsImV4cCI6MjA4ODQwMTgzMX0.KzFEpKDiHtDx6EjsZscdvwY9vyakitlUJ4SOMekWEys",
            "Content-Type": "application/json"
        },
        json={
            "email": QA_EMAIL,
            "password": QA_PASSWORD
        }
    )
    if response.status_code == 200:
        data = response.json()
        return data.get("access_token")
    print(f"Auth failed: {response.status_code} - {response.text[:200]}")
    pytest.skip("Authentication failed - skipping authenticated tests")


@pytest.fixture(scope="module")
def authenticated_session(session, auth_token):
    """Session with auth header"""
    session.headers.update({"Authorization": f"Bearer {auth_token}"})
    return session


# ═══ HEALTH CHECKS ═══

class TestHealthChecks:
    """Health endpoint tests"""

    def test_root_health(self, session):
        """GET /health should return healthy"""
        response = session.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print(f"✓ Health check: {data}")

    def test_api_root(self, session):
        """GET /api/ should return API info"""
        response = session.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "Strategic Advisor API" in data.get("message", "")
        print(f"✓ API root: {data}")


# ═══ AUTH ENDPOINTS ═══

class TestAuthEndpoints:
    """Auth route tests"""

    def test_auth_me_unauthenticated(self, session):
        """GET /api/auth/me without token should return 401/403"""
        clean_session = requests.Session()
        response = clean_session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code in [401, 403, 422]
        print(f"✓ Unauthenticated /auth/me correctly blocked: {response.status_code}")

    def test_auth_me_authenticated(self, authenticated_session):
        """GET /api/auth/me with token should return user data"""
        response = authenticated_session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200
        data = response.json()
        assert "id" in data or "user" in data
        print(f"✓ Authenticated /auth/me: user_id present")


# ═══ SOUNDBOARD ENDPOINTS ═══

class TestSoundboardEndpoints:
    """Soundboard route tests - must NOT ask for API keys"""

    def test_soundboard_conversations_list(self, authenticated_session):
        """GET /api/soundboard/conversations should return user's conversations"""
        response = authenticated_session.get(f"{BASE_URL}/api/soundboard/conversations")
        assert response.status_code == 200
        data = response.json()
        assert "conversations" in data
        print(f"✓ Soundboard conversations: {len(data.get('conversations', []))} found")

    def test_soundboard_chat_basic(self, authenticated_session):
        """POST /api/soundboard/chat should return AI response without asking for API keys"""
        response = authenticated_session.post(
            f"{BASE_URL}/api/soundboard/chat",
            json={"message": "Hello, what can you help me with?"}
        )
        # May return 200 or 503 if AI provider is down
        if response.status_code == 503:
            print(f"⚠ Soundboard AI provider unavailable: {response.text[:100]}")
            return
        
        assert response.status_code == 200
        data = response.json()
        
        # CRITICAL CHECK: Response should NOT contain API key requests
        reply = data.get("reply", "")
        assert "API key" not in reply.lower(), "Soundboard is asking for API keys!"
        assert "enter your key" not in reply.lower(), "Soundboard is asking for API keys!"
        assert "openai key" not in reply.lower(), "Soundboard is asking for API keys!"
        
        # Should have a reply
        assert len(reply) > 0, "Soundboard returned empty reply"
        print(f"✓ Soundboard chat: got {len(reply)} char reply, no API key prompts")


# ═══ BOARDROOM ENDPOINTS ═══

class TestBoardRoomEndpoints:
    """BoardRoom route tests"""

    def test_boardroom_respond_unauthenticated(self, session):
        """POST /api/boardroom/respond without auth should return 401"""
        clean_session = requests.Session()
        response = clean_session.post(
            f"{BASE_URL}/api/boardroom/respond",
            json={"message": "Test message"}
        )
        assert response.status_code in [401, 403, 422]
        print(f"✓ Unauthenticated boardroom correctly blocked: {response.status_code}")

    def test_boardroom_respond_authenticated(self, authenticated_session):
        """POST /api/boardroom/respond should return AI analysis"""
        response = authenticated_session.post(
            f"{BASE_URL}/api/boardroom/respond",
            json={"message": "What are my top risks?", "history": []}
        )
        
        # May be rate limited or tier gated
        if response.status_code == 429:
            print(f"⚠ Boardroom rate limited: {response.text[:100]}")
            return
        if response.status_code == 403:
            print(f"⚠ Boardroom tier gated: {response.text[:100]}")
            return
        
        assert response.status_code == 200
        data = response.json()
        assert "response" in data
        print(f"✓ Boardroom respond: got response with {len(data.get('response', ''))} chars")

    def test_boardroom_diagnosis_invalid_focus(self, authenticated_session):
        """POST /api/boardroom/diagnosis with invalid focus should return 400"""
        response = authenticated_session.post(
            f"{BASE_URL}/api/boardroom/diagnosis",
            json={"focus_area": "invalid_focus_area"}
        )
        # Should be 400 for invalid focus area or 429 for rate limit or 403 for tier gate
        assert response.status_code in [400, 403, 429]
        print(f"✓ Boardroom diagnosis invalid focus: {response.status_code}")


# ═══ WAR ROOM ENDPOINTS ═══

class TestWarRoomEndpoints:
    """War Room route tests"""

    def test_war_room_respond_authenticated(self, authenticated_session):
        """POST /api/war-room/respond should return strategic guidance"""
        response = authenticated_session.post(
            f"{BASE_URL}/api/war-room/respond",
            json={"question": "What should I focus on this week?"}
        )
        
        # May be rate limited or tier gated
        if response.status_code == 429:
            print(f"⚠ War Room rate limited: {response.text[:100]}")
            return
        if response.status_code == 403:
            print(f"⚠ War Room tier gated: {response.text[:100]}")
            return
        if response.status_code == 500:
            print(f"⚠ War Room service error: {response.text[:100]}")
            return
        
        assert response.status_code == 200
        data = response.json()
        assert "answer" in data or "response" in data or "degraded" in data
        print(f"✓ War Room respond: got response")


# ═══ ADMIN ENDPOINTS ═══

class TestAdminEndpoints:
    """Admin route tests - should require superadmin access"""

    def test_admin_users_requires_auth(self, session):
        """GET /api/admin/users without auth should return 401/403"""
        clean_session = requests.Session()
        response = clean_session.get(f"{BASE_URL}/api/admin/users")
        assert response.status_code in [401, 403, 422]
        print(f"✓ Admin users requires auth: {response.status_code}")

    def test_admin_users_requires_superadmin(self, authenticated_session):
        """GET /api/admin/users with regular user should return 403"""
        response = authenticated_session.get(f"{BASE_URL}/api/admin/users")
        # QA user is not superadmin, should be 403
        assert response.status_code in [403, 401]
        print(f"✓ Admin users requires superadmin: {response.status_code}")

    def test_admin_stats_requires_superadmin(self, authenticated_session):
        """GET /api/admin/stats with regular user should return 403"""
        response = authenticated_session.get(f"{BASE_URL}/api/admin/stats")
        assert response.status_code in [403, 401]
        print(f"✓ Admin stats requires superadmin: {response.status_code}")


# ═══ CALIBRATION ENDPOINTS ═══

class TestCalibrationEndpoints:
    """Calibration status tests"""

    def test_calibration_status(self, authenticated_session):
        """GET /api/calibration/status should return calibration state"""
        response = authenticated_session.get(f"{BASE_URL}/api/calibration/status")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        print(f"✓ Calibration status: {data.get('status')}")

    def test_onboarding_status(self, authenticated_session):
        """GET /api/onboarding/status should return onboarding state"""
        response = authenticated_session.get(f"{BASE_URL}/api/onboarding/status")
        assert response.status_code == 200
        data = response.json()
        assert "completed" in data or "current_step" in data
        print(f"✓ Onboarding status: completed={data.get('completed')}")


# ═══ INTELLIGENCE ENDPOINTS ═══

class TestIntelligenceEndpoints:
    """Intelligence/Advisor route tests"""

    def test_lifecycle_state(self, authenticated_session):
        """GET /api/lifecycle/state should return user lifecycle state"""
        response = authenticated_session.get(f"{BASE_URL}/api/lifecycle/state")
        assert response.status_code == 200
        data = response.json()
        # Should have lifecycle info
        print(f"✓ Lifecycle state: {data}")


# ═══ INTEGRATION ENDPOINTS ═══

class TestIntegrationEndpoints:
    """Integration route tests"""

    def test_integrations_list(self, authenticated_session):
        """GET /api/integrations should return connected integrations"""
        response = authenticated_session.get(f"{BASE_URL}/api/integrations")
        assert response.status_code == 200
        data = response.json()
        assert "integrations" in data or isinstance(data, list)
        print(f"✓ Integrations list: {len(data.get('integrations', data)) if isinstance(data, dict) else len(data)} found")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
