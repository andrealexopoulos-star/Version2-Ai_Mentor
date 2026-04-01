#!/usr/bin/env python3
"""
Minimal Production Backend Validation for BIQc Platform
Target: https://biqc.ai
"""

import requests
import json
import time
from datetime import datetime

BASE_URL = "https://biqc.ai"
API_BASE = f"{BASE_URL}/api"
TEST_EMAIL = "andre@thestrategysquad.com.au"
TEST_PASSWORD = "MasterMind2025*"

def main():
    print("🚀 Production Backend Validation")
    print(f"Target: {BASE_URL}")
    print("=" * 60)
    
    session = requests.Session()
    results = {"timestamp": datetime.now().isoformat()}
    
    # Step 1: Authentication
    print("1. Testing Authentication...")
    try:
        auth_url = f"{API_BASE}/auth/supabase/login"
        auth_data = {"email": TEST_EMAIL, "password": TEST_PASSWORD}
        
        auth_response = session.post(auth_url, json=auth_data, timeout=10)
        
        if auth_response.status_code == 200:
            data = auth_response.json()
            access_token = data.get('session', {}).get('access_token')
            user_id = data.get('user', {}).get('id')
            
            if access_token:
                session.headers.update({'Authorization': f'Bearer {access_token}'})
                print(f"✅ Authentication SUCCESS - User: {user_id}")
                results["auth"] = {"success": True, "user_id": user_id}
            else:
                print("❌ Authentication FAILED - No access token")
                results["auth"] = {"success": False, "error": "No access token"}
                return results
        else:
            print(f"❌ Authentication FAILED - HTTP {auth_response.status_code}")
            results["auth"] = {"success": False, "status_code": auth_response.status_code}
            return results
            
    except Exception as e:
        print(f"❌ Authentication ERROR - {str(e)}")
        results["auth"] = {"success": False, "error": str(e)}
        return results
    
    # Step 2: Test 5 Soundboard Chat Runs
    print("\n2. Testing Soundboard Chat (5 runs)...")
    soundboard_results = {"total": 0, "success": 0, "errors": []}
    
    prompts = [
        "What are my top 3 revenue risks right now?",
        "Show me my biggest operational bottlenecks",
        "What market opportunities am I missing?",
        "Which clients are at risk of churning?",
        "What are my key performance indicators this month?"
    ]
    
    chat_url = f"{API_BASE}/soundboard/chat"
    for i, prompt in enumerate(prompts, 1):
        try:
            chat_data = {
                "question": prompt,
                "conversation_id": f"test-conv-{i}",
                "mode": "auto"
            }
            
            response = session.post(chat_url, json=chat_data, timeout=15)
            soundboard_results["total"] += 1
            
            if response.status_code == 200:
                data = response.json()
                has_suggested_actions = bool(data.get('suggested_actions'))
                soundboard_results["success"] += 1
                print(f"  Run {i} ✅ SUCCESS - Suggested actions: {has_suggested_actions}")
            else:
                error = f"HTTP {response.status_code}"
                soundboard_results["errors"].append(f"Run {i}: {error}")
                print(f"  Run {i} ❌ FAILED - {error}")
                
        except Exception as e:
            error = f"Exception: {str(e)}"
            soundboard_results["errors"].append(f"Run {i}: {error}")
            print(f"  Run {i} ❌ ERROR - {error}")
    
    success_rate = (soundboard_results["success"] / soundboard_results["total"]) * 100
    print(f"Soundboard Success Rate: {success_rate:.1f}% ({soundboard_results['success']}/{soundboard_results['total']})")
    results["soundboard"] = soundboard_results
    
    # Step 3: Test Conversation Persistence
    print("\n3. Testing Conversation Persistence...")
    try:
        conversations_url = f"{API_BASE}/soundboard/conversations"
        response = session.get(conversations_url, timeout=10)
        
        if response.status_code == 200:
            print("✅ Conversations endpoint accessible")
            results["conversations"] = {"success": True}
        else:
            print(f"❌ Conversations endpoint failed - HTTP {response.status_code}")
            results["conversations"] = {"success": False, "status_code": response.status_code}
            
    except Exception as e:
        print(f"❌ Conversations endpoint error - {str(e)}")
        results["conversations"] = {"success": False, "error": str(e)}
    
    # Step 4: Test Advisor Feed Dependencies
    print("\n4. Testing Advisor Feed Dependencies...")
    
    endpoints = [
        "/api/cognition/overview",
        "/api/snapshot/latest",
        "/api/intelligence/watchtower", 
        "/api/integrations/merge/connected",
        "/api/integrations/crm/deals?page_size=50",
        "/api/integrations/accounting/summary",
        "/api/outlook/status",
        "/api/calibration/status"
    ]
    
    endpoint_results = {}
    
    for endpoint in endpoints:
        try:
            url = f"{BASE_URL}{endpoint}"
            response = session.get(url, timeout=8)
            
            if response.status_code == 200:
                print(f"  ✅ {endpoint}")
                endpoint_results[endpoint] = {"success": True, "status_code": 200}
            else:
                print(f"  ❌ {endpoint} - HTTP {response.status_code}")
                endpoint_results[endpoint] = {"success": False, "status_code": response.status_code}
                
        except Exception as e:
            print(f"  ❌ {endpoint} - Error: {str(e)}")
            endpoint_results[endpoint] = {"success": False, "error": str(e)}
    
    successful_endpoints = sum(1 for r in endpoint_results.values() if r.get('success'))
    total_endpoints = len(endpoints)
    
    print(f"Endpoint Health: {successful_endpoints}/{total_endpoints} working")
    results["advisor_endpoints"] = {
        "total": total_endpoints,
        "successful": successful_endpoints,
        "details": endpoint_results
    }
    
    # Step 5: Generate Defect Summary  
    print("\n5. Defect Summary:")
    defects = []
    
    if not results["auth"]["success"]:
        defects.append("CRITICAL: Authentication failure blocks all functionality")
    
    if soundboard_results["success"] < soundboard_results["total"] * 0.8:
        defects.append(f"HIGH: Soundboard low success rate ({success_rate:.1f}%)")
    
    if not results.get("conversations", {}).get("success"):
        defects.append("HIGH: Conversation persistence failure")
    
    if successful_endpoints < total_endpoints * 0.7:
        defects.append(f"CRITICAL: Advisor feed unhealthy ({successful_endpoints}/{total_endpoints} endpoints)")
    
    if defects:
        for i, defect in enumerate(defects, 1):
            print(f"  {i}. {defect}")
    else:
        print("  ✅ No critical defects found")
    
    results["defects"] = defects
    
    # Save results
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    results_file = f"/app/production_validation_results_{timestamp}.json"
    
    with open(results_file, 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"\n📄 Results saved to: {results_file}")
    print("=" * 60)
    
    return results

if __name__ == "__main__":
    main()