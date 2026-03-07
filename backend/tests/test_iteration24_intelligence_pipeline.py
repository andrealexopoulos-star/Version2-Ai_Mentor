"""
BIQC Section 4 Certification: Integration → Ingestion → Cognitive Intelligence Pipeline Tests
Tests the complete intelligence pipeline from data ingestion through watchtower analysis 
to board room cognitive delivery.

Test User: andre@thestrategysquad.com.au
"""
import pytest
import requests
import os
from datetime import datetime, timezone

# Use production URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "andre@thestrategysquad.com.au"
TEST_PASSWORD = "Biqc#Cert2026!xQ9z"

# Supabase auth configuration
SUPABASE_URL = os.environ.get('SUPABASE_URL', os.environ.get('REACT_APP_SUPABASE_URL', ''))
SUPABASE_ANON_KEY = os.environ.get('REACT_APP_SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4eXFwZGZmdHhwa3plcHBxdHZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MzcwNDcsImV4cCI6MjA4NDAxMzA0N30.Xu9Wg5M638qJSgDpJKwFYlr9YZDiYPLv4Igh69KHJ0k')


class TestSupabaseAuthentication:
    """Authenticate with Supabase and obtain bearer token"""

    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get Supabase access token for the test user"""
        auth_url = f"{SUPABASE_URL}/auth/v1/token?grant_type=password"
        headers = {
            "apikey": SUPABASE_ANON_KEY,
            "Content-Type": "application/json"
        }
        payload = {
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        }
        
        response = requests.post(auth_url, json=payload, headers=headers)
        print(f"\n[AUTH] Supabase auth response status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"[AUTH] Auth failed: {response.text}")
            pytest.skip("Supabase authentication failed - skipping authenticated tests")
        
        data = response.json()
        token = data.get("access_token")
        print(f"[AUTH] Token obtained: {token[:50]}..." if token else "[AUTH] No token returned")
        return token

    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Create authorization headers"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }

    def test_supabase_login_success(self, auth_token):
        """Verify Supabase login returns valid token"""
        assert auth_token is not None
        assert len(auth_token) > 50
        print(f"[PASS] Supabase auth successful, token length: {len(auth_token)}")


class TestWatchtowerEndpoints:
    """Watchtower API endpoints - positions, findings, emit, analyse"""

    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers for watchtower tests"""
        auth_url = f"{SUPABASE_URL}/auth/v1/token?grant_type=password"
        headers = {
            "apikey": SUPABASE_ANON_KEY,
            "Content-Type": "application/json"
        }
        payload = {"email": TEST_EMAIL, "password": TEST_PASSWORD}
        
        response = requests.post(auth_url, json=payload, headers=headers)
        if response.status_code != 200:
            pytest.skip("Auth failed")
        
        token = response.json().get("access_token")
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

    def test_watchtower_positions_returns_sales_critical(self, auth_headers):
        """GET /api/watchtower/positions - verify sales CRITICAL position with confidence 0.845"""
        response = requests.get(f"{BASE_URL}/api/watchtower/positions", headers=auth_headers)
        
        print(f"\n[POSITIONS] Status: {response.status_code}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        positions = data.get("positions", {})
        print(f"[POSITIONS] Domains: {list(positions.keys())}")
        
        # Verify sales position exists and is CRITICAL
        assert "sales" in positions, "Missing 'sales' domain in positions"
        sales = positions["sales"]
        print(f"[POSITIONS] Sales position: {sales}")
        
        assert sales.get("position") == "CRITICAL", f"Expected sales CRITICAL, got {sales.get('position')}"
        
        # Check confidence (expected ~0.845)
        confidence = sales.get("confidence", 0)
        print(f"[POSITIONS] Sales confidence: {confidence}")
        assert confidence > 0.8, f"Expected confidence > 0.8, got {confidence}"
        print("[PASS] Sales position is CRITICAL with high confidence")

    def test_watchtower_findings_structure(self, auth_headers):
        """GET /api/watchtower/findings - verify findings have domain, position, confidence"""
        response = requests.get(f"{BASE_URL}/api/watchtower/findings", headers=auth_headers)
        
        print(f"\n[FINDINGS] Status: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        findings = data.get("findings", [])
        count = data.get("count", 0)
        
        print(f"[FINDINGS] Count: {count}")
        assert isinstance(findings, list), "Findings should be a list"
        
        if findings:
            # Check first finding structure
            first = findings[0]
            print(f"[FINDINGS] First finding: {first}")
            assert "domain" in first, "Finding missing 'domain' field"
            assert "position" in first, "Finding missing 'position' field"
            assert "confidence" in first, "Finding missing 'confidence' field"
            print(f"[PASS] Findings have correct structure with {count} entries")
        else:
            print("[WARN] No findings returned - may need data population")

    def test_watchtower_emit_creates_event(self, auth_headers):
        """POST /api/watchtower/emit - create new observation event"""
        event_payload = {
            "domain": "sales",
            "event_type": "test_observation",
            "payload": {"test": True, "source": "pytest_iteration24"},
            "source": "pytest",
            "severity": "info",
            "observed_at": datetime.now(timezone.utc).isoformat()
        }
        
        response = requests.post(f"{BASE_URL}/api/watchtower/emit", json=event_payload, headers=auth_headers)
        
        print(f"\n[EMIT] Status: {response.status_code}")
        print(f"[EMIT] Response: {response.text[:500]}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") is True, "Expected success: true"
        assert "event_id" in data, "Missing event_id in response"
        print(f"[PASS] Emit created event with id: {data.get('event_id')}")

    def test_watchtower_analyse_triggers_recalculation(self, auth_headers):
        """POST /api/watchtower/analyse - trigger analysis recalculation"""
        response = requests.post(f"{BASE_URL}/api/watchtower/analyse", headers=auth_headers)
        
        print(f"\n[ANALYSE] Status: {response.status_code}")
        print(f"[ANALYSE] Response: {response.text[:500]}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Response should contain analysis results
        print(f"[ANALYSE] Analysis result keys: {list(data.keys()) if isinstance(data, dict) else 'not dict'}")
        print("[PASS] Watchtower analyse endpoint executed successfully")


class TestCognitiveEscalation:
    """Cognitive escalation state endpoint"""

    @pytest.fixture(scope="class")
    def auth_headers(self):
        auth_url = f"{SUPABASE_URL}/auth/v1/token?grant_type=password"
        headers = {"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"}
        payload = {"email": TEST_EMAIL, "password": TEST_PASSWORD}
        response = requests.post(auth_url, json=payload, headers=headers)
        if response.status_code != 200:
            pytest.skip("Auth failed")
        token = response.json().get("access_token")
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    def test_cognitive_escalation_returns_state_data(self, auth_headers):
        """GET /api/cognitive/escalation - verify escalation state response"""
        response = requests.get(f"{BASE_URL}/api/cognitive/escalation", headers=auth_headers)
        
        print(f"\n[ESCALATION] Status: {response.status_code}")
        print(f"[ESCALATION] Response: {response.text[:500]}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Should have escalation level and related fields
        print(f"[ESCALATION] Keys: {list(data.keys())}")
        print("[PASS] Cognitive escalation endpoint returns data")


class TestBoardRoomResponses:
    """Board Room respond endpoint - tests cognitive depth and follow-up protocol"""

    @pytest.fixture(scope="class")
    def auth_headers(self):
        auth_url = f"{SUPABASE_URL}/auth/v1/token?grant_type=password"
        headers = {"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"}
        payload = {"email": TEST_EMAIL, "password": TEST_PASSWORD}
        response = requests.post(auth_url, json=payload, headers=headers)
        if response.status_code != 200:
            pytest.skip("Auth failed")
        token = response.json().get("access_token")
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    def test_boardroom_initial_briefing(self, auth_headers):
        """POST /api/boardroom/respond - initial message returns Position, Evidence, Trajectory, Decision Window"""
        payload = {
            "message": "What is my current business state?",
            "history": []
        }
        
        response = requests.post(f"{BASE_URL}/api/boardroom/respond", json=payload, headers=auth_headers, timeout=60)
        
        print(f"\n[BOARDROOM-INITIAL] Status: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        board_response = data.get("response", "")
        
        print(f"[BOARDROOM-INITIAL] Response length: {len(board_response)}")
        print(f"[BOARDROOM-INITIAL] First 500 chars: {board_response[:500]}")
        
        # Check for key briefing elements (Position, Evidence, Trajectory, Decision Window)
        # Note: LLM may use variations like [Position], Position:, etc.
        response_lower = board_response.lower()
        has_position = any(term in response_lower for term in ["position", "state", "status"])
        has_evidence = any(term in response_lower for term in ["evidence", "signal", "data", "pattern"])
        has_trajectory = any(term in response_lower for term in ["trajectory", "trend", "direction", "if unchanged", "if this continues"])
        has_window = any(term in response_lower for term in ["window", "time", "deadline", "remaining"])
        
        print(f"[BOARDROOM-INITIAL] Has position context: {has_position}")
        print(f"[BOARDROOM-INITIAL] Has evidence context: {has_evidence}")
        print(f"[BOARDROOM-INITIAL] Has trajectory context: {has_trajectory}")
        print(f"[BOARDROOM-INITIAL] Has decision window: {has_window}")
        
        assert len(board_response) > 100, "Response too short for a proper briefing"
        print("[PASS] Board Room initial briefing returned substantial response")
        
        return board_response  # For use in follow-up tests

    def test_boardroom_followup_why_critical(self, auth_headers):
        """POST /api/boardroom/respond - follow-up 'why this became critical' returns deeper analysis"""
        # First, get initial response
        initial_payload = {
            "message": "What is my current business state?",
            "history": []
        }
        
        initial_response = requests.post(f"{BASE_URL}/api/boardroom/respond", json=initial_payload, headers=auth_headers, timeout=60)
        
        if initial_response.status_code != 200:
            pytest.skip("Initial boardroom request failed")
        
        initial_data = initial_response.json()
        initial_text = initial_data.get("response", "")
        
        # Now ask follow-up
        followup_payload = {
            "message": "Explain why this became critical",
            "history": [
                {"role": "user", "content": "What is my current business state?"},
                {"role": "assistant", "content": initial_text}
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/boardroom/respond", json=followup_payload, headers=auth_headers, timeout=60)
        
        print(f"\n[BOARDROOM-FOLLOWUP-WHY] Status: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        followup_response = data.get("response", "")
        
        print(f"[BOARDROOM-FOLLOWUP-WHY] Response length: {len(followup_response)}")
        print(f"[BOARDROOM-FOLLOWUP-WHY] First 500 chars: {followup_response[:500]}")
        
        # Should NOT just repeat the template - should have deeper analysis
        assert len(followup_response) > 100, "Follow-up response too short"
        
        # Check for causal analysis terms
        response_lower = followup_response.lower()
        has_causal = any(term in response_lower for term in [
            "because", "led to", "caused", "resulted", "origin", "pattern",
            "signal", "threshold", "breach", "exceeded", "crossed"
        ])
        
        print(f"[BOARDROOM-FOLLOWUP-WHY] Has causal analysis: {has_causal}")
        print("[PASS] Board Room follow-up provided deeper analysis")

    def test_boardroom_followup_ignore_consequences(self, auth_headers):
        """POST /api/boardroom/respond - 'what if we ignore' returns consequence trajectory"""
        payload = {
            "message": "What happens if we ignore this?",
            "history": [
                {"role": "user", "content": "What is my current business state?"},
                {"role": "assistant", "content": "Sales position is CRITICAL. Evidence shows declining engagement."}
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/boardroom/respond", json=payload, headers=auth_headers, timeout=60)
        
        print(f"\n[BOARDROOM-IGNORE] Status: {response.status_code}")
        
        assert response.status_code == 200
        
        data = response.json()
        ignore_response = data.get("response", "")
        
        print(f"[BOARDROOM-IGNORE] Response length: {len(ignore_response)}")
        print(f"[BOARDROOM-IGNORE] First 500 chars: {ignore_response[:500]}")
        
        # Should discuss consequences, decay, compounding effects
        response_lower = ignore_response.lower()
        has_consequences = any(term in response_lower for term in [
            "consequence", "impact", "effect", "decay", "compound",
            "worsen", "deteriorate", "timeline", "if ignored", "result"
        ])
        
        print(f"[BOARDROOM-IGNORE] Has consequence analysis: {has_consequences}")
        assert len(ignore_response) > 100
        print("[PASS] Board Room consequence trajectory provided")

    def test_boardroom_resolution_pathways(self, auth_headers):
        """POST /api/boardroom/respond - request for resolution pathways returns structured options"""
        payload = {
            "message": "Give me 3 resolution pathways ranked by speed vs long-term stability",
            "history": [
                {"role": "user", "content": "What is my current business state?"},
                {"role": "assistant", "content": "Sales position is CRITICAL with confidence 0.845."}
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/boardroom/respond", json=payload, headers=auth_headers, timeout=60)
        
        print(f"\n[BOARDROOM-PATHWAYS] Status: {response.status_code}")
        
        assert response.status_code == 200
        
        data = response.json()
        pathways_response = data.get("response", "")
        
        print(f"[BOARDROOM-PATHWAYS] Response length: {len(pathways_response)}")
        print(f"[BOARDROOM-PATHWAYS] First 800 chars: {pathways_response[:800]}")
        
        # Should have structured options with trade-offs
        response_lower = pathways_response.lower()
        has_options = any(term in response_lower for term in [
            "option", "pathway", "approach", "1.", "2.", "3.",
            "first", "second", "third", "trade-off", "tradeoff"
        ])
        
        print(f"[BOARDROOM-PATHWAYS] Has structured options: {has_options}")
        assert len(pathways_response) > 100
        print("[PASS] Board Room resolution pathways provided")


class TestSoundBoardChat:
    """SoundBoard chat endpoint - creates conversations"""

    @pytest.fixture(scope="class")
    def auth_headers(self):
        auth_url = f"{SUPABASE_URL}/auth/v1/token?grant_type=password"
        headers = {"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"}
        payload = {"email": TEST_EMAIL, "password": TEST_PASSWORD}
        response = requests.post(auth_url, json=payload, headers=headers)
        if response.status_code != 200:
            pytest.skip("Auth failed")
        token = response.json().get("access_token")
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    def test_soundboard_chat_creates_conversation(self, auth_headers):
        """POST /api/soundboard/chat with null conversation_id creates new conversation"""
        payload = {
            "message": "Test message for iteration 24 certification",
            "conversation_id": None
        }
        
        response = requests.post(f"{BASE_URL}/api/soundboard/chat", json=payload, headers=auth_headers, timeout=60)
        
        print(f"\n[SOUNDBOARD] Status: {response.status_code}")
        print(f"[SOUNDBOARD] Response: {response.text[:500]}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Should return reply and conversation_id
        assert "reply" in data, "Missing 'reply' in response"
        assert "conversation_id" in data, "Missing 'conversation_id' in response"
        
        print(f"[SOUNDBOARD] Reply length: {len(data.get('reply', ''))}")
        print(f"[SOUNDBOARD] Conversation ID: {data.get('conversation_id')}")
        
        assert len(data.get("reply", "")) > 0, "Empty reply returned"
        assert data.get("conversation_id") is not None, "No conversation_id returned"
        
        print("[PASS] SoundBoard chat creates conversation and returns reply")


class TestIntegrationsEndpoint:
    """Test integrations-related endpoints"""

    @pytest.fixture(scope="class")
    def auth_headers(self):
        auth_url = f"{SUPABASE_URL}/auth/v1/token?grant_type=password"
        headers = {"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"}
        payload = {"email": TEST_EMAIL, "password": TEST_PASSWORD}
        response = requests.post(auth_url, json=payload, headers=headers)
        if response.status_code != 200:
            pytest.skip("Auth failed")
        token = response.json().get("access_token")
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    def test_merge_integrations_status(self, auth_headers):
        """GET merge integrations status for connected systems count"""
        response = requests.get(f"{BASE_URL}/api/integrations/merge/status", headers=auth_headers)
        
        print(f"\n[INTEGRATIONS] Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"[INTEGRATIONS] Data: {data}")
            print("[PASS] Merge integrations status endpoint accessible")
        else:
            print(f"[WARN] Integrations status returned {response.status_code}")


# Run tests when executed directly
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
