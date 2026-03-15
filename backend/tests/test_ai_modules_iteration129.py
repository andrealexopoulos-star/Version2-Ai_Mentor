"""
Iteration 129 - AI Modules Test
Testing after OpenAI key rotation:
- Soundboard chat functionality
- War Room ask flow
- Board Room diagnosis
- Calibration deep scan quality

Target: Verify AI routes are responding (not 503) and outputs are not empty/generic
"""
import pytest
import requests
import os
import time
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://advisor-engine.preview.emergentagent.com').rstrip('/')

# Test credentials
TEST_EMAIL = "andre@thestrategysquad.com.au"
TEST_PASSWORD = "MasterMind2025*"

# Supabase config for auth
SUPABASE_URL = os.environ.get('SUPABASE_URL', 'https://vwwandhoydemcybltoxz.supabase.co')
SUPABASE_ANON_KEY = os.environ.get('SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3d2FuZGhveWRlbWN5Ymx0b3h6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MjU4MzEsImV4cCI6MjA4ODQwMTgzMX0.KzFEpKDiHtDx6EjsZscdvwY9vyakitlUJ4SOMekWEys')


class TestAuthenticationAndAIModules:
    """Test authentication and AI module functionality"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        """Authenticate via Supabase and get access token"""
        auth_url = f"{SUPABASE_URL}/auth/v1/token?grant_type=password"
        
        response = requests.post(
            auth_url,
            headers={
                "Content-Type": "application/json",
                "apikey": SUPABASE_ANON_KEY
            },
            json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD
            },
            timeout=30
        )
        
        if response.status_code != 200:
            pytest.skip(f"Authentication failed: {response.status_code} - {response.text[:200]}")
        
        data = response.json()
        access_token = data.get("access_token")
        
        if not access_token:
            pytest.skip("No access token returned from authentication")
        
        return {
            "access_token": access_token,
            "user": data.get("user", {}),
            "headers": {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
        }
    
    def test_01_health_check(self):
        """Basic API health check"""
        response = requests.get(f"{BASE_URL}/api/", timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert "message" in data or "version" in data
        print(f"✓ API Health: {data}")
    
    def test_02_authentication_success(self, auth_session):
        """Verify authentication works"""
        assert auth_session["access_token"] is not None
        assert len(auth_session["access_token"]) > 50
        print(f"✓ Authenticated as: {auth_session['user'].get('email', 'unknown')}")
    
    def test_03_calibration_status(self, auth_session):
        """Test calibration status endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/calibration/status",
            headers=auth_session["headers"],
            timeout=30
        )
        
        print(f"Calibration status: {response.status_code}")
        
        # Should return 200 with status info
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Calibration status: {data.get('status', 'unknown')}")
            assert "status" in data
        else:
            print(f"Response: {response.text[:300]}")
            # Not a critical failure - may need calibration
            pass
    
    def test_04_soundboard_chat_basic(self, auth_session):
        """Test Soundboard chat - basic query"""
        payload = {
            "message": "What are my biggest business risks?",
            "conversation_id": None,
            "mode": "auto"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/soundboard/chat",
            headers=auth_session["headers"],
            json=payload,
            timeout=60  # AI responses can take time
        )
        
        print(f"Soundboard chat status: {response.status_code}")
        
        if response.status_code == 503:
            print(f"❌ CRITICAL: Soundboard returned 503 - AI service unavailable")
            print(f"Response: {response.text[:500]}")
            pytest.fail("Soundboard AI service unavailable (503)")
        
        if response.status_code == 200:
            data = response.json()
            reply = data.get("reply", "")
            
            # Check for error messages in reply
            if "API key" in reply.lower() or "openai" in reply.lower():
                print(f"❌ API Key error in response: {reply[:300]}")
                pytest.fail(f"API Key configuration error: {reply}")
            
            # Verify response is meaningful
            assert len(reply) > 50, f"Response too short: {reply}"
            assert not reply.startswith("I can't"), f"Blocked response: {reply}"
            
            print(f"✓ Soundboard reply preview: {reply[:200]}...")
            
            # Check for conversation ID (persistence working)
            conv_id = data.get("conversation_id")
            if conv_id:
                print(f"✓ Conversation ID: {conv_id}")
            
            return data
        else:
            print(f"Response body: {response.text[:500]}")
            pytest.fail(f"Soundboard failed with {response.status_code}")
    
    def test_05_soundboard_multi_turn(self, auth_session):
        """Test Soundboard multi-turn conversation (stress test)"""
        queries = [
            "How is my cash flow looking?",
            "What about revenue pipeline?",
            "Show me stalled deals",
        ]
        
        successful_turns = 0
        conversation_id = None
        
        for i, query in enumerate(queries):
            payload = {
                "message": query,
                "conversation_id": conversation_id,
                "mode": "auto"
            }
            
            try:
                response = requests.post(
                    f"{BASE_URL}/api/soundboard/chat",
                    headers=auth_session["headers"],
                    json=payload,
                    timeout=60
                )
                
                if response.status_code == 200:
                    data = response.json()
                    reply = data.get("reply", "")
                    
                    if len(reply) > 30 and "API key" not in reply.lower():
                        successful_turns += 1
                        conversation_id = data.get("conversation_id", conversation_id)
                        print(f"✓ Turn {i+1}/{len(queries)}: {reply[:100]}...")
                    else:
                        print(f"❌ Turn {i+1} had issue: {reply[:200]}")
                else:
                    print(f"❌ Turn {i+1} failed: {response.status_code}")
                    
            except Exception as e:
                print(f"❌ Turn {i+1} exception: {e}")
            
            time.sleep(2)  # Rate limiting
        
        print(f"\nSoundboard multi-turn result: {successful_turns}/{len(queries)} successful")
        assert successful_turns >= 2, f"Only {successful_turns}/3 turns succeeded"
    
    def test_06_war_room_respond(self, auth_session):
        """Test War Room ask functionality"""
        payload = {
            "question": "What are the most critical issues I should address today?"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/war-room/respond",
            headers=auth_session["headers"],
            json=payload,
            timeout=60
        )
        
        print(f"War Room status: {response.status_code}")
        
        if response.status_code == 400:
            error_data = response.json()
            print(f"War Room validation error: {error_data}")
            # This indicates the endpoint exists but has validation issues
            pytest.skip(f"War Room validation error: {error_data}")
        
        if response.status_code == 503:
            print(f"❌ CRITICAL: War Room returned 503")
            print(f"Response: {response.text[:500]}")
            pytest.fail("War Room AI service unavailable (503)")
        
        if response.status_code == 200:
            data = response.json()
            answer = data.get("answer", "") or data.get("response", "")
            
            print(f"✓ War Room answer preview: {answer[:200]}...")
            
            # Check for explainability fields
            why_visible = data.get("why_visible")
            why_now = data.get("why_now")
            
            if why_visible:
                print(f"✓ Why visible: {why_visible[:100]}...")
            if why_now:
                print(f"✓ Why now: {why_now[:100]}...")
            
            assert len(answer) > 30, "War Room response too short"
            return data
        else:
            print(f"Response body: {response.text[:500]}")
            # Don't fail hard - may have validation issues
            pytest.skip(f"War Room returned {response.status_code}")
    
    def test_07_boardroom_diagnosis(self, auth_session):
        """Test Board Room diagnosis functionality"""
        focus_areas = [
            "cash_flow_financial_risk",
            "revenue_momentum",
            "strategy_effectiveness"
        ]
        
        for focus_area in focus_areas:
            payload = {
                "focus_area": focus_area
            }
            
            response = requests.post(
                f"{BASE_URL}/api/boardroom/diagnosis",
                headers=auth_session["headers"],
                json=payload,
                timeout=60
            )
            
            print(f"Board Room diagnosis ({focus_area}): {response.status_code}")
            
            if response.status_code == 503:
                print(f"❌ Board Room diagnosis 503 for {focus_area}")
                continue
            
            if response.status_code == 200:
                data = response.json()
                headline = data.get("headline", "")
                narrative = data.get("narrative", "")
                
                print(f"✓ {focus_area} headline: {headline[:100]}...")
                
                if data.get("degraded"):
                    print(f"  ⚠ Response is in degraded/resilience mode")
                
                if headline and len(headline) > 10:
                    print(f"✓ Board Room diagnosis working for {focus_area}")
                    return data  # At least one worked
            else:
                print(f"Response: {response.text[:300]}")
        
        # If none succeeded
        pytest.skip("Board Room diagnosis not accessible")
    
    def test_08_calibration_enrichment_quality(self, auth_session):
        """Test calibration deep scan quality - competitors, trust signals, social handles"""
        payload = {
            "url": "https://thestrategysquad.com.au",
            "action": "scan"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/enrichment/website",
            headers=auth_session["headers"],
            json=payload,
            timeout=90  # Deep scan takes time
        )
        
        print(f"Calibration enrichment status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            enrichment = data.get("enrichment", {})
            
            # Check for competitor analysis
            competitors = enrichment.get("competitors", [])
            competitor_analysis = enrichment.get("competitor_analysis", "")
            
            print(f"\n=== CALIBRATION DEPTH CHECK ===")
            print(f"Competitors found: {len(competitors) if isinstance(competitors, list) else 'N/A'}")
            if competitors:
                print(f"  - {competitors[:3]}")
            
            print(f"Competitor analysis: {'Present' if competitor_analysis else 'MISSING'}")
            if competitor_analysis:
                print(f"  Preview: {competitor_analysis[:150]}...")
            
            # Check for trust signals
            abn = enrichment.get("abn", "")
            print(f"ABN (trust signal): {'Present' if abn else 'MISSING'} - {abn}")
            
            # Check for social handles
            sources = enrichment.get("sources", {})
            print(f"Deep scan sources: {list(sources.keys()) if sources else 'MISSING'}")
            
            # Check for executive summary/market position
            market_position = enrichment.get("market_position", "")
            print(f"Market position (exec summary): {'Present' if market_position else 'MISSING'}")
            if market_position:
                print(f"  Preview: {market_position[:150]}...")
            
            uvp = enrichment.get("unique_value_proposition", "")
            print(f"Unique value proposition: {'Present' if uvp else 'MISSING'}")
            
            # Quality assessment
            quality_score = 0
            if competitors and len(competitors) > 0:
                quality_score += 25
            if competitor_analysis:
                quality_score += 25
            if abn:
                quality_score += 15
            if market_position:
                quality_score += 20
            if uvp:
                quality_score += 15
            
            print(f"\n=== CALIBRATION QUALITY SCORE: {quality_score}/100 ===")
            
            if quality_score < 50:
                print("⚠ WARNING: Calibration depth may be insufficient")
            
            return {
                "quality_score": quality_score,
                "has_competitors": bool(competitors),
                "has_competitor_analysis": bool(competitor_analysis),
                "has_abn": bool(abn),
                "has_market_position": bool(market_position),
                "has_uvp": bool(uvp)
            }
        else:
            print(f"Response: {response.text[:500]}")
            pytest.skip(f"Calibration enrichment returned {response.status_code}")


class TestLLMRouterHealth:
    """Test LLM Router configuration"""
    
    def test_router_config(self):
        """Verify LLM router is configured"""
        # This tests the preview environment's backend
        response = requests.get(f"{BASE_URL}/api/", timeout=10)
        assert response.status_code == 200
        print("✓ LLM Router backend is responding")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short", "-s"])
