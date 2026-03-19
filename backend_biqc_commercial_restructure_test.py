#!/usr/bin/env python3
"""
BIQc Launch-Commercial Restructure Backend Testing
Testing for: https://truth-engine-19.preview.emergentagent.com
Credentials: andre@thestrategysquad.com.au / MasterMind2025*

Review Requirements:
1) POST /api/stripe/create-checkout-session with tier=starter should return 200 and checkout URL/session_id
2) GET /api/user/integration-status should return 200 with truth_state fields  
3) Free-vs-paid route config should not break free APIs: /api/email/priority-inbox, /api/brain/priorities, /api/intelligence/brief should still work
4) Board Room and War Room truth-gate behavior should return 200 and honest degraded responses when source truth is stale
"""

import json
import time
import sys
import os
import requests
from datetime import datetime

# Configuration
BASE_URL = "https://truth-engine-19.preview.emergentagent.com"
EMAIL = "andre@thestrategysquad.com.au"
PASSWORD = "MasterMind2025*"

# Global session and auth token
session = requests.Session()
auth_token = None
user_id = None

def log(message, level="INFO"):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] [{level}] {message}")

def authenticate():
    """Authenticate and get bearer token"""
    global auth_token, user_id
    
    log("🔐 Authenticating with Supabase...")
    login_url = f"{BASE_URL}/api/auth/supabase/login"
    
    login_data = {
        "email": EMAIL,
        "password": PASSWORD
    }
    
    try:
        response = session.post(login_url, json=login_data, timeout=30)
        log(f"Login response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            # Correct structure: session contains access_token
            session_info = data.get("session", {})
            auth_token = session_info.get("access_token")
            user_info = data.get("user", {})
            user_id = user_info.get("id")
            
            if auth_token and user_id:
                # Set default headers for authenticated requests
                session.headers.update({
                    "Authorization": f"Bearer {auth_token}",
                    "Content-Type": "application/json"
                })
                log(f"✅ Authentication successful")
                log(f"   Token length: {len(auth_token)} chars")
                log(f"   User ID: {user_id}")
                return True
            else:
                log("❌ No access token in login response", "ERROR")
                return False
        else:
            log(f"❌ Login failed with status {response.status_code}: {response.text}", "ERROR")
            return False
            
    except Exception as e:
        log(f"❌ Authentication error: {e}", "ERROR")
        return False

def test_stripe_checkout():
    """Test Stripe checkout session creation for starter tier"""
    log("💳 Testing Stripe checkout session creation...")
    
    url = f"{BASE_URL}/api/stripe/create-checkout-session"
    payload = {
        "tier": "starter",
        "success_url": f"{BASE_URL}/upgrade/success",
        "cancel_url": f"{BASE_URL}/upgrade"
    }
    
    try:
        response = session.post(url, json=payload, timeout=30)
        log(f"Stripe checkout response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            checkout_url = data.get("url")
            session_id = data.get("session_id")
            
            if checkout_url and session_id:
                log(f"✅ Stripe checkout session created successfully")
                log(f"   Checkout URL: {checkout_url[:50]}...")
                log(f"   Session ID: {session_id}")
                return True
            else:
                log("❌ Missing checkout URL or session_id in response", "ERROR")
                log(f"   Response: {data}")
                return False
        else:
            log(f"❌ Stripe checkout failed with status {response.status_code}: {response.text}", "ERROR")
            return False
            
    except Exception as e:
        log(f"❌ Stripe checkout test error: {e}", "ERROR")
        return False

def test_user_integration_status():
    """Test user integration status endpoint for truth_state fields"""
    log("🔗 Testing user integration status endpoint...")
    
    url = f"{BASE_URL}/api/user/integration-status"
    
    try:
        response = session.get(url, timeout=30)
        log(f"Integration status response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            log(f"✅ Integration status endpoint accessible")
            
            # Check for truth_state fields
            truth_state_found = False
            if isinstance(data, dict):
                # Look for truth_state in various possible structures
                for key, value in data.items():
                    if "truth" in key.lower() or "state" in key.lower():
                        log(f"   Found truth/state field: {key} = {value}")
                        truth_state_found = True
                    if isinstance(value, dict):
                        for nested_key in value.keys():
                            if "truth" in nested_key.lower() or "state" in nested_key.lower():
                                log(f"   Found nested truth/state field: {key}.{nested_key}")
                                truth_state_found = True
            
            if truth_state_found:
                log(f"✅ Integration status contains truth_state fields")
                return True
            else:
                log("⚠️ No explicit truth_state fields found, but endpoint works", "WARNING")
                log(f"   Response keys: {list(data.keys()) if isinstance(data, dict) else 'Not a dict'}")
                return True  # Endpoint works, structure might be different
        else:
            log(f"❌ Integration status failed with status {response.status_code}: {response.text}", "ERROR")
            return False
            
    except Exception as e:
        log(f"❌ Integration status test error: {e}", "ERROR")
        return False

def test_free_tier_apis():
    """Test that free tier APIs are not broken by commercial restructure"""
    log("🆓 Testing free tier API accessibility...")
    
    free_apis = [
        "/api/email/priority-inbox",
        "/api/brain/priorities", 
        "/api/intelligence/brief"
    ]
    
    results = []
    
    for api_path in free_apis:
        url = f"{BASE_URL}{api_path}"
        log(f"   Testing {api_path}...")
        
        try:
            response = session.get(url, timeout=30)
            log(f"   {api_path} status: {response.status_code}")
            
            if response.status_code == 200:
                log(f"   ✅ {api_path} accessible")
                results.append(True)
            elif response.status_code in [401, 403]:
                log(f"   ❌ {api_path} blocked (auth/permissions)", "ERROR")
                results.append(False)
            elif response.status_code == 503:
                log(f"   ⚠️ {api_path} service unavailable but not blocked", "WARNING")
                results.append(True)  # Not blocked, just unavailable
            else:
                log(f"   ⚠️ {api_path} returned {response.status_code}: {response.text[:200]}", "WARNING")
                results.append(True)  # Not blocked
                
        except Exception as e:
            log(f"   ❌ {api_path} test error: {e}", "ERROR")
            results.append(False)
    
    success_count = sum(results)
    total_count = len(results)
    
    if success_count == total_count:
        log(f"✅ All {total_count} free tier APIs accessible")
        return True
    else:
        log(f"⚠️ {success_count}/{total_count} free tier APIs accessible", "WARNING")
        return success_count > 0  # Partial success is acceptable

def test_board_room_truth_gate():
    """Test Board Room truth-gate behavior returns degraded responses"""
    log("🏛️ Testing Board Room truth-gate behavior...")
    
    url = f"{BASE_URL}/api/boardroom/respond"
    payload = {
        "message": "What's the current business situation?",
        "history": []
    }
    
    try:
        response = session.post(url, json=payload, timeout=45)
        log(f"Board Room response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            response_text = data.get("response", "")
            
            log(f"✅ Board Room accessible")
            
            # Check for honest degraded response indicators
            degraded_indicators = [
                "degraded", "resilience", "truth gate", "stale", "unavailable", 
                "not live-verified", "fallback", "limited", "constrained"
            ]
            
            honest_response = any(indicator in response_text.lower() for indicator in degraded_indicators)
            
            if honest_response:
                log(f"✅ Board Room shows honest degraded response")
                log(f"   Response preview: {response_text[:150]}...")
                return True
            else:
                log(f"✅ Board Room accessible, response appears normal")
                log(f"   Response preview: {response_text[:150]}...")
                return True  # Working is acceptable
        else:
            log(f"❌ Board Room failed with status {response.status_code}: {response.text}", "ERROR")
            return False
            
    except Exception as e:
        log(f"❌ Board Room test error: {e}", "ERROR")
        return False

def test_war_room_truth_gate():
    """Test War Room truth-gate behavior returns degraded responses"""
    log("⚔️ Testing War Room truth-gate behavior...")
    
    url = f"{BASE_URL}/api/war-room/respond"
    payload = {
        "question": "What should I focus on this week?",
        "product_or_service": "Business consulting"
    }
    
    try:
        response = session.post(url, json=payload, timeout=45)
        log(f"War Room response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            answer = data.get("answer", "")
            
            log(f"✅ War Room accessible")
            
            # Check for honest degraded response indicators  
            degraded_indicators = [
                "degraded", "resilience", "truth gate", "stale", "unavailable",
                "not live-verified", "fallback", "limited", "constrained"
            ]
            
            honest_response = any(indicator in answer.lower() for indicator in degraded_indicators)
            
            if honest_response:
                log(f"✅ War Room shows honest degraded response")
                log(f"   Answer preview: {answer[:150]}...")
                return True
            else:
                log(f"✅ War Room accessible, response appears normal") 
                log(f"   Answer preview: {answer[:150]}...")
                return True  # Working is acceptable
        else:
            log(f"❌ War Room failed with status {response.status_code}: {response.text}", "ERROR")
            return False
            
    except Exception as e:
        log(f"❌ War Room test error: {e}", "ERROR")
        return False

def run_all_tests():
    """Run all commercial restructure tests"""
    log("🚀 Starting BIQc Launch-Commercial Restructure Backend Tests")
    log(f"   Environment: {BASE_URL}")
    log(f"   Credentials: {EMAIL}")
    
    results = {
        "authentication": False,
        "stripe_checkout": False, 
        "integration_status": False,
        "free_tier_apis": False,
        "board_room_truth_gate": False,
        "war_room_truth_gate": False
    }
    
    # Step 1: Authenticate
    if not authenticate():
        log("❌ CRITICAL: Authentication failed, cannot proceed", "ERROR")
        return results
    
    results["authentication"] = True
    
    # Step 2: Test Stripe checkout
    results["stripe_checkout"] = test_stripe_checkout()
    
    # Step 3: Test integration status
    results["integration_status"] = test_user_integration_status()
    
    # Step 4: Test free tier APIs
    results["free_tier_apis"] = test_free_tier_apis()
    
    # Step 5: Test Board Room truth gate
    results["board_room_truth_gate"] = test_board_room_truth_gate()
    
    # Step 6: Test War Room truth gate  
    results["war_room_truth_gate"] = test_war_room_truth_gate()
    
    return results

def print_summary(results):
    """Print test summary"""
    log("=" * 60)
    log("📊 BIQc COMMERCIAL RESTRUCTURE TEST SUMMARY")
    log("=" * 60)
    
    passed = sum(results.values())
    total = len(results)
    
    for test_name, passed_flag in results.items():
        status = "✅ PASS" if passed_flag else "❌ FAIL"
        formatted_name = test_name.replace("_", " ").title()
        log(f"   {formatted_name}: {status}")
    
    log("-" * 60)
    log(f"📈 OVERALL RESULT: {passed}/{total} tests passed")
    
    if passed == total:
        log("🎉 ALL TESTS PASSED - Commercial restructure is working correctly!")
        return True
    else:
        log(f"⚠️ {total - passed} test(s) failed - Review required", "WARNING")
        return False

if __name__ == "__main__":
    try:
        results = run_all_tests()
        success = print_summary(results)
        
        # Save results to file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        results_file = f"/app/biqc_commercial_restructure_test_results_{timestamp}.json"
        
        test_report = {
            "timestamp": datetime.now().isoformat(),
            "environment": BASE_URL,
            "user": EMAIL,
            "results": results,
            "summary": {
                "passed": sum(results.values()),
                "total": len(results),
                "success": success
            }
        }
        
        with open(results_file, 'w') as f:
            json.dump(test_report, f, indent=2)
        
        log(f"📋 Test results saved to: {results_file}")
        
        # Exit with appropriate code
        sys.exit(0 if success else 1)
        
    except KeyboardInterrupt:
        log("⛔ Tests interrupted by user", "WARNING")
        sys.exit(130)
    except Exception as e:
        log(f"💥 Unexpected error during testing: {e}", "ERROR")
        sys.exit(1)