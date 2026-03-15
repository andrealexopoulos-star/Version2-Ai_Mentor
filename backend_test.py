#!/usr/bin/env python3
"""
Forensic production validation test suite for BIQc platform.
Target: https://biqc.thestrategysquad.com 
Tests both backend API endpoints and frontend integration.
"""
import requests
import json
import sys
import time
from typing import Dict, Any

# Test configuration
BASE_URL = "https://biqc.thestrategysquad.com"
API_URL = f"{BASE_URL}/api"
CREDENTIALS = {
    "email": "andre@thestrategysquad.com.au",
    "password": "MasterMind2025*"
}

class ForensicTester:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'BIQc-Forensic-Validator/1.0'
        })
        self.auth_token = None
        self.test_results = {}
        
    def log(self, message: str, level: str = "INFO"):
        """Log test messages with timestamp"""
        timestamp = time.strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
        
    def test_api_call(self, method: str, endpoint: str, **kwargs) -> tuple:
        """Make API call and return (success, response, error)"""
        url = f"{API_URL}{endpoint}"
        
        try:
            response = self.session.request(method, url, timeout=30, **kwargs)
            return True, response, None
        except Exception as e:
            return False, None, str(e)
    
    def authenticate(self) -> bool:
        """A) Test 1: POST /api/auth/supabase/login returns token"""
        self.log("Testing authentication...")
        
        success, response, error = self.test_api_call(
            "POST", 
            "/auth/supabase/login",
            json=CREDENTIALS
        )
        
        if not success:
            self.log(f"❌ AUTH FAILED - Network error: {error}", "ERROR")
            self.test_results["auth"] = {"status": "FAIL", "error": f"Network error: {error}"}
            return False
            
        if response.status_code != 200:
            self.log(f"❌ AUTH FAILED - HTTP {response.status_code}: {response.text}", "ERROR")
            self.test_results["auth"] = {"status": "FAIL", "error": f"HTTP {response.status_code}: {response.text}"}
            return False
            
        try:
            data = response.json()
            token = data.get('access_token') or data.get('token')
            
            # Check nested session structure
            if not token and 'session' in data:
                session = data.get('session', {})
                token = session.get('access_token') or session.get('token')
            
            if not token:
                self.log(f"❌ AUTH FAILED - No token in response: {data}", "ERROR") 
                self.test_results["auth"] = {"status": "FAIL", "error": "No token in response"}
                return False
                
            self.auth_token = token
            self.session.headers.update({'Authorization': f'Bearer {token}'})
            
            self.log(f"✅ AUTH SUCCESS - Token length: {len(token)} chars")
            self.test_results["auth"] = {"status": "PASS", "token_length": len(token)}
            return True
            
        except Exception as e:
            self.log(f"❌ AUTH FAILED - JSON parse error: {e}", "ERROR")
            self.test_results["auth"] = {"status": "FAIL", "error": f"JSON parse error: {e}"}
            return False
    
    def test_brain_runtime_check(self):
        """A) Test 2: GET /api/brain/runtime-check must return 200 JSON (not 404)"""
        self.log("Testing Brain runtime check...")
        
        success, response, error = self.test_api_call("GET", "/brain/runtime-check")
        
        if not success:
            self.log(f"❌ BRAIN RUNTIME CHECK FAILED - Network error: {error}", "ERROR")
            self.test_results["brain_runtime"] = {"status": "FAIL", "error": f"Network error: {error}"}
            return
            
        if response.status_code == 404:
            self.log("❌ BRAIN RUNTIME CHECK FAILED - Returns 404 (endpoint missing)", "ERROR")
            self.test_results["brain_runtime"] = {"status": "FAIL", "error": "Endpoint returns 404"}
            return
            
        if response.status_code != 200:
            self.log(f"❌ BRAIN RUNTIME CHECK FAILED - HTTP {response.status_code}: {response.text}", "ERROR")
            self.test_results["brain_runtime"] = {"status": "FAIL", "error": f"HTTP {response.status_code}"}
            return
            
        try:
            data = response.json()
            self.log("✅ BRAIN RUNTIME CHECK SUCCESS - Returns 200 JSON")
            self.test_results["brain_runtime"] = {"status": "PASS", "response_keys": list(data.keys())}
        except:
            self.log("❌ BRAIN RUNTIME CHECK FAILED - Invalid JSON response", "ERROR")
            self.test_results["brain_runtime"] = {"status": "FAIL", "error": "Invalid JSON"}
    
    def test_brain_metrics(self):
        """A) Test 3: GET /api/brain/metrics?include_coverage=true verification"""
        self.log("Testing Brain metrics...")
        
        success, response, error = self.test_api_call("GET", "/brain/metrics?include_coverage=true")
        
        if not success:
            self.log(f"❌ BRAIN METRICS FAILED - Network error: {error}", "ERROR")
            self.test_results["brain_metrics"] = {"status": "FAIL", "error": f"Network error: {error}"}
            return
            
        if response.status_code != 200:
            self.log(f"❌ BRAIN METRICS FAILED - HTTP {response.status_code}: {response.text}", "ERROR")
            self.test_results["brain_metrics"] = {"status": "FAIL", "error": f"HTTP {response.status_code}"}
            return
            
        try:
            data = response.json()
            
            # Check expected values
            total_metrics = data.get('total_metrics')
            business_core_ready = data.get('business_core_ready')
            runtime_catalog_metric_count = data.get('runtime_catalog_metric_count')
            
            results = {
                "status": "PARTIAL",
                "total_metrics": total_metrics,
                "business_core_ready": business_core_ready, 
                "runtime_catalog_metric_count": runtime_catalog_metric_count
            }
            
            issues = []
            if total_metrics != 100:
                issues.append(f"total_metrics expected 100, got {total_metrics}")
            if business_core_ready != True:
                issues.append(f"business_core_ready expected true, got {business_core_ready}")
            if runtime_catalog_metric_count != 100:
                issues.append(f"runtime_catalog_metric_count expected 100, got {runtime_catalog_metric_count}")
                
            if issues:
                results["status"] = "FAIL"
                results["issues"] = issues
                self.log(f"❌ BRAIN METRICS FAILED - Issues: {', '.join(issues)}", "ERROR")
            else:
                results["status"] = "PASS"
                self.log("✅ BRAIN METRICS SUCCESS - All values match expectations")
                
            self.test_results["brain_metrics"] = results
            
        except Exception as e:
            self.log(f"❌ BRAIN METRICS FAILED - JSON parse error: {e}", "ERROR")
            self.test_results["brain_metrics"] = {"status": "FAIL", "error": f"JSON parse error: {e}"}
    
    def test_brain_priorities(self):
        """A) Test 4: GET /api/brain/priorities?recompute=true returns concerns list"""
        self.log("Testing Brain priorities...")
        
        success, response, error = self.test_api_call("GET", "/brain/priorities?recompute=true")
        
        if not success:
            self.log(f"❌ BRAIN PRIORITIES FAILED - Network error: {error}", "ERROR")
            self.test_results["brain_priorities"] = {"status": "FAIL", "error": f"Network error: {error}"}
            return
            
        if response.status_code != 200:
            self.log(f"❌ BRAIN PRIORITIES FAILED - HTTP {response.status_code}: {response.text}", "ERROR") 
            self.test_results["brain_priorities"] = {"status": "FAIL", "error": f"HTTP {response.status_code}"}
            return
            
        try:
            data = response.json()
            
            # Look for concerns list and check for generic fallback errors
            concerns = data.get('concerns', [])
            response_str = str(data)
            
            results = {
                "status": "PARTIAL",
                "concerns_count": len(concerns),
                "response_keys": list(data.keys())
            }
            
            # Check for generic fallback errors
            generic_phrases = ['generic fallback', 'placeholder', 'default response']
            has_generic_fallback = any(phrase in response_str.lower() for phrase in generic_phrases)
            
            if has_generic_fallback:
                results["status"] = "FAIL"
                results["error"] = "Contains generic fallback errors"
                self.log("❌ BRAIN PRIORITIES FAILED - Contains generic fallback errors", "ERROR")
            else:
                results["status"] = "PASS"
                self.log(f"✅ BRAIN PRIORITIES SUCCESS - {len(concerns)} concerns, no generic fallbacks")
                
            self.test_results["brain_priorities"] = results
            
        except Exception as e:
            self.log(f"❌ BRAIN PRIORITIES FAILED - JSON parse error: {e}", "ERROR")
            self.test_results["brain_priorities"] = {"status": "FAIL", "error": f"JSON parse error: {e}"}
    
    def test_integrations_accounting(self):
        """B) Test 5: GET /api/integrations/accounting/summary"""
        self.log("Testing accounting integration...")
        
        success, response, error = self.test_api_call("GET", "/integrations/accounting/summary")
        
        if not success:
            self.log(f"❌ ACCOUNTING INTEGRATION FAILED - Network error: {error}", "ERROR")
            self.test_results["accounting_integration"] = {"status": "FAIL", "error": f"Network error: {error}"}
            return
            
        if response.status_code != 200:
            self.log(f"❌ ACCOUNTING INTEGRATION FAILED - HTTP {response.status_code}: {response.text}", "ERROR")
            self.test_results["accounting_integration"] = {"status": "FAIL", "error": f"HTTP {response.status_code}"}
            return
            
        try:
            data = response.json()
            
            connected = data.get('connected')
            overdue_metrics = data.get('overdue_metrics') or data.get('overdue')
            
            results = {
                "status": "PASS",
                "connected": connected,
                "has_overdue_metrics": overdue_metrics is not None,
                "response_keys": list(data.keys())
            }
            
            self.log(f"✅ ACCOUNTING INTEGRATION SUCCESS - Connected: {connected}, Overdue data: {overdue_metrics is not None}")
            self.test_results["accounting_integration"] = results
            
        except Exception as e:
            self.log(f"❌ ACCOUNTING INTEGRATION FAILED - JSON parse error: {e}", "ERROR")
            self.test_results["accounting_integration"] = {"status": "FAIL", "error": f"JSON parse error: {e}"}
    
    def test_outlook_and_email(self):
        """B) Test 6: GET /api/outlook/status and /api/email/priority-inbox"""
        self.log("Testing Outlook status...")
        
        # Test Outlook status
        success, response, error = self.test_api_call("GET", "/outlook/status")
        
        outlook_result = {"endpoint": "/outlook/status"}
        if not success:
            outlook_result.update({"status": "FAIL", "error": f"Network error: {error}"})
        elif response.status_code != 200:
            outlook_result.update({"status": "FAIL", "error": f"HTTP {response.status_code}"})
        else:
            try:
                data = response.json()
                outlook_result.update({
                    "status": "PASS",
                    "response_keys": list(data.keys())
                })
            except:
                outlook_result.update({"status": "FAIL", "error": "Invalid JSON"})
        
        # Test email priority inbox
        self.log("Testing email priority inbox...")
        success, response, error = self.test_api_call("GET", "/email/priority-inbox")
        
        email_result = {"endpoint": "/email/priority-inbox"}
        if not success:
            email_result.update({"status": "FAIL", "error": f"Network error: {error}"})
        elif response.status_code != 200:
            email_result.update({"status": "FAIL", "error": f"HTTP {response.status_code}"})
        else:
            try:
                data = response.json()
                has_analysis = bool(data and (len(data) > 0 or 'analysis' in str(data)))
                email_result.update({
                    "status": "PASS",
                    "has_analysis": has_analysis,
                    "response_keys": list(data.keys()) if isinstance(data, dict) else f"Array length: {len(data)}"
                })
            except:
                email_result.update({"status": "FAIL", "error": "Invalid JSON"})
        
        # Combined results
        combined_status = "PASS" if outlook_result.get("status") == "PASS" and email_result.get("status") == "PASS" else "FAIL"
        
        self.test_results["outlook_email"] = {
            "status": combined_status,
            "outlook": outlook_result,
            "email": email_result
        }
        
        if combined_status == "PASS":
            self.log("✅ OUTLOOK & EMAIL SUCCESS - Both endpoints functional")
        else:
            self.log("❌ OUTLOOK & EMAIL FAILED - One or more endpoints failed", "ERROR")
    
    def run_backend_tests(self):
        """Run all backend API tests"""
        self.log("🔍 STARTING FORENSIC PRODUCTION VALIDATION")
        self.log(f"Target: {BASE_URL}")
        self.log(f"API: {API_URL}")
        self.log(f"Credentials: {CREDENTIALS['email']}")
        
        # Authentication is required for all other tests
        if not self.authenticate():
            self.log("❌ AUTHENTICATION FAILED - Cannot proceed with other tests", "ERROR")
            return False
            
        # Run all Brain API tests
        self.test_brain_runtime_check()
        self.test_brain_metrics()
        self.test_brain_priorities()
        
        # Run integration tests  
        self.test_integrations_accounting()
        self.test_outlook_and_email()
        
        return True
    
    def print_summary(self):
        """Print detailed test summary"""
        self.log("=" * 60)
        self.log("📊 FORENSIC VALIDATION SUMMARY")
        self.log("=" * 60)
        
        total_tests = len(self.test_results)
        passed = sum(1 for r in self.test_results.values() if r.get("status") == "PASS")
        failed = sum(1 for r in self.test_results.values() if r.get("status") == "FAIL")
        partial = sum(1 for r in self.test_results.values() if r.get("status") == "PARTIAL")
        
        self.log(f"Total Tests: {total_tests}")
        self.log(f"✅ PASS: {passed}")
        self.log(f"❌ FAIL: {failed}")
        self.log(f"⚠️ PARTIAL: {partial}")
        
        self.log("")
        self.log("DETAILED RESULTS:")
        
        # A) Auth + Brain API checks
        self.log("A) Auth + Brain API checks:")
        for test_name in ["auth", "brain_runtime", "brain_metrics", "brain_priorities"]:
            result = self.test_results.get(test_name, {"status": "NOT_RUN"})
            status = result["status"]
            icon = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
            
            if test_name == "auth":
                self.log(f"  1) {icon} POST /api/auth/supabase/login: {status}")
            elif test_name == "brain_runtime": 
                self.log(f"  2) {icon} GET /api/brain/runtime-check: {status}")
            elif test_name == "brain_metrics":
                self.log(f"  3) {icon} GET /api/brain/metrics?include_coverage=true: {status}")
                if "issues" in result:
                    for issue in result["issues"]:
                        self.log(f"     - {issue}")
            elif test_name == "brain_priorities":
                self.log(f"  4) {icon} GET /api/brain/priorities?recompute=true: {status}")
        
        # B) Integration truth checks  
        self.log("B) Integration truth checks:")
        outlook_email = self.test_results.get("outlook_email", {"status": "NOT_RUN"})
        accounting = self.test_results.get("accounting_integration", {"status": "NOT_RUN"})
        
        acc_icon = "✅" if accounting["status"] == "PASS" else "❌"
        self.log(f"  5) {acc_icon} GET /api/integrations/accounting/summary: {accounting['status']}")
        
        oe_icon = "✅" if outlook_email["status"] == "PASS" else "❌"
        self.log(f"  6) {oe_icon} GET /api/outlook/status + /api/email/priority-inbox: {outlook_email['status']}")
        
        # Print any errors
        self.log("")
        self.log("ERRORS & ISSUES:")
        for test_name, result in self.test_results.items():
            if result.get("status") in ["FAIL", "PARTIAL"] and "error" in result:
                self.log(f"  {test_name}: {result['error']}")
            if "issues" in result:
                for issue in result["issues"]:
                    self.log(f"  {test_name}: {issue}")

def main():
    """Main test runner"""
    tester = ForensicTester()
    
    success = tester.run_backend_tests()
    tester.print_summary()
    
    if not success or any(r.get("status") == "FAIL" for r in tester.test_results.values()):
        sys.exit(1)

if __name__ == "__main__":
    main()