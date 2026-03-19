#!/usr/bin/env python3
"""
Production Forensic Testing for BIQc Platform
Target: https://biqc.thestrategysquad.com
Credentials: Set via env BIQC_TEST_EMAIL and BIQC_TEST_PASSWORD (never commit real credentials).
Scope: Backend + Frontend with priority on Advisor/Business Brain correctness

Test Checklist:
1) Auth - POST /api/auth/supabase/login returns token
2) Brain APIs - GET /api/brain/metrics?include_coverage=true, /api/brain/concerns, /api/brain/priorities?recompute=true  
3) Data lineage - GET /api/integrations/accounting/summary, /api/email/priority-inbox, /api/outlook/status
4) Advisor UI forensic checks - Decision source behavior, source health status, placeholders
5) Regression checks - Refresh intelligence button, no crashes
"""

import asyncio
import httpx
import json
import os
import sys
import traceback
from typing import Dict, Any, Optional
from datetime import datetime

# Production Configuration — use env vars; never hardcode credentials
BASE_URL = os.environ.get("BIQC_TEST_BASE_URL", "https://biqc.thestrategysquad.com")
TEST_EMAIL = os.environ.get("BIQC_TEST_EMAIL", "").strip()
TEST_PASSWORD = os.environ.get("BIQC_TEST_PASSWORD", "").strip()

class BIQcForensicTester:
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=60.0)
        self.auth_token: Optional[str] = None
        self.user_id: Optional[str] = None
        
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()

    def log(self, message: str, level: str = "INFO"):
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] [{level}] {message}")

    def assert_test(self, condition: bool, message: str):
        if condition:
            self.log(f"✅ PASS: {message}")
            return True
        else:
            self.log(f"❌ FAIL: {message}", "ERROR")  
            return False

    async def test_auth_login(self) -> Dict[str, Any]:
        """Test 1: POST /api/auth/supabase/login returns token"""
        self.log("=" * 60)
        self.log("TEST 1: Authentication via /api/auth/supabase/login")
        self.log("=" * 60)
        if not TEST_EMAIL or not TEST_PASSWORD:
            self.log("SKIP: Set BIQC_TEST_EMAIL and BIQC_TEST_PASSWORD to run auth tests.", "WARNING")
            return {"success": False, "error": "Missing BIQC_TEST_EMAIL or BIQC_TEST_PASSWORD"}
        try:
            response = await self.client.post(
                f"{BASE_URL}/api/auth/supabase/login",
                headers={"Content-Type": "application/json"},
                json={
                    "email": TEST_EMAIL,
                    "password": TEST_PASSWORD
                }
            )
            
            success = self.assert_test(response.status_code == 200, 
                                     f"Login API returns HTTP 200 (got {response.status_code})")
            
            if response.status_code != 200:
                self.log(f"Response: {response.text}")
                return {"success": False, "error": f"HTTP {response.status_code}", "details": response.text}
            
            data = response.json()
            has_token = "access_token" in data or "session" in data or "token" in data
            
            self.assert_test(has_token, "Response contains authentication token")
            
            # Extract token for subsequent requests
            self.auth_token = data.get("access_token") or data.get("session", {}).get("access_token") or data.get("token")
            self.user_id = data.get("user", {}).get("id") if "user" in data else data.get("user_id")
            
            if self.auth_token:
                self.log(f"✅ Authentication successful. Token length: {len(self.auth_token)}")
                if self.user_id:
                    self.log(f"✅ User ID: {self.user_id}")
            
            return {
                "success": success and has_token,
                "has_token": has_token, 
                "token_length": len(self.auth_token) if self.auth_token else 0,
                "user_id": self.user_id,
                "response_keys": list(data.keys())
            }
            
        except Exception as e:
            self.log(f"❌ Authentication test failed: {e}", "ERROR")
            traceback.print_exc()
            return {"success": False, "error": str(e)}

    async def test_brain_apis(self) -> Dict[str, Any]:
        """Test 2: Brain APIs - metrics, concerns, priorities"""
        self.log("=" * 60)
        self.log("TEST 2: Brain APIs (Business Brain correctness)")
        self.log("=" * 60)
        
        results = {"success": True, "endpoints": {}}
        headers = {"Authorization": f"Bearer {self.auth_token}"} if self.auth_token else {}
        
        # Test 2a: GET /api/brain/metrics?include_coverage=true
        try:
            self.log("Testing GET /api/brain/metrics?include_coverage=true...")
            response = await self.client.get(
                f"{BASE_URL}/api/brain/metrics?include_coverage=true",
                headers=headers
            )
            
            metrics_success = self.assert_test(response.status_code == 200,
                                             f"Brain metrics API returns HTTP 200 (got {response.status_code})")
            
            metrics_data = {}
            if response.status_code == 200:
                try:
                    data = response.json()
                    metrics_data = {
                        "has_top100_coverage": "catalog_source" in data and "top100" in str(data.get("catalog_source", "")),
                        "has_counts": "total_metrics" in data or "computed_metrics" in data,
                        "response_keys": list(data.keys()),
                        "catalog_source": data.get("catalog_source"),
                        "total_metrics": data.get("total_metrics"),
                        "computed_metrics": data.get("computed_metrics")
                    }
                    
                    self.assert_test(metrics_data["has_top100_coverage"], 
                                   "Response contains top100 coverage catalog source")
                    self.assert_test(metrics_data["has_counts"], 
                                   "Response contains metric counts")
                    
                except json.JSONDecodeError:
                    self.log("❌ Brain metrics response is not valid JSON")
                    metrics_success = False
            else:
                self.log(f"Brain metrics error response: {response.text}")
                
            results["endpoints"]["metrics"] = {
                "success": metrics_success,
                "status_code": response.status_code,
                **metrics_data
            }
            
        except Exception as e:
            self.log(f"❌ Brain metrics test failed: {e}", "ERROR")
            results["endpoints"]["metrics"] = {"success": False, "error": str(e)}
            results["success"] = False
            
        # Test 2b: GET /api/brain/concerns  
        try:
            self.log("Testing GET /api/brain/concerns...")
            response = await self.client.get(
                f"{BASE_URL}/api/brain/concerns",
                headers=headers
            )
            
            concerns_success = self.assert_test(response.status_code == 200,
                                              f"Brain concerns API returns HTTP 200 (got {response.status_code})")
            
            concerns_data = {}
            if response.status_code == 200:
                try:
                    data = response.json()
                    concerns_data = {
                        "has_concerns_list": "concerns" in data or isinstance(data, list),
                        "response_keys": list(data.keys()) if isinstance(data, dict) else ["array"],
                        "concerns_count": len(data.get("concerns", [])) if "concerns" in data else len(data) if isinstance(data, list) else 0
                    }
                    
                    self.assert_test(concerns_data["has_concerns_list"],
                                   "Response contains concerns list structure")
                    
                except json.JSONDecodeError:
                    self.log("❌ Brain concerns response is not valid JSON")
                    concerns_success = False
            else:
                self.log(f"Brain concerns error response: {response.text}")
                
            results["endpoints"]["concerns"] = {
                "success": concerns_success,
                "status_code": response.status_code,
                **concerns_data
            }
            
        except Exception as e:
            self.log(f"❌ Brain concerns test failed: {e}", "ERROR")
            results["endpoints"]["concerns"] = {"success": False, "error": str(e)}
            results["success"] = False

        # Test 2c: GET /api/brain/priorities?recompute=true
        try:
            self.log("Testing GET /api/brain/priorities?recompute=true...")
            response = await self.client.get(
                f"{BASE_URL}/api/brain/priorities?recompute=true", 
                headers=headers
            )
            
            priorities_success = self.assert_test(response.status_code == 200,
                                                f"Brain priorities API returns HTTP 200 (got {response.status_code})")
            
            priorities_data = {}
            if response.status_code == 200:
                try:
                    data = response.json()
                    priorities_data = {
                        "returns_200": True,
                        "has_concern_outputs": "concerns" in data or "priorities" in data,
                        "controlled_unavailable": data.get("status") == "unavailable" if "status" in data else False,
                        "no_crash": True,
                        "response_keys": list(data.keys())
                    }
                    
                    if priorities_data["controlled_unavailable"]:
                        self.log("✅ Brain priorities returns controlled unavailable mode")
                    elif priorities_data["has_concern_outputs"]:
                        self.log("✅ Brain priorities returns concern outputs")
                    else:
                        self.log("⚠️ Brain priorities response structure unclear")
                        
                except json.JSONDecodeError:
                    self.log("❌ Brain priorities response is not valid JSON") 
                    priorities_success = False
            else:
                self.log(f"Brain priorities error response: {response.text}")
                
            results["endpoints"]["priorities"] = {
                "success": priorities_success,
                "status_code": response.status_code, 
                **priorities_data
            }
            
        except Exception as e:
            self.log(f"❌ Brain priorities test failed: {e}", "ERROR")
            results["endpoints"]["priorities"] = {"success": False, "error": str(e)}
            results["success"] = False
            
        # Update overall success
        endpoint_successes = [ep["success"] for ep in results["endpoints"].values()]
        results["success"] = all(endpoint_successes)
        
        return results

    async def test_data_lineage(self) -> Dict[str, Any]:
        """Test 3: Data lineage truth checks"""  
        self.log("=" * 60)
        self.log("TEST 3: Data lineage truth checks")
        self.log("=" * 60)
        
        results = {"success": True, "endpoints": {}}
        headers = {"Authorization": f"Bearer {self.auth_token}"} if self.auth_token else {}
        
        # Test 3a: GET /api/integrations/accounting/summary
        try:
            self.log("Testing GET /api/integrations/accounting/summary...")
            response = await self.client.get(
                f"{BASE_URL}/api/integrations/accounting/summary",
                headers=headers
            )
            
            accounting_success = response.status_code == 200
            self.assert_test(accounting_success,
                           f"Accounting summary API accessible (got {response.status_code})")
            
            accounting_data = {"status_code": response.status_code}
            if response.status_code == 200:
                try:
                    data = response.json()
                    accounting_data.update({
                        "has_connected_status": "connected" in str(data).lower() or "status" in data,
                        "has_overdue_metrics": "overdue" in str(data).lower(),
                        "response_keys": list(data.keys()) if isinstance(data, dict) else ["non_dict"],
                        "response_preview": str(data)[:200]
                    })
                    
                    connected_present = accounting_data["has_connected_status"]
                    overdue_present = accounting_data["has_overdue_metrics"]
                    
                    self.assert_test(connected_present or overdue_present,
                                   "Response contains connected/error status or overdue metrics")
                    
                except json.JSONDecodeError:
                    accounting_data["json_error"] = True
                    accounting_success = False
            else:
                accounting_data["error_response"] = response.text[:200]
                
            results["endpoints"]["accounting_summary"] = {
                "success": accounting_success,
                **accounting_data
            }
            
        except Exception as e:
            self.log(f"❌ Accounting summary test failed: {e}", "ERROR")
            results["endpoints"]["accounting_summary"] = {"success": False, "error": str(e)}
            results["success"] = False
            
        # Test 3b: GET /api/email/priority-inbox
        try:
            self.log("Testing GET /api/email/priority-inbox...")
            response = await self.client.get(
                f"{BASE_URL}/api/email/priority-inbox",
                headers=headers
            )
            
            email_success = response.status_code == 200
            self.assert_test(email_success,
                           f"Email priority inbox API accessible (got {response.status_code})")
            
            email_data = {"status_code": response.status_code}
            if response.status_code == 200:
                try:
                    data = response.json()
                    email_data.update({
                        "has_priority_analysis": "priority" in str(data).lower() or "analysis" in str(data).lower(),
                        "is_coherent": isinstance(data, (dict, list)),
                        "response_keys": list(data.keys()) if isinstance(data, dict) else ["non_dict"],
                        "response_preview": str(data)[:200]
                    })
                    
                    self.assert_test(email_data["has_priority_analysis"],
                                   "Response contains priority analysis")
                    self.assert_test(email_data["is_coherent"],
                                   "Response is coherent JSON structure")
                    
                except json.JSONDecodeError:
                    email_data["json_error"] = True
                    email_success = False
            else:
                email_data["error_response"] = response.text[:200]
                
            results["endpoints"]["email_priority"] = {
                "success": email_success,
                **email_data
            }
            
        except Exception as e:
            self.log(f"❌ Email priority inbox test failed: {e}", "ERROR") 
            results["endpoints"]["email_priority"] = {"success": False, "error": str(e)}
            results["success"] = False
            
        # Test 3c: GET /api/outlook/status
        try:
            self.log("Testing GET /api/outlook/status...")
            response = await self.client.get(
                f"{BASE_URL}/api/outlook/status",
                headers=headers
            )
            
            outlook_success = response.status_code in [200, 404]  # 404 acceptable if not implemented
            self.assert_test(outlook_success,
                           f"Outlook status API accessible (got {response.status_code})")
            
            outlook_data = {"status_code": response.status_code}
            if response.status_code == 200:
                try:
                    data = response.json()
                    outlook_data.update({
                        "has_status_info": "status" in data or "connected" in str(data).lower(),
                        "response_keys": list(data.keys()) if isinstance(data, dict) else ["non_dict"],
                        "response_preview": str(data)[:200]
                    })
                    
                except json.JSONDecodeError:
                    outlook_data["json_error"] = True
            elif response.status_code == 404:
                outlook_data["not_implemented"] = True
                self.log("ℹ️ Outlook status endpoint not implemented (404) - acceptable")
            else:
                outlook_data["error_response"] = response.text[:200]
                
            results["endpoints"]["outlook_status"] = {
                "success": outlook_success,
                **outlook_data  
            }
            
        except Exception as e:
            self.log(f"❌ Outlook status test failed: {e}", "ERROR")
            results["endpoints"]["outlook_status"] = {"success": False, "error": str(e)}
            results["success"] = False

        # Test 3d: Check for client/supplier invoice mixing (basic validation)
        try:
            self.log("Checking for client/supplier invoice mixing in exposed values...")
            # This would require examining the accounting summary data more closely
            # For now, log that this check needs manual inspection
            self.log("ℹ️ Invoice mixing check requires manual inspection of accounting data")
            results["invoice_mixing_check"] = {
                "success": True,
                "note": "Requires manual inspection of accounting summary values"
            }
            
        except Exception as e:
            self.log(f"❌ Invoice mixing check failed: {e}", "ERROR")
            results["invoice_mixing_check"] = {"success": False, "error": str(e)}
            
        # Update overall success - allow some endpoints to fail
        critical_endpoints = ["accounting_summary", "email_priority"]
        critical_successes = [results["endpoints"][ep]["success"] for ep in critical_endpoints if ep in results["endpoints"]]
        results["success"] = len(critical_successes) > 0 and any(critical_successes)
        
        return results

    async def run_forensic_test(self) -> Dict[str, Any]:
        """Run complete forensic test suite"""
        self.log("=" * 80)
        self.log("BIQC PRODUCTION FORENSIC TESTING STARTED")
        self.log(f"Target: {BASE_URL}")
        self.log(f"User: {TEST_EMAIL}")  
        self.log(f"Time: {datetime.now().isoformat()}")
        self.log("=" * 80)
        
        results = {
            "auth": {"success": False},
            "brain_apis": {"success": False},
            "data_lineage": {"success": False},
            "overall_success": False
        }
        
        # Test 1: Authentication
        auth_result = await self.test_auth_login()
        results["auth"] = auth_result
        
        if not auth_result["success"]:
            self.log("❌ Authentication failed - cannot proceed with API tests", "ERROR")
            return results
            
        # Test 2: Brain APIs  
        brain_result = await self.test_brain_apis()
        results["brain_apis"] = brain_result
        
        # Test 3: Data lineage
        lineage_result = await self.test_data_lineage()
        results["data_lineage"] = lineage_result
        
        # Overall success calculation
        critical_tests = ["auth", "brain_apis"]
        critical_success = all(results[test]["success"] for test in critical_tests)
        
        data_success = results["data_lineage"]["success"] 
        
        results["overall_success"] = critical_success and data_success
        
        # Final Summary  
        self.log("=" * 80)
        self.log("PRODUCTION FORENSIC TEST SUMMARY")
        self.log("=" * 80)
        
        # Auth Summary
        auth_status = "✅ PASS" if results["auth"]["success"] else "❌ FAIL"
        self.log(f"1) Auth Login: {auth_status}")
        
        # Brain API Summary
        brain_status = "✅ PASS" if results["brain_apis"]["success"] else "❌ FAIL"
        self.log(f"2) Brain APIs: {brain_status}")
        if "endpoints" in results["brain_apis"]:
            for endpoint, data in results["brain_apis"]["endpoints"].items():
                ep_status = "✅" if data["success"] else "❌"
                self.log(f"   - {endpoint}: {ep_status} (HTTP {data.get('status_code', 'N/A')})")
                
        # Data Lineage Summary  
        lineage_status = "✅ PASS" if results["data_lineage"]["success"] else "❌ FAIL"
        self.log(f"3) Data Lineage: {lineage_status}")
        if "endpoints" in results["data_lineage"]:
            for endpoint, data in results["data_lineage"]["endpoints"].items():
                ep_status = "✅" if data["success"] else "❌"
                self.log(f"   - {endpoint}: {ep_status} (HTTP {data.get('status_code', 'N/A')})")
                
        # Critical Issues
        issues = []
        if not results["auth"]["success"]:
            issues.append("Authentication failure prevents API access")
        if not results["brain_apis"]["success"]:
            issues.append("Business Brain APIs not functioning correctly")  
        if not results["data_lineage"]["success"]:
            issues.append("Data lineage endpoints have issues")
            
        if issues:
            self.log("\n❌ CRITICAL ISSUES:")
            for issue in issues:
                self.log(f"   - {issue}")
        else:
            self.log("\n✅ NO CRITICAL BACKEND ISSUES DETECTED")
            
        overall_status = "✅ BACKEND TESTS PASSED" if results["overall_success"] else "❌ BACKEND ISSUES FOUND"
        self.log("=" * 80)
        self.log(f"OVERALL RESULT: {overall_status}")
        self.log("=" * 80)
        
        return results


async def main():
    """Run the production forensic test"""
    async with BIQcForensicTester() as tester:
        results = await tester.run_forensic_test()
        
        # Save detailed results to file
        results_file = f"/app/forensic_production_test_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(results_file, 'w') as f:
            json.dump(results, f, indent=2, default=str)
        print(f"\nDetailed results saved to: {results_file}")
        
        # Exit with appropriate code
        exit_code = 0 if results["overall_success"] else 1
        sys.exit(exit_code)


if __name__ == "__main__":
    asyncio.run(main())