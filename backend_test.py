#!/usr/bin/env python3
"""
Final Backend Sanity Check for BIQc Business Brain 100-Metric Fix
Testing against: https://advisor-engine.preview.emergentagent.com
Credentials: andre@thestrategysquad.com.au / MasterMind2025*

Review Requirements:
1. Auth/login works for the provided user
2. GET /api/brain/runtime-check returns 200 and reports catalog_metric_count=100
3. GET /api/brain/metrics?include_coverage=true returns 200 and total_metrics=100
4. GET /api/brain/priorities returns 200 and a valid JSON structure
5. Flag any backend regressions or mismatches
"""

import os
import json
import requests
import time
import sys
from datetime import datetime
from typing import Dict, Any, Optional

# Test configuration
BASE_URL = "https://advisor-engine.preview.emergentagent.com"
TEST_EMAIL = "andre@thestrategysquad.com.au"
TEST_PASSWORD = "MasterMind2025*"
REQUEST_TIMEOUT = 30

class BrainBackendTester:
    def __init__(self):
        self.token: Optional[str] = None
        self.user_id: Optional[str] = None
        self.results: Dict[str, Any] = {}
        self.start_time = time.time()

    def log(self, message: str, level: str = "INFO"):
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] [{level}] {message}")

    def test_auth_login(self) -> bool:
        """Requirement 1: Auth/login works for the provided user."""
        self.log("Testing authentication login...")
        
        try:
            response = requests.post(
                f"{BASE_URL}/api/auth/supabase/login",
                json={
                    "email": TEST_EMAIL,
                    "password": TEST_PASSWORD
                },
                timeout=REQUEST_TIMEOUT
            )
            
            if response.status_code != 200:
                self.log(f"❌ Login failed with status {response.status_code}: {response.text}", "ERROR")
                self.results["auth_login"] = {"status": "FAIL", "error": f"HTTP {response.status_code}"}
                return False
                
            data = response.json()
            session = data.get("session", {})
            self.token = session.get("access_token")
            user = data.get("user", {})  # User is at top level, not inside session
            self.user_id = user.get("id")
            
            if not self.token:
                self.log("❌ No access token received", "ERROR")
                self.results["auth_login"] = {"status": "FAIL", "error": "No access token"}
                return False
                
            if not self.user_id:
                self.log("❌ No user ID received", "ERROR")
                self.results["auth_login"] = {"status": "FAIL", "error": "No user ID"}
                return False
                
            self.log(f"✅ Authentication successful - User ID: {self.user_id}")
            self.log(f"✅ Token length: {len(self.token)} chars")
            self.results["auth_login"] = {
                "status": "PASS", 
                "user_id": self.user_id,
                "token_length": len(self.token)
            }
            return True
            
        except Exception as e:
            self.log(f"❌ Login exception: {str(e)}", "ERROR")
            self.results["auth_login"] = {"status": "FAIL", "error": str(e)}
            return False

    def test_runtime_check(self) -> bool:
        """Requirement 2: GET /api/brain/runtime-check returns 200 and reports catalog_metric_count=100."""
        self.log("Testing /api/brain/runtime-check endpoint...")
        
        if not self.token:
            self.log("❌ No auth token for runtime-check test", "ERROR")
            self.results["runtime_check"] = {"status": "FAIL", "error": "No auth token"}
            return False
            
        try:
            response = requests.get(
                f"{BASE_URL}/api/brain/runtime-check",
                headers={"Authorization": f"Bearer {self.token}"},
                timeout=REQUEST_TIMEOUT
            )
            
            if response.status_code != 200:
                self.log(f"❌ runtime-check failed with status {response.status_code}: {response.text}", "ERROR")
                self.results["runtime_check"] = {"status": "FAIL", "error": f"HTTP {response.status_code}"}
                return False
                
            data = response.json()
            catalog_metric_count = data.get("catalog_metric_count")
            
            if catalog_metric_count != 100:
                self.log(f"❌ Expected catalog_metric_count=100, got {catalog_metric_count}", "ERROR")
                self.results["runtime_check"] = {
                    "status": "FAIL", 
                    "error": f"catalog_metric_count={catalog_metric_count}, expected 100",
                    "response_data": data
                }
                return False
                
            # Additional verification
            catalog_source = data.get("catalog_source_resolved", "")
            business_core_ready = data.get("business_core_ready")
            
            self.log(f"✅ runtime-check returns 200 OK")
            self.log(f"✅ catalog_metric_count = {catalog_metric_count}")
            self.log(f"✅ catalog_source = {catalog_source}")
            self.log(f"✅ business_core_ready = {business_core_ready}")
            
            self.results["runtime_check"] = {
                "status": "PASS",
                "catalog_metric_count": catalog_metric_count,
                "catalog_source_resolved": catalog_source,
                "business_core_ready": business_core_ready
            }
            return True
            
        except Exception as e:
            self.log(f"❌ runtime-check exception: {str(e)}", "ERROR")
            self.results["runtime_check"] = {"status": "FAIL", "error": str(e)}
            return False

    def test_metrics_coverage(self) -> bool:
        """Requirement 3: GET /api/brain/metrics?include_coverage=true returns 200 and total_metrics=100."""
        self.log("Testing /api/brain/metrics?include_coverage=true endpoint...")
        
        if not self.token:
            self.log("❌ No auth token for metrics coverage test", "ERROR")
            self.results["metrics_coverage"] = {"status": "FAIL", "error": "No auth token"}
            return False
            
        try:
            response = requests.get(
                f"{BASE_URL}/api/brain/metrics?include_coverage=true",
                headers={"Authorization": f"Bearer {self.token}"},
                timeout=REQUEST_TIMEOUT
            )
            
            if response.status_code != 200:
                self.log(f"❌ metrics endpoint failed with status {response.status_code}: {response.text}", "ERROR")
                self.results["metrics_coverage"] = {"status": "FAIL", "error": f"HTTP {response.status_code}"}
                return False
                
            data = response.json()
            total_metrics = data.get("total_metrics")
            
            if total_metrics != 100:
                self.log(f"❌ Expected total_metrics=100, got {total_metrics}", "ERROR")
                self.results["metrics_coverage"] = {
                    "status": "FAIL", 
                    "error": f"total_metrics={total_metrics}, expected 100",
                    "response_data": data
                }
                return False
                
            # Additional verification
            runtime_catalog_metric_count = data.get("runtime_catalog_metric_count")
            computed_metrics = data.get("computed_metrics")
            metrics_array = data.get("metrics", [])
            catalog_source = data.get("catalog_source")
            
            self.log(f"✅ metrics endpoint returns 200 OK")
            self.log(f"✅ total_metrics = {total_metrics}")
            self.log(f"✅ runtime_catalog_metric_count = {runtime_catalog_metric_count}")
            self.log(f"✅ computed_metrics = {computed_metrics}")
            self.log(f"✅ metrics array length = {len(metrics_array)}")
            self.log(f"✅ catalog_source = {catalog_source}")
            
            self.results["metrics_coverage"] = {
                "status": "PASS",
                "total_metrics": total_metrics,
                "runtime_catalog_metric_count": runtime_catalog_metric_count,
                "computed_metrics": computed_metrics,
                "metrics_array_length": len(metrics_array),
                "catalog_source": catalog_source
            }
            return True
            
        except Exception as e:
            self.log(f"❌ metrics coverage exception: {str(e)}", "ERROR")
            self.results["metrics_coverage"] = {"status": "FAIL", "error": str(e)}
            return False

    def test_priorities_endpoint(self) -> bool:
        """Requirement 4: GET /api/brain/priorities returns 200 and a valid JSON structure."""
        self.log("Testing /api/brain/priorities endpoint...")
        
        if not self.token:
            self.log("❌ No auth token for priorities test", "ERROR")
            self.results["priorities_endpoint"] = {"status": "FAIL", "error": "No auth token"}
            return False
            
        try:
            response = requests.get(
                f"{BASE_URL}/api/brain/priorities?recompute=true",
                headers={"Authorization": f"Bearer {self.token}"},
                timeout=45  # Longer timeout for potentially slow endpoint
            )
            
            if response.status_code != 200:
                self.log(f"❌ priorities endpoint failed with status {response.status_code}: {response.text}", "ERROR")
                self.results["priorities_endpoint"] = {"status": "FAIL", "error": f"HTTP {response.status_code}"}
                return False
                
            data = response.json()
            
            # Validate JSON structure
            required_fields = ["tenant_id", "concerns"]
            for field in required_fields:
                if field not in data:
                    self.log(f"❌ Missing required field '{field}' in priorities response", "ERROR")
                    self.results["priorities_endpoint"] = {
                        "status": "FAIL", 
                        "error": f"Missing field: {field}",
                        "response_data": data
                    }
                    return False
                    
            concerns = data.get("concerns", [])
            if not isinstance(concerns, list):
                self.log(f"❌ 'concerns' should be a list, got {type(concerns)}", "ERROR")
                self.results["priorities_endpoint"] = {"status": "FAIL", "error": "concerns not a list"}
                return False
                
            tenant_id = data.get("tenant_id")
            tier_mode = data.get("tier_mode")
            business_core_ready = data.get("business_core_ready")
            concerns_count = len(concerns)
            
            self.log(f"✅ priorities endpoint returns 200 OK")
            self.log(f"✅ Valid JSON structure with required fields")
            self.log(f"✅ tenant_id = {tenant_id}")
            self.log(f"✅ concerns count = {concerns_count}")
            self.log(f"✅ tier_mode = {tier_mode}")
            self.log(f"✅ business_core_ready = {business_core_ready}")
            
            # Log concern details if available
            for i, concern in enumerate(concerns[:3]):  # Show first 3
                concern_id = concern.get("concern_id")
                priority_score = concern.get("priority_score")
                self.log(f"✅ Concern {i+1}: {concern_id} (priority: {priority_score})")
            
            self.results["priorities_endpoint"] = {
                "status": "PASS",
                "tenant_id": tenant_id,
                "concerns_count": concerns_count,
                "tier_mode": tier_mode,
                "business_core_ready": business_core_ready,
                "sample_concerns": [c.get("concern_id") for c in concerns[:3]]
            }
            return True
            
        except Exception as e:
            self.log(f"❌ priorities endpoint exception: {str(e)}", "ERROR")
            self.results["priorities_endpoint"] = {"status": "FAIL", "error": str(e)}
            return False

    def check_for_regressions(self) -> bool:
        """Requirement 5: Flag any backend regressions or mismatches."""
        self.log("Checking for backend regressions...")
        
        regressions = []
        warnings = []
        
        # Check if all core tests passed
        core_tests = ["auth_login", "runtime_check", "metrics_coverage", "priorities_endpoint"]
        failed_tests = [test for test in core_tests if self.results.get(test, {}).get("status") != "PASS"]
        
        if failed_tests:
            regressions.extend([f"Core test failed: {test}" for test in failed_tests])
        
        # Check catalog source consistency
        runtime_source = self.results.get("runtime_check", {}).get("catalog_source_resolved", "")
        metrics_source = self.results.get("metrics_coverage", {}).get("catalog_source", "")
        
        if runtime_source and metrics_source and runtime_source != metrics_source:
            warnings.append(f"Catalog source mismatch: runtime='{runtime_source}' vs metrics='{metrics_source}'")
        
        # Check metric count consistency  
        runtime_count = self.results.get("runtime_check", {}).get("catalog_metric_count")
        metrics_count = self.results.get("metrics_coverage", {}).get("total_metrics")
        
        if runtime_count and metrics_count and runtime_count != metrics_count:
            regressions.append(f"Metric count mismatch: runtime={runtime_count} vs metrics={metrics_count}")
        
        # Check if using fallback catalog
        if "fallback" in runtime_source.lower():
            warnings.append(f"Using fallback catalog instead of JSON file: {runtime_source}")
        
        # Check business_core_ready consistency
        runtime_core = self.results.get("runtime_check", {}).get("business_core_ready")
        priorities_core = self.results.get("priorities_endpoint", {}).get("business_core_ready")
        
        if runtime_core is not None and priorities_core is not None and runtime_core != priorities_core:
            warnings.append(f"business_core_ready mismatch: runtime={runtime_core} vs priorities={priorities_core}")
        
        if regressions:
            self.log("❌ REGRESSIONS DETECTED:")
            for regression in regressions:
                self.log(f"  • {regression}", "ERROR")
            self.results["regressions"] = {"status": "FAIL", "issues": regressions}
            return False
        
        if warnings:
            self.log("⚠️  WARNINGS DETECTED:")
            for warning in warnings:
                self.log(f"  • {warning}", "WARN")
        
        self.log("✅ No critical backend regressions detected")
        self.results["regressions"] = {
            "status": "PASS", 
            "warnings": warnings,
            "issues": []
        }
        return True

    def generate_summary(self):
        """Generate final test summary."""
        elapsed_time = time.time() - self.start_time
        
        self.log(f"\n{'='*80}")
        self.log("FINAL BACKEND SANITY CHECK SUMMARY")
        self.log(f"{'='*80}")
        
        self.log(f"Target Backend: {BASE_URL}")
        self.log(f"Test User: {TEST_EMAIL}")
        self.log(f"Execution Time: {elapsed_time:.1f}s")
        self.log("")
        
        # Test results
        test_results = [
            ("1. Auth/Login", "auth_login"),
            ("2. Runtime Check (100 metrics)", "runtime_check"),
            ("3. Metrics Coverage (100 metrics)", "metrics_coverage"),
            ("4. Priorities Endpoint", "priorities_endpoint"),
            ("5. Regression Check", "regressions")
        ]
        
        all_passed = True
        for name, key in test_results:
            status = self.results.get(key, {}).get("status", "NOT_RUN")
            if status == "PASS":
                self.log(f"✅ {name}: PASS")
            else:
                self.log(f"❌ {name}: {status}", "ERROR")
                error = self.results.get(key, {}).get("error", "Unknown error")
                self.log(f"   Error: {error}", "ERROR")
                all_passed = False
        
        self.log("")
        
        if all_passed:
            self.log("🎉 ALL TESTS PASSED - BACKEND IS READY FOR DEPLOYMENT")
            self.log("✅ Business Brain 100-metric fix verification COMPLETE")
        else:
            self.log("❌ SOME TESTS FAILED - BACKEND NEEDS ATTENTION")
            self.log("❌ Business Brain 100-metric fix verification INCOMPLETE")
        
        self.log(f"{'='*80}")
        
        return all_passed

    def run_all_tests(self) -> bool:
        """Execute all backend sanity checks."""
        self.log("Starting BIQc Business Brain 100-Metric Backend Sanity Check")
        self.log(f"Target: {BASE_URL}")
        self.log("")
        
        # Execute tests in order
        tests = [
            ("Auth Login", self.test_auth_login),
            ("Runtime Check", self.test_runtime_check),
            ("Metrics Coverage", self.test_metrics_coverage),
            ("Priorities Endpoint", self.test_priorities_endpoint),
            ("Regression Check", self.check_for_regressions)
        ]
        
        for test_name, test_func in tests:
            self.log(f"\n{'-'*60}")
            self.log(f"Running: {test_name}")
            self.log(f"{'-'*60}")
            
            try:
                success = test_func()
                if not success and test_name == "Auth Login":
                    self.log("❌ Authentication failed - cannot continue with remaining tests", "ERROR")
                    break
            except Exception as e:
                self.log(f"❌ Unexpected error in {test_name}: {str(e)}", "ERROR")
                self.results[test_name.lower().replace(" ", "_")] = {"status": "ERROR", "error": str(e)}
        
        return self.generate_summary()


def main():
    """Main entry point for backend testing."""
    tester = BrainBackendTester()
    success = tester.run_all_tests()
    
    # Save results to file for review
    with open("/app/brain_backend_test_results.json", "w") as f:
        json.dump({
            "timestamp": datetime.now().isoformat(),
            "target_url": BASE_URL,
            "test_user": TEST_EMAIL,
            "overall_success": success,
            "results": tester.results
        }, f, indent=2)
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()