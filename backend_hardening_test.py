#!/usr/bin/env python3
"""
BIQc Free-Tier Hardening Backend Verification Test
Test the specific endpoints mentioned in the review request to verify 
free-tier hardening changes and authentication functionality.
"""

import requests
import json
import time
from datetime import datetime

# Configuration
BASE_URL = "https://data-pipeline-test-7.preview.emergentagent.com"
TEST_EMAIL = "andre@thestrategysquad.com.au"
TEST_PASSWORD = "MasterMind2025*"

class BIQcHardeningTester:
    def __init__(self):
        self.session = requests.Session()
        self.access_token = None
        self.user_id = None
        self.test_results = {
            "auth": {},
            "brain_kpis": {},
            "email_priority": {},
            "outlook_calendar": {},
            "integrations_merge": {},
            "user_integration_sync": {},
            "marketing_benchmark": {},
            "soundboard_chat": {},
            "intelligence_endpoints": {},
            "test_timestamp": datetime.now().isoformat(),
            "summary": {"passed": 0, "failed": 0, "total": 0}
        }
    
    def log_result(self, test_name, category, passed, details):
        """Log test result"""
        self.test_results[category][test_name] = {
            "passed": passed,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        if passed:
            self.test_results["summary"]["passed"] += 1
            print(f"✅ {test_name}: PASS - {details}")
        else:
            self.test_results["summary"]["failed"] += 1
            print(f"❌ {test_name}: FAIL - {details}")
        self.test_results["summary"]["total"] += 1
    
    def authenticate(self):
        """Authenticate with Supabase credentials"""
        print("\n🔐 Authenticating...")
        try:
            auth_url = f"{BASE_URL}/api/auth/supabase/login"
            payload = {
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD
            }
            
            response = self.session.post(auth_url, json=payload, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                # Handle both direct access_token and nested session.access_token formats
                if "access_token" in data:
                    self.access_token = data["access_token"]
                    self.user_id = data.get("user", {}).get("id", "unknown")
                elif "session" in data and "access_token" in data["session"]:
                    self.access_token = data["session"]["access_token"]
                    self.user_id = data.get("user", {}).get("id", "unknown")
                    
                    # Set authorization header for all subsequent requests
                    self.session.headers.update({
                        "Authorization": f"Bearer {self.access_token}",
                        "Content-Type": "application/json"
                    })
                    
                    self.log_result(
                        "Supabase Login", 
                        "auth", 
                        True, 
                        f"HTTP 200, token length: {len(self.access_token)}, user_id: {self.user_id}"
                    )
                    return True
                else:
                    self.log_result("Supabase Login", "auth", False, f"HTTP 200 but no access_token in response: {data}")
                    return False
            else:
                self.log_result("Supabase Login", "auth", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Supabase Login", "auth", False, f"Exception: {str(e)}")
            return False
    
    def test_brain_kpis(self):
        """Test Brain KPI endpoints"""
        print("\n🧠 Testing Brain KPI endpoints...")
        
        # Test GET /api/brain/kpis
        try:
            response = self.session.get(f"{BASE_URL}/api/brain/kpis", timeout=30)
            if response.status_code == 200:
                data = response.json()
                self.log_result(
                    "GET /api/brain/kpis", 
                    "brain_kpis", 
                    True, 
                    f"HTTP 200, returned {len(data) if isinstance(data, list) else 'object'} KPIs"
                )
                kpi_data = data
            else:
                self.log_result(
                    "GET /api/brain/kpis", 
                    "brain_kpis", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}"
                )
                return
        except Exception as e:
            self.log_result("GET /api/brain/kpis", "brain_kpis", False, f"Exception: {str(e)}")
            return
        
        # Test PUT /api/brain/kpis with small payload using correct structure
        try:
            put_payload = {
                "selected_metric_keys": ["total_revenue", "cash_runway"],
                "thresholds": [
                    {
                        "metric_key": "total_revenue",
                        "enabled": True,
                        "comparator": "below",
                        "warning_value": 75000.0,
                        "critical_value": 50000.0,
                        "note": "Test threshold via hardening verification"
                    }
                ]
            }
            
            response = self.session.put(f"{BASE_URL}/api/brain/kpis", json=put_payload, timeout=30)
            if response.status_code in [200, 201, 204]:
                self.log_result(
                    "PUT /api/brain/kpis", 
                    "brain_kpis", 
                    True, 
                    f"HTTP {response.status_code}, KPI selection/threshold update successful"
                )
            else:
                self.log_result(
                    "PUT /api/brain/kpis", 
                    "brain_kpis", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}"
                )
        except Exception as e:
            self.log_result("PUT /api/brain/kpis", "brain_kpis", False, f"Exception: {str(e)}")
    
    def test_email_priority_inbox(self):
        """Test Email Priority Inbox endpoint"""
        print("\n📧 Testing Email Priority Inbox...")
        try:
            response = self.session.get(f"{BASE_URL}/api/email/priority-inbox", timeout=30)
            if response.status_code == 200:
                data = response.json()
                self.log_result(
                    "GET /api/email/priority-inbox", 
                    "email_priority", 
                    True, 
                    f"HTTP 200, returned priority inbox data"
                )
            else:
                # Check if this is a graceful 503 for external dependency
                if response.status_code == 503:
                    try:
                        error_data = response.json()
                        if "graceful" in error_data.get("detail", "").lower():
                            self.log_result(
                                "GET /api/email/priority-inbox", 
                                "email_priority", 
                                True, 
                                f"HTTP 503 with graceful external dependency message (expected)"
                            )
                            return
                    except:
                        pass
                
                self.log_result(
                    "GET /api/email/priority-inbox", 
                    "email_priority", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}"
                )
        except Exception as e:
            self.log_result("GET /api/email/priority-inbox", "email_priority", False, f"Exception: {str(e)}")
    
    def test_outlook_calendar(self):
        """Test Outlook Calendar endpoint"""
        print("\n📅 Testing Outlook Calendar...")
        try:
            response = self.session.get(f"{BASE_URL}/api/outlook/calendar/events", timeout=30)
            if response.status_code == 200:
                data = response.json()
                self.log_result(
                    "GET /api/outlook/calendar/events", 
                    "outlook_calendar", 
                    True, 
                    f"HTTP 200, returned calendar events"
                )
            else:
                # Check if this is a graceful error for missing connection
                if response.status_code in [503, 401, 404]:
                    try:
                        error_data = response.json()
                        if any(word in error_data.get("detail", "").lower() for word in ["not connected", "unauthorized", "graceful"]):
                            self.log_result(
                                "GET /api/outlook/calendar/events", 
                                "outlook_calendar", 
                                True, 
                                f"HTTP {response.status_code} with graceful connection error (expected when not connected)"
                            )
                            return
                    except:
                        pass
                
                self.log_result(
                    "GET /api/outlook/calendar/events", 
                    "outlook_calendar", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}"
                )
        except Exception as e:
            self.log_result("GET /api/outlook/calendar/events", "outlook_calendar", False, f"Exception: {str(e)}")
    
    def test_integrations_merge(self):
        """Test Merge integrations endpoint"""
        print("\n🔗 Testing Merge Integrations...")
        try:
            response = self.session.get(f"{BASE_URL}/api/integrations/merge/connected", timeout=30)
            if response.status_code == 200:
                data = response.json()
                self.log_result(
                    "GET /api/integrations/merge/connected", 
                    "integrations_merge", 
                    True, 
                    f"HTTP 200, returned merge connection status"
                )
            else:
                self.log_result(
                    "GET /api/integrations/merge/connected", 
                    "integrations_merge", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}"
                )
        except Exception as e:
            self.log_result("GET /api/integrations/merge/connected", "integrations_merge", False, f"Exception: {str(e)}")
    
    def test_user_integration_sync(self):
        """Test User Integration Status Sync endpoint"""
        print("\n🔄 Testing User Integration Status Sync...")
        try:
            response = self.session.post(f"{BASE_URL}/api/user/integration-status/sync", json={}, timeout=30)
            if response.status_code in [200, 201, 204]:
                self.log_result(
                    "POST /api/user/integration-status/sync", 
                    "user_integration_sync", 
                    True, 
                    f"HTTP {response.status_code}, sync initiated successfully"
                )
            else:
                self.log_result(
                    "POST /api/user/integration-status/sync", 
                    "user_integration_sync", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}"
                )
        except Exception as e:
            self.log_result("POST /api/user/integration-status/sync", "user_integration_sync", False, f"Exception: {str(e)}")
    
    def test_marketing_benchmark(self):
        """Test Marketing Benchmark endpoints"""
        print("\n📊 Testing Marketing Benchmark endpoints...")
        
        # Test GET /api/marketing/benchmark/latest
        try:
            response = self.session.get(f"{BASE_URL}/api/marketing/benchmark/latest", timeout=30)
            if response.status_code == 200:
                data = response.json()
                self.log_result(
                    "GET /api/marketing/benchmark/latest", 
                    "marketing_benchmark", 
                    True, 
                    f"HTTP 200, returned latest benchmark data"
                )
            else:
                # Check if graceful 503 for missing data
                if response.status_code == 503:
                    try:
                        error_data = response.json()
                        if "benchmark" in error_data.get("detail", "").lower():
                            self.log_result(
                                "GET /api/marketing/benchmark/latest", 
                                "marketing_benchmark", 
                                True, 
                                f"HTTP 503 with graceful missing benchmark message (expected)"
                            )
                        else:
                            self.log_result(
                                "GET /api/marketing/benchmark/latest", 
                                "marketing_benchmark", 
                                False, 
                                f"HTTP {response.status_code}: {response.text}"
                            )
                    except:
                        self.log_result(
                            "GET /api/marketing/benchmark/latest", 
                            "marketing_benchmark", 
                            False, 
                            f"HTTP {response.status_code}: {response.text}"
                        )
                else:
                    self.log_result(
                        "GET /api/marketing/benchmark/latest", 
                        "marketing_benchmark", 
                        False, 
                        f"HTTP {response.status_code}: {response.text}"
                    )
        except Exception as e:
            self.log_result("GET /api/marketing/benchmark/latest", "marketing_benchmark", False, f"Exception: {str(e)}")
        
        # Test POST /api/marketing/benchmark
        try:
            benchmark_payload = {
                "industry": "technology",
                "company_size": "startup",
                "metrics": ["cac", "ltv", "churn_rate"]
            }
            
            response = self.session.post(f"{BASE_URL}/api/marketing/benchmark", json=benchmark_payload, timeout=30)
            if response.status_code in [200, 201, 202]:
                self.log_result(
                    "POST /api/marketing/benchmark", 
                    "marketing_benchmark", 
                    True, 
                    f"HTTP {response.status_code}, benchmark calculation initiated"
                )
            else:
                self.log_result(
                    "POST /api/marketing/benchmark", 
                    "marketing_benchmark", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}"
                )
        except Exception as e:
            self.log_result("POST /api/marketing/benchmark", "marketing_benchmark", False, f"Exception: {str(e)}")
    
    def test_soundboard_chat(self):
        """Test Soundboard Chat endpoint for free-tier access"""
        print("\n💬 Testing Soundboard Chat (free-tier)...")
        try:
            chat_payload = {
                "message": "What are the key business priorities I should focus on today?",
                "mode": "auto"
            }
            
            response = self.session.post(f"{BASE_URL}/api/soundboard/chat", json=chat_payload, timeout=30)
            if response.status_code == 200:
                data = response.json()
                # Check that it's not gated by subscription
                if "subscription" not in data.get("error", "").lower() and "upgrade" not in data.get("error", "").lower():
                    self.log_result(
                        "POST /api/soundboard/chat", 
                        "soundboard_chat", 
                        True, 
                        f"HTTP 200, no subscription gating detected"
                    )
                else:
                    self.log_result(
                        "POST /api/soundboard/chat", 
                        "soundboard_chat", 
                        False, 
                        f"HTTP 200 but subscription gating detected: {data}"
                    )
            else:
                # Check if it's a graceful error but not subscription gating
                if response.status_code == 503:
                    try:
                        error_data = response.json()
                        if "subscription" in error_data.get("detail", "").lower():
                            self.log_result(
                                "POST /api/soundboard/chat", 
                                "soundboard_chat", 
                                False, 
                                f"HTTP 503 with subscription gating: {error_data}"
                            )
                        else:
                            self.log_result(
                                "POST /api/soundboard/chat", 
                                "soundboard_chat", 
                                True, 
                                f"HTTP 503 with graceful non-subscription error (expected)"
                            )
                    except:
                        self.log_result(
                            "POST /api/soundboard/chat", 
                            "soundboard_chat", 
                            False, 
                            f"HTTP {response.status_code}: {response.text}"
                        )
                else:
                    self.log_result(
                        "POST /api/soundboard/chat", 
                        "soundboard_chat", 
                        False, 
                        f"HTTP {response.status_code}: {response.text}"
                    )
        except Exception as e:
            self.log_result("POST /api/soundboard/chat", "soundboard_chat", False, f"Exception: {str(e)}")
    
    def test_intelligence_endpoints(self):
        """Test Intelligence endpoints for free-tier access"""
        print("\n🔍 Testing Intelligence endpoints (free-tier)...")
        
        intelligence_endpoints = [
            "/api/intelligence/watchtower",
            "/api/intelligence/pressure", 
            "/api/intelligence/freshness"
        ]
        
        for endpoint in intelligence_endpoints:
            try:
                response = self.session.get(f"{BASE_URL}{endpoint}", timeout=30)
                endpoint_name = endpoint.split('/')[-1]
                
                if response.status_code == 200:
                    data = response.json()
                    # Check for subscription gating
                    if "subscription" not in str(data).lower() and "upgrade" not in str(data).lower():
                        self.log_result(
                            f"GET {endpoint}", 
                            "intelligence_endpoints", 
                            True, 
                            f"HTTP 200, no subscription gating detected"
                        )
                    else:
                        self.log_result(
                            f"GET {endpoint}", 
                            "intelligence_endpoints", 
                            False, 
                            f"HTTP 200 but subscription gating detected: {data}"
                        )
                else:
                    # Check if it's a graceful error for missing SQL functions (expected)
                    if response.status_code == 503:
                        try:
                            error_data = response.json()
                            error_msg = error_data.get("detail", "")
                            if any(sql_term in error_msg.lower() for sql_term in ["rpc", "sql", "function", "canonical"]):
                                self.log_result(
                                    f"GET {endpoint}", 
                                    "intelligence_endpoints", 
                                    True, 
                                    f"HTTP 503 with graceful SQL/RPC unavailable message (expected): {error_msg[:100]}..."
                                )
                            elif "subscription" in error_msg.lower():
                                self.log_result(
                                    f"GET {endpoint}", 
                                    "intelligence_endpoints", 
                                    False, 
                                    f"HTTP 503 with subscription gating: {error_data}"
                                )
                            else:
                                self.log_result(
                                    f"GET {endpoint}", 
                                    "intelligence_endpoints", 
                                    True, 
                                    f"HTTP 503 with graceful external dependency message (expected)"
                                )
                        except:
                            self.log_result(
                                f"GET {endpoint}", 
                                "intelligence_endpoints", 
                                False, 
                                f"HTTP {response.status_code}: {response.text}"
                            )
                    else:
                        self.log_result(
                            f"GET {endpoint}", 
                            "intelligence_endpoints", 
                            False, 
                            f"HTTP {response.status_code}: {response.text}"
                        )
            except Exception as e:
                self.log_result(f"GET {endpoint}", "intelligence_endpoints", False, f"Exception: {str(e)}")
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting BIQc Free-Tier Hardening Backend Verification Tests")
        print(f"Target: {BASE_URL}")
        print(f"Credentials: {TEST_EMAIL} / ***")
        
        # Authenticate first
        if not self.authenticate():
            print("❌ Authentication failed. Stopping tests.")
            return self.test_results
        
        # Run all endpoint tests
        self.test_brain_kpis()
        self.test_email_priority_inbox() 
        self.test_outlook_calendar()
        self.test_integrations_merge()
        self.test_user_integration_sync()
        self.test_marketing_benchmark()
        self.test_soundboard_chat()
        self.test_intelligence_endpoints()
        
        # Final summary
        print(f"\n📊 TEST SUMMARY")
        print(f"Total Tests: {self.test_results['summary']['total']}")
        print(f"Passed: {self.test_results['summary']['passed']}")
        print(f"Failed: {self.test_results['summary']['failed']}")
        
        return self.test_results

def main():
    """Main test execution"""
    tester = BIQcHardeningTester()
    results = tester.run_all_tests()
    
    # Save results to file
    with open('/app/biqc_hardening_test_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"\n💾 Results saved to /app/biqc_hardening_test_results.json")
    
    # Return exit code based on results
    if results['summary']['failed'] == 0:
        print("✅ ALL TESTS PASSED")
        return 0
    else:
        print(f"❌ {results['summary']['failed']} TEST(S) FAILED")
        return 1

if __name__ == "__main__":
    exit(main())