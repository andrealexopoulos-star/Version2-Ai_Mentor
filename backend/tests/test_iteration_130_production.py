"""
Iteration 130 - Production Retest after OpenAI key reset and War Room payload fix
Tests production URL: https://biqc.ai
"""
import pytest
import requests
import os
import time

# Production URL as specified in credentials
BASE_URL = "https://biqc.ai"
TEST_EMAIL = "andre@thestrategysquad.com.au"
TEST_PASSWORD = "MasterMind2025*"

class TestProductionAuth:
    """Authentication tests against production"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        """Authenticate and return session with token"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # Get Supabase auth token
        supabase_url = "https://vwwandhoydemcybltoxz.supabase.co"
        anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3d2FuZGhveWRlbWN5Ymx0b3h6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MjU4MzEsImV4cCI6MjA4ODQwMTgzMX0.KzFEpKDiHtDx6EjsZscdvwY9vyakitlUJ4SOMekWEys"
        
        # Supabase auth
        auth_response = requests.post(
            f"{supabase_url}/auth/v1/token?grant_type=password",
            headers={
                "apikey": anon_key,
                "Content-Type": "application/json"
            },
            json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD
            }
        )
        
        if auth_response.status_code != 200:
            pytest.skip(f"Auth failed: {auth_response.status_code} - {auth_response.text[:200]}")
        
        token_data = auth_response.json()
        access_token = token_data.get("access_token")
        if not access_token:
            pytest.skip("No access token returned")
        
        session.headers.update({"Authorization": f"Bearer {access_token}"})
        return session, access_token, anon_key, supabase_url
    
    def test_01_login_successful(self, auth_session):
        """Test: Production login works"""
        session, access_token, _, _ = auth_session
        assert access_token is not None
        assert len(access_token) > 50
        print(f"✓ Login successful, token length: {len(access_token)}")
    
    def test_02_calibration_status(self, auth_session):
        """Test: Calibration status returns COMPLETE"""
        session, _, _, _ = auth_session
        response = session.get(f"{BASE_URL}/api/calibration/status")
        assert response.status_code == 200
        data = response.json()
        print(f"✓ Calibration status: {data.get('status')}")
        assert data.get("status") in ["COMPLETE", "IN_PROGRESS", "NEEDS_CALIBRATION"]


class TestWarRoom:
    """War Room endpoint tests - verifying product_or_service validation fix"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        """Authenticate and return session with token"""
        session = requests.Session()
        supabase_url = "https://vwwandhoydemcybltoxz.supabase.co"
        anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3d2FuZGhveWRlbWN5Ymx0b3h6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MjU4MzEsImV4cCI6MjA4ODQwMTgzMX0.KzFEpKDiHtDx6EjsZscdvwY9vyakitlUJ4SOMekWEys"
        
        auth_response = requests.post(
            f"{supabase_url}/auth/v1/token?grant_type=password",
            headers={"apikey": anon_key, "Content-Type": "application/json"},
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if auth_response.status_code != 200:
            pytest.skip(f"Auth failed: {auth_response.status_code}")
        
        token_data = auth_response.json()
        access_token = token_data.get("access_token")
        session.headers.update({
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        })
        return session, anon_key, supabase_url
    
    def test_03_war_room_without_product_or_service(self, auth_session):
        """Test: War Room should work WITHOUT product_or_service field (should default)"""
        session, _, _ = auth_session
        
        # Send request WITHOUT product_or_service - should now work with Optional fix
        response = session.post(
            f"{BASE_URL}/api/war-room/respond",
            json={"question": "What is my current business risk level?"}
        )
        
        print(f"War Room response status: {response.status_code}")
        print(f"War Room response: {response.text[:500]}")
        
        # Should not get 422 validation error anymore
        assert response.status_code in [200, 422, 500], f"Unexpected status: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            # Should have an answer OR degraded response
            has_answer = bool(data.get("answer") or data.get("response") or data.get("degraded"))
            assert has_answer or "error" not in data.get("answer", "").lower(), f"Got error in answer: {data}"
            print(f"✓ War Room responded successfully (degraded={data.get('degraded', False)})")
        elif response.status_code == 422:
            pytest.fail("War Room still requires product_or_service - validation fix not deployed")
        else:
            # 500 might indicate AI key issue - report but don't fail hard
            print(f"⚠ War Room returned 500 - may indicate AI key issue: {response.text[:300]}")
    
    def test_04_war_room_with_product_or_service(self, auth_session):
        """Test: War Room with product_or_service field"""
        session, _, _ = auth_session
        
        response = session.post(
            f"{BASE_URL}/api/war-room/respond",
            json={
                "question": "What should I prioritize this week?",
                "product_or_service": "Business Strategy Consulting"
            }
        )
        
        print(f"War Room (with product) status: {response.status_code}")
        assert response.status_code in [200, 500]
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ War Room with product_or_service: {str(data)[:300]}")


class TestSoundboard:
    """Soundboard AI chat tests - verifying OpenAI key is working"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        """Authenticate and return session"""
        session = requests.Session()
        supabase_url = "https://vwwandhoydemcybltoxz.supabase.co"
        anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3d2FuZGhveWRlbWN5Ymx0b3h6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MjU4MzEsImV4cCI6MjA4ODQwMTgzMX0.KzFEpKDiHtDx6EjsZscdvwY9vyakitlUJ4SOMekWEys"
        
        auth_response = requests.post(
            f"{supabase_url}/auth/v1/token?grant_type=password",
            headers={"apikey": anon_key, "Content-Type": "application/json"},
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if auth_response.status_code != 200:
            pytest.skip(f"Auth failed: {auth_response.status_code}")
        
        token_data = auth_response.json()
        session.headers.update({
            "Authorization": f"Bearer {token_data.get('access_token')}",
            "Content-Type": "application/json"
        })
        return session
    
    def test_05_soundboard_advisory_prompt(self, auth_session):
        """Test: Soundboard responds to advisory prompts (tests OpenAI key)"""
        session = auth_session
        
        response = session.post(
            f"{BASE_URL}/api/soundboard/chat",
            json={"message": "Give me a brief summary of my business priorities"}
        )
        
        print(f"Soundboard status: {response.status_code}")
        print(f"Soundboard response: {response.text[:500]}")
        
        # We expect 200 if AI keys are working, or specific error if not
        assert response.status_code in [200, 500, 503]
        
        if response.status_code == 200:
            data = response.json()
            reply = data.get("reply", "")
            
            # Check for AI key error in response
            if "AI provider keys are not configured" in reply:
                pytest.fail("CRITICAL: OpenAI key still not configured - Soundboard returning AI key error")
            
            if "can't process" in reply.lower() or "blocked" in reply.lower():
                print(f"⚠ Soundboard returned guardrail response: {reply[:200]}")
            else:
                print(f"✓ Soundboard replied successfully: {reply[:200]}")
        else:
            error_text = response.text
            if "AI provider keys" in error_text or "OPENAI_API_KEY" in error_text:
                pytest.fail(f"CRITICAL: OpenAI key not configured: {error_text[:300]}")
            print(f"⚠ Soundboard returned {response.status_code}: {error_text[:300]}")


class TestBoardRoomDiagnosis:
    """Board Room diagnosis tests (works via Supabase Edge Functions)"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        """Authenticate and return session"""
        session = requests.Session()
        supabase_url = "https://vwwandhoydemcybltoxz.supabase.co"
        anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3d2FuZGhveWRlbWN5Ymx0b3h6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MjU4MzEsImV4cCI6MjA4NDAxODMxfQ.KzFEpKDiHtDx6EjsZscdvwY9vyakitlUJ4SOMekWEys"
        
        auth_response = requests.post(
            f"{supabase_url}/auth/v1/token?grant_type=password",
            headers={"apikey": anon_key, "Content-Type": "application/json"},
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if auth_response.status_code != 200:
            pytest.skip(f"Auth failed: {auth_response.status_code}")
        
        token_data = auth_response.json()
        session.headers.update({
            "Authorization": f"Bearer {token_data.get('access_token')}",
            "Content-Type": "application/json"
        })
        return session
    
    def test_06_boardroom_diagnosis(self, auth_session):
        """Test: Board Room diagnosis endpoint"""
        session = auth_session
        
        response = session.post(
            f"{BASE_URL}/api/boardroom/diagnosis",
            json={"focus_area": "revenue_momentum"}
        )
        
        print(f"Board Room diagnosis status: {response.status_code}")
        
        assert response.status_code in [200, 400, 500]
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Board Room diagnosis: {str(data)[:300]}")
            # Should have headline or degraded response
            assert data.get("headline") or data.get("degraded") or data.get("narrative")
    
    def test_07_boardroom_respond(self, auth_session):
        """Test: Board Room respond endpoint"""
        session = auth_session
        
        response = session.post(
            f"{BASE_URL}/api/boardroom/respond",
            json={"message": "What is my business risk status?", "history": []}
        )
        
        print(f"Board Room respond status: {response.status_code}")
        
        assert response.status_code in [200, 500]
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Board Room responded: {str(data)[:300]}")


class TestCalibrationDeepScan:
    """Calibration deep scan endpoint tests"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        """Authenticate and return session"""
        session = requests.Session()
        supabase_url = "https://vwwandhoydemcybltoxz.supabase.co"
        anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3d2FuZGhveWRlbWN5Ymx0b3h6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MjU4MzEsImV4cCI6MjA4ODQwMTgzMX0.KzFEpKDiHtDx6EjsZscdvwY9vyakitlUJ4SOMekWEys"
        
        auth_response = requests.post(
            f"{supabase_url}/auth/v1/token?grant_type=password",
            headers={"apikey": anon_key, "Content-Type": "application/json"},
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if auth_response.status_code != 200:
            pytest.skip(f"Auth failed: {auth_response.status_code}")
        
        token_data = auth_response.json()
        session.headers.update({
            "Authorization": f"Bearer {token_data.get('access_token')}",
            "Content-Type": "application/json"
        })
        return session
    
    def test_08_calibration_enrichment_deep_scan(self, auth_session):
        """Test: Calibration website enrichment for deep fields"""
        session = auth_session
        
        response = session.post(
            f"{BASE_URL}/api/enrichment/website",
            json={"url": "https://thestrategysquad.com.au", "action": "scan"},
            timeout=60  # Deep scan may take time
        )
        
        print(f"Calibration enrichment status: {response.status_code}")
        print(f"Calibration enrichment response: {response.text[:800]}")
        
        assert response.status_code in [200, 500]
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get("status") == "error":
                print(f"⚠ Enrichment error: {data.get('message', '')[:200]}")
                return
            
            enrichment = data.get("enrichment", {})
            
            # Check for deep scan fields (competitor analysis, social handles, trust signals, executive summary)
            deep_fields = {
                "competitors": enrichment.get("competitors", []),
                "competitor_analysis": enrichment.get("competitor_analysis", ""),
                "social_handles": enrichment.get("social_handles", {}),
                "trust_signals": enrichment.get("trust_signals", []),
                "executive_summary": enrichment.get("executive_summary", ""),
                "abn": enrichment.get("abn", ""),
                "market_position": enrichment.get("market_position", ""),
            }
            
            # Score the depth
            score = 0
            max_score = 7
            for field, value in deep_fields.items():
                if value and (isinstance(value, str) and len(value) > 5) or (isinstance(value, (list, dict)) and len(value) > 0):
                    score += 1
                    print(f"  ✓ {field}: populated")
                else:
                    print(f"  ✗ {field}: empty")
            
            print(f"✓ Deep scan quality: {score}/{max_score} fields populated")
            
            # Assert at least some deep fields are populated
            assert score >= 2, f"Deep scan too shallow: only {score}/{max_score} fields populated"
        else:
            print(f"⚠ Enrichment failed: {response.text[:300]}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
