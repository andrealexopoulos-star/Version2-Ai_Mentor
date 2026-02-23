#!/usr/bin/env python3
"""
BIQc Backend Performance Testing
Tests the API endpoints that serve the frontend pages mentioned in the performance requirements.
"""

import requests
import json
import time
import os
import sys
from typing import Dict, List, Tuple

# Get backend URL from environment
BACKEND_URL = os.getenv('REACT_APP_BACKEND_URL', 'https://admin-portal-launch.preview.emergentagent.com')
API_BASE_URL = f"{BACKEND_URL}/api"

# Test credentials
TEST_EMAIL = "andre@thestrategysquad.com.au"
TEST_PASSWORD = "BIQc_Test_2026!"

class BIQcPerformanceTest:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.results = []
        
    def measure_time(self, func, *args, **kwargs) -> Tuple[float, any]:
        """Measure execution time of a function in seconds"""
        start_time = time.perf_counter()
        result = func(*args, **kwargs)
        end_time = time.perf_counter()
        duration = end_time - start_time
        return duration, result
        
    def log_result(self, test_name: str, url: str, duration: float, status_code: int, 
                   success: bool, notes: str = "", data_preview: str = ""):
        """Log test result"""
        result = {
            "test": test_name,
            "url": url,
            "duration_seconds": round(duration, 3),
            "duration_ms": round(duration * 1000, 1),
            "status_code": status_code,
            "success": success,
            "notes": notes,
            "data_preview": data_preview[:200] if data_preview else ""
        }
        self.results.append(result)
        print(f"✅ {test_name}: {duration:.3f}s ({duration*1000:.1f}ms) - Status: {status_code}")
        if notes:
            print(f"   Notes: {notes}")
        if not success:
            print(f"❌ FAILED: {notes}")
    
    def test_login(self) -> bool:
        """Test login performance and get auth token"""
        print("\n=== STEP 1: LOGIN PERFORMANCE ===")
        
        # Test Supabase login endpoint
        login_url = f"{API_BASE_URL}/auth/supabase/login"
        login_data = {
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        }
        
        try:
            duration, response = self.measure_time(
                self.session.post, 
                login_url, 
                json=login_data,
                timeout=30
            )
            
            if response.status_code == 200:
                token_data = response.json()
                # Supabase auth response has session.access_token
                if token_data.get("session") and token_data["session"].get("access_token"):
                    self.auth_token = token_data["session"]["access_token"]
                    self.session.headers.update({
                        "Authorization": f"Bearer {self.auth_token}"
                    })
                    self.log_result(
                        "LOGIN", login_url, duration, response.status_code, True,
                        "Login successful, Supabase token obtained"
                    )
                    return True
                else:
                    self.log_result(
                        "LOGIN", login_url, duration, response.status_code, False,
                        f"No access_token in session: {list(token_data.keys())}"
                    )
            else:
                self.log_result(
                    "LOGIN", login_url, duration, response.status_code, False,
                    f"Login failed: {response.text[:100]}"
                )
        except Exception as e:
            self.log_result(
                "LOGIN", login_url, 0, 0, False,
                f"Login error: {str(e)}"
            )
        
        return False
    
    def test_endpoint(self, name: str, endpoint: str, expected_data_keys: List[str] = None) -> Dict:
        """Test a specific API endpoint"""
        url = f"{API_BASE_URL}/{endpoint}"
        
        try:
            duration, response = self.measure_time(
                self.session.get,
                url,
                timeout=30
            )
            
            success = response.status_code == 200
            notes = ""
            data_preview = ""
            
            if success:
                try:
                    data = response.json()
                    data_preview = json.dumps(data, indent=2)
                    
                    # Check for expected data structure
                    if expected_data_keys:
                        missing_keys = []
                        for key in expected_data_keys:
                            if key not in data:
                                missing_keys.append(key)
                        
                        if missing_keys:
                            notes = f"Missing expected keys: {missing_keys}"
                        else:
                            notes = "All expected data keys present"
                    
                    # Check for data source information
                    if isinstance(data, dict):
                        if "data_sources" in data:
                            notes += f" | Data sources: {data.get('data_sources', [])}"
                        if "cached" in data:
                            notes += f" | Cached: {data.get('cached', False)}"
                        if "snapshot_updated" in data:
                            notes += f" | Snapshot updated: {data.get('snapshot_updated', False)}"
                            
                except json.JSONDecodeError:
                    data_preview = response.text[:200]
                    notes = "Non-JSON response"
            else:
                notes = f"HTTP {response.status_code}: {response.text[:100]}"
            
            self.log_result(name, url, duration, response.status_code, success, notes, data_preview)
            
            return {
                "success": success,
                "duration": duration,
                "status_code": response.status_code,
                "data": data if success else None
            }
            
        except Exception as e:
            self.log_result(name, url, 0, 0, False, f"Error: {str(e)}")
            return {"success": False, "duration": 0, "error": str(e)}
    
    def run_all_tests(self):
        """Run all performance tests"""
        print("🚀 Starting BIQc Backend Performance Tests")
        print(f"Testing against: {API_BASE_URL}")
        
        # Step 1: Login
        if not self.test_login():
            print("❌ Login failed - cannot continue with authenticated tests")
            return
        
        print("\n=== STEP 2: BIQc INSIGHTS (/advisor) ===")
        self.test_endpoint("ADVISOR_INTELLIGENCE", "executive-mirror", ["agent_persona", "executive_memo"])
        
        print("\n=== STEP 3: STRATEGIC CONSOLE (/war-room) ===")
        self.test_endpoint("STRATEGIC_CONSOLE", "strategic-console/briefing", ["system_state", "decision_pressure_index"])
        
        print("\n=== STEP 4: BOARD ROOM (/board-room) ===")
        # Boardroom needs POST with message, so test GET endpoint first
        self.test_endpoint("BOARDROOM_STATUS", "intelligence/watchtower", ["events"])
        
        print("\n=== STEP 5: SOUNDBOARD (/soundboard) ===")
        self.test_endpoint("SOUNDBOARD", "soundboard/conversations", ["conversations"])
        
        print("\n=== STEP 6: MARKET ANALYSIS (/market-analysis) ===")
        self.test_endpoint("MARKET_ANALYSIS", "intelligence/baseline-snapshot", ["snapshot"])
        
        print("\n=== STEP 7: BUSINESS DNA (/business-profile) ===")
        self.test_endpoint("BUSINESS_PROFILE", "business-profile", ["business_name", "industry"])
        
        print("\n=== STEP 8: INTEGRATIONS (/integrations) ===")
        self.test_endpoint("INTEGRATIONS", "integrations/merge/connected", ["integrations"])
        
        print("\n=== STEP 9: EMAIL INBOX (/email-inbox) ===")
        self.test_endpoint("EMAIL_INBOX", "intelligence/data-readiness", ["integrations"])
        
        print("\n=== STEP 10: SETTINGS (/settings) ===")
        self.test_endpoint("SETTINGS", "business-profile/scores", ["completeness", "strength"])
        
        print("\n=== STEP 11: ADMIN CONSOLE (/admin) ===")
        self.test_endpoint("ADMIN_CONSOLE", "dashboard/stats", ["total_analyses", "total_documents"])
        
        print("\n=== STEP 12: SECOND VISIT TO /advisor (Cache Test) ===")
        result = self.test_endpoint("ADVISOR_INTELLIGENCE_CACHED", "executive-mirror", ["agent_persona"])
        
        # Compare with first visit
        first_visit = next((r for r in self.results if r["test"] == "ADVISOR_INTELLIGENCE"), None)
        if first_visit and result["success"]:
            improvement = first_visit["duration_seconds"] - result["duration"]
            if improvement > 0:
                print(f"🚀 Cache Performance: {improvement:.3f}s faster ({improvement*1000:.1f}ms)")
            else:
                print(f"⚠️ No cache improvement detected")
    
    def generate_summary(self):
        """Generate final summary table"""
        print("\n" + "="*80)
        print("FINAL SUMMARY TABLE")
        print("="*80)
        
        # Table header
        print(f"{'Screen':<25} {'URL':<30} {'Load Time':<12} {'Status':<10} {'Notes':<20}")
        print("-" * 97)
        
        # Map tests to screen names
        screen_mapping = {
            "LOGIN": "Login",
            "ADVISOR_INTELLIGENCE": "BIQc Insights",
            "STRATEGIC_CONSOLE": "Strategic Console", 
            "BOARDROOM": "Board Room",
            "SOUNDBOARD": "Soundboard",
            "MARKET_ANALYSIS": "Market Analysis",
            "BUSINESS_PROFILE": "Business DNA",
            "INTEGRATIONS": "Integrations",
            "EMAIL_INBOX": "Email Inbox",
            "SETTINGS": "Settings",
            "ADMIN_CONSOLE": "Admin Console",
            "ADVISOR_INTELLIGENCE_CACHED": "BIQc Insights (Cached)"
        }
        
        for result in self.results:
            screen = screen_mapping.get(result["test"], result["test"])
            url_short = result["url"].split("/")[-1] if "/" in result["url"] else result["url"]
            duration_str = f"{result['duration_ms']:.1f}ms"
            status = "✅ OK" if result["success"] else "❌ FAIL"
            notes = result["notes"][:18] + "..." if len(result["notes"]) > 18 else result["notes"]
            
            print(f"{screen:<25} {url_short:<30} {duration_str:<12} {status:<10} {notes:<20}")
        
        # Performance summary
        successful_tests = [r for r in self.results if r["success"]]
        if successful_tests:
            avg_time = sum(r["duration_seconds"] for r in successful_tests) / len(successful_tests)
            fastest = min(successful_tests, key=lambda x: x["duration_seconds"])
            slowest = max(successful_tests, key=lambda x: x["duration_seconds"])
            
            print(f"\n📊 PERFORMANCE SUMMARY:")
            print(f"   Average Response Time: {avg_time:.3f}s ({avg_time*1000:.1f}ms)")
            print(f"   Fastest: {fastest['test']} - {fastest['duration_ms']:.1f}ms")
            print(f"   Slowest: {slowest['test']} - {slowest['duration_ms']:.1f}ms")
            print(f"   Success Rate: {len(successful_tests)}/{len(self.results)} ({len(successful_tests)/len(self.results)*100:.1f}%)")

if __name__ == "__main__":
    tester = BIQcPerformanceTest()
    tester.run_all_tests()
    tester.generate_summary()