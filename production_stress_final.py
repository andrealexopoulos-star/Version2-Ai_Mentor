#!/usr/bin/env python3
"""
Production Backend Stress Test - CORRECTED
Target: https://biqc.ai
"""

import requests
import json
import time
import uuid
import statistics
from datetime import datetime

BASE_URL = "https://biqc.ai"
API_BASE = f"{BASE_URL}/api"
TEST_EMAIL = "andre@thestrategysquad.com.au"
TEST_PASSWORD = "MasterMind2025*"

def main():
    print("🚀 Production Backend Stress Validation - CORRECTED")
    print(f"Target: {BASE_URL}")
    print("=" * 80)
    
    session = requests.Session()
    results = {
        "timestamp": datetime.now().isoformat(),
        "test_target": BASE_URL,
        "auth": {},
        "soundboard_stress": {
            "total_runs": 0,
            "successful_runs": 0,
            "failed_runs": 0,
            "rate_limited_runs": 0,
            "runs_with_suggested_actions": 0,
            "response_times": [],
            "status_codes": {},
            "errors": []
        },
        "conversation_persistence": {},
        "advisor_endpoints": {},
        "defects": []
    }
    
    # Step 1: Authentication
    print("1. AUTHENTICATION TEST")
    try:
        auth_url = f"{API_BASE}/auth/supabase/login"
        auth_data = {"email": TEST_EMAIL, "password": TEST_PASSWORD}
        
        start_time = time.time()
        auth_response = session.post(auth_url, json=auth_data, timeout=15)
        auth_time = time.time() - start_time
        
        if auth_response.status_code == 200:
            data = auth_response.json()
            access_token = data.get('session', {}).get('access_token')
            user_id = data.get('user', {}).get('id')
            
            if access_token:
                session.headers.update({
                    'Authorization': f'Bearer {access_token}',
                    'Content-Type': 'application/json'
                })
                print(f"   ✅ SUCCESS - User: {user_id}, Time: {auth_time:.2f}s")
                results["auth"] = {
                    "success": True,
                    "user_id": user_id,
                    "response_time": auth_time,
                    "status_code": 200
                }
            else:
                print("   ❌ FAILED - No access token")
                results["auth"] = {"success": False, "error": "No access token", "status_code": 200}
                return results
        else:
            print(f"   ❌ FAILED - HTTP {auth_response.status_code}")
            results["auth"] = {"success": False, "status_code": auth_response.status_code}
            return results
            
    except Exception as e:
        print(f"   ❌ ERROR - {str(e)}")
        results["auth"] = {"success": False, "error": str(e)}
        return results
    
    # Step 2: Soundboard Stress Test (50 runs)
    print("\n2. SOUNDBOARD CHAT STRESS TEST (50 runs)")
    
    prompts = [
        "What are the top 3 revenue risks I should be monitoring right now?",
        "Show me my biggest operational bottlenecks this quarter",
        "What market opportunities am I missing based on my current data?",
        "Which clients are at risk of churning and why?",
        "What are the key performance indicators I should focus on this month?",
        "How can I improve my sales pipeline conversion rate?",
        "What are my competitors doing that I should be aware of?",
        "Show me the most profitable products in my portfolio",
        "What operational inefficiencies are costing me the most money?",
        "Which team members are underperforming and need attention?",
        "What are the biggest threats to my business continuity?",
        "How can I optimize my cash flow management?",
        "What new market segments should I consider entering?",
        "Show me patterns in my customer acquisition costs",
        "What are the early warning signs of market shifts affecting my business?",
        "Which processes should I automate to improve efficiency?",
        "What are my best opportunities for cost reduction?",
        "How can I improve customer satisfaction and retention?",
        "What are the key metrics indicating business health decline?",
        "Show me actionable insights from my recent business data",
    ]
    
    chat_url = f"{API_BASE}/soundboard/chat"
    conversation_ids_created = []
    
    for i in range(1, 51):  # 50 runs
        try:
            prompt = prompts[(i-1) % len(prompts)]
            conversation_id = str(uuid.uuid4())
            
            # CORRECTED: Use 'message' instead of 'question'
            chat_data = {
                "message": prompt,
                "conversation_id": conversation_id,
                "mode": "auto"
            }
            
            start_time = time.time()
            response = session.post(chat_url, json=chat_data, timeout=20)
            response_time = time.time() - start_time
            
            results["soundboard_stress"]["total_runs"] += 1
            results["soundboard_stress"]["response_times"].append(response_time)
            
            # Track status codes
            status = str(response.status_code)
            results["soundboard_stress"]["status_codes"][status] = \
                results["soundboard_stress"]["status_codes"].get(status, 0) + 1
            
            if response.status_code == 200:
                results["soundboard_stress"]["successful_runs"] += 1
                conversation_ids_created.append(conversation_id)
                
                try:
                    data = response.json()
                    has_suggested_actions = bool(data.get('suggested_actions'))
                    if has_suggested_actions:
                        results["soundboard_stress"]["runs_with_suggested_actions"] += 1
                    
                    print(f"   Run {i:2d} ✅ SUCCESS ({response_time:.2f}s) - Suggested actions: {has_suggested_actions}")
                except:
                    print(f"   Run {i:2d} ✅ SUCCESS ({response_time:.2f}s) - JSON parse error")
                    
            elif response.status_code == 429:
                results["soundboard_stress"]["rate_limited_runs"] += 1
                results["soundboard_stress"]["failed_runs"] += 1
                retry_after = response.headers.get('Retry-After', '5')
                print(f"   Run {i:2d} ⏳ RATE LIMITED - Retry after {retry_after}s")
                error_msg = f"Rate limited - retry after {retry_after}s"
                results["soundboard_stress"]["errors"].append(f"Run {i}: {error_msg}")
                time.sleep(min(int(retry_after), 5))  # Wait but cap at 5s
            else:
                results["soundboard_stress"]["failed_runs"] += 1
                error_msg = f"HTTP {response.status_code}"
                results["soundboard_stress"]["errors"].append(f"Run {i}: {error_msg}")
                print(f"   Run {i:2d} ❌ FAILED - {error_msg}")
                
        except Exception as e:
            results["soundboard_stress"]["failed_runs"] += 1
            error_msg = f"Exception: {str(e)}"
            results["soundboard_stress"]["errors"].append(f"Run {i}: {error_msg}")
            print(f"   Run {i:2d} ❌ ERROR - {error_msg}")
        
        # Progress indicator every 10 runs
        if i % 10 == 0:
            success_rate = (results["soundboard_stress"]["successful_runs"] / i) * 100
            print(f"   Progress: {i}/50 ({success_rate:.1f}% success rate)")
        
        # Small delay to avoid overwhelming server
        time.sleep(0.2)
    
    # Soundboard summary
    total = results["soundboard_stress"]["total_runs"]
    successful = results["soundboard_stress"]["successful_runs"]
    suggested_actions = results["soundboard_stress"]["runs_with_suggested_actions"]
    response_times = results["soundboard_stress"]["response_times"]
    
    success_rate = (successful / total) * 100 if total > 0 else 0
    suggested_rate = (suggested_actions / successful) * 100 if successful > 0 else 0
    
    if response_times:
        avg_time = statistics.mean(response_times)
        min_time = min(response_times)
        max_time = max(response_times)
        print(f"\n   SOUNDBOARD SUMMARY:")
        print(f"   Success Rate: {success_rate:.1f}% ({successful}/{total})")
        print(f"   Suggested Actions: {suggested_rate:.1f}% ({suggested_actions}/{successful})")
        print(f"   Response Times: avg {avg_time:.2f}s, min {min_time:.2f}s, max {max_time:.2f}s")
        print(f"   Rate Limited: {results['soundboard_stress']['rate_limited_runs']}")
        print(f"   Status Codes: {results['soundboard_stress']['status_codes']}")
    
    # Step 3: Conversation Persistence
    print("\n3. CONVERSATION PERSISTENCE TEST")
    
    try:
        # Test conversations list endpoint
        conversations_url = f"{API_BASE}/soundboard/conversations"
        response = session.get(conversations_url, timeout=10)
        
        if response.status_code == 200:
            print("   ✅ GET /soundboard/conversations - Success")
            results["conversation_persistence"]["list_endpoint"] = {"success": True, "status_code": 200}
            
            # Test individual conversation retrieval
            conversations_tested = 0
            conversations_retrieved = 0
            
            for conv_id in conversation_ids_created[:5]:  # Test first 5 created conversations
                try:
                    conv_url = f"{API_BASE}/soundboard/conversations/{conv_id}"
                    conv_response = session.get(conv_url, timeout=10)
                    conversations_tested += 1
                    
                    if conv_response.status_code == 200:
                        conversations_retrieved += 1
                        print(f"   ✅ Retrieved conversation {conv_id[:8]}...")
                    else:
                        print(f"   ❌ Failed to retrieve conversation {conv_id[:8]}... - HTTP {conv_response.status_code}")
                        
                except Exception as e:
                    print(f"   ❌ Error retrieving conversation {conv_id[:8]}... - {str(e)}")
            
            retrieval_rate = (conversations_retrieved / conversations_tested) * 100 if conversations_tested > 0 else 0
            print(f"   Conversation retrieval rate: {retrieval_rate:.1f}% ({conversations_retrieved}/{conversations_tested})")
            
            results["conversation_persistence"]["individual_retrieval"] = {
                "tested": conversations_tested,
                "retrieved": conversations_retrieved,
                "success_rate": retrieval_rate
            }
        else:
            print(f"   ❌ GET /soundboard/conversations failed - HTTP {response.status_code}")
            results["conversation_persistence"]["list_endpoint"] = {
                "success": False,
                "status_code": response.status_code
            }
            
    except Exception as e:
        print(f"   ❌ Conversation persistence error - {str(e)}")
        results["conversation_persistence"]["error"] = str(e)
    
    # Step 4: Advisor Feed Dependencies  
    print("\n4. ADVISOR FEED DEPENDENCIES TEST")
    
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
    successful_endpoints = 0
    
    for endpoint in endpoints:
        try:
            url = f"{BASE_URL}{endpoint}"
            start_time = time.time()
            response = session.get(url, timeout=10)
            response_time = time.time() - start_time
            
            if response.status_code == 200:
                print(f"   ✅ {endpoint} ({response_time:.2f}s)")
                endpoint_results[endpoint] = {"success": True, "status_code": 200, "response_time": response_time}
                successful_endpoints += 1
            else:
                print(f"   ❌ {endpoint} - HTTP {response.status_code}")
                endpoint_results[endpoint] = {"success": False, "status_code": response.status_code}
                
        except Exception as e:
            print(f"   ❌ {endpoint} - Error: {str(e)}")
            endpoint_results[endpoint] = {"success": False, "error": str(e)}
    
    endpoint_health = (successful_endpoints / len(endpoints)) * 100
    print(f"\n   ADVISOR ENDPOINTS SUMMARY:")
    print(f"   Health: {endpoint_health:.1f}% ({successful_endpoints}/{len(endpoints)})")
    
    results["advisor_endpoints"] = {
        "total": len(endpoints),
        "successful": successful_endpoints,
        "health_percentage": endpoint_health,
        "details": endpoint_results
    }
    
    # Step 5: Defect Analysis
    print("\n5. DEFECT ANALYSIS")
    
    defects = []
    
    # Authentication defects
    if not results["auth"]["success"]:
        defects.append({
            "severity": "CRITICAL",
            "component": "Authentication",
            "issue": "Login failure",
            "impact": "Blocks all advisor and soundboard functionality"
        })
    
    # Soundboard defects
    if success_rate < 90:
        defects.append({
            "severity": "HIGH" if success_rate < 70 else "MEDIUM",
            "component": "Soundboard Chat API",
            "issue": f"Success rate {success_rate:.1f}% below acceptable threshold (90%)",
            "impact": "Unreliable advisor chat experience"
        })
    
    if results["soundboard_stress"]["rate_limited_runs"] > 10:
        defects.append({
            "severity": "MEDIUM",
            "component": "Rate Limiting",
            "issue": f"{results['soundboard_stress']['rate_limited_runs']} rate limited requests",
            "impact": "User experience degradation under load"
        })
    
    if suggested_rate < 50:
        defects.append({
            "severity": "HIGH",
            "component": "Soundboard Intelligence",
            "issue": f"Low suggested actions rate: {suggested_rate:.1f}%",
            "impact": "Advisor provides limited actionable intelligence"
        })
    
    # Performance defects
    if response_times and statistics.mean(response_times) > 8:
        avg_time = statistics.mean(response_times)
        defects.append({
            "severity": "MEDIUM",
            "component": "Performance",
            "issue": f"High average response time: {avg_time:.2f}s",
            "impact": "Poor user experience"
        })
    
    # Conversation persistence defects
    conv_persistence = results.get("conversation_persistence", {})
    if not conv_persistence.get("list_endpoint", {}).get("success"):
        defects.append({
            "severity": "HIGH",
            "component": "Conversation Persistence",
            "issue": "Conversation list endpoint failure",
            "impact": "Users cannot access chat history"
        })
    
    # Advisor endpoint defects
    if endpoint_health < 80:
        defects.append({
            "severity": "CRITICAL" if endpoint_health < 60 else "HIGH",
            "component": "Advisor Data Feed",
            "issue": f"Low endpoint health: {endpoint_health:.1f}%",
            "impact": "Advisor cannot provide personalized insights"
        })
    
    results["defects"] = defects
    
    if defects:
        print(f"   Found {len(defects)} defects:")
        for i, defect in enumerate(defects, 1):
            print(f"   {i}. [{defect['severity']}] {defect['component']}: {defect['issue']}")
    else:
        print("   ✅ No critical defects found")
    
    # Save detailed results
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    results_file = f"/app/production_stress_final_{timestamp}.json"
    
    with open(results_file, 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"\n📄 Detailed results saved to: {results_file}")
    
    # Final Summary
    print("\n" + "="*80)
    print("PRODUCTION STRESS TEST FINAL SUMMARY")
    print("="*80)
    print(f"Authentication: {'✅ SUCCESS' if results['auth']['success'] else '❌ FAILED'}")
    print(f"Soundboard Success Rate: {success_rate:.1f}% ({successful}/{total} runs)")
    print(f"Suggested Actions Rate: {suggested_rate:.1f}% ({suggested_actions}/{successful} successful runs)")
    print(f"Advisor Endpoint Health: {endpoint_health:.1f}% ({successful_endpoints}/{len(endpoints)} endpoints)")
    print(f"Total Defects: {len(defects)} ({'PRODUCTION READY' if len(defects) == 0 else 'NEEDS FIXES'})")
    print("="*80)
    
    return results

if __name__ == "__main__":
    main()