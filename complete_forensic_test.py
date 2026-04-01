#!/usr/bin/env python3
"""
Complete forensic production validation for BIQc platform.
Combines backend API tests and frontend content validation.
"""
import sys
from backend_test import ForensicTester
from frontend_test import test_frontend_with_auth

def main():
    """Run complete forensic validation"""
    print("🔍 COMPLETE BIQc FORENSIC PRODUCTION VALIDATION")
    print("=" * 60)
    
    # Run backend tests
    backend_tester = ForensicTester()
    backend_success = backend_tester.run_backend_tests()
    backend_tester.print_summary()
    
    # Run frontend tests if authentication succeeded
    if backend_tester.auth_token:
        print("\n" + "=" * 60)
        frontend_results = test_frontend_with_auth(
            "https://biqc.ai", 
            backend_tester.auth_token
        )
    else:
        print("\n❌ SKIPPING FRONTEND TESTS - Authentication failed")
        frontend_results = {}
    
    # Final comprehensive summary
    print("\n" + "=" * 60)
    print("📋 FINAL FORENSIC VALIDATION REPORT")
    print("=" * 60)
    
    backend_results = backend_tester.test_results
    
    # Count results
    backend_pass = sum(1 for r in backend_results.values() if r.get("status") == "PASS")
    backend_fail = sum(1 for r in backend_results.values() if r.get("status") == "FAIL") 
    backend_total = len(backend_results)
    
    frontend_pass = 0
    frontend_fail = 0
    frontend_total = 0
    
    if "advisor_page" in frontend_results:
        advisor = frontend_results["advisor_page"]
        if "tests" in advisor:
            frontend_total = len(advisor["tests"])
            frontend_pass = sum(1 for t in advisor["tests"].values() if t.get("status") == "PASS")
            frontend_fail = sum(1 for t in advisor["tests"].values() if t.get("status") == "FAIL")
    
    print(f"Backend API Tests: {backend_pass}/{backend_total} PASS, {backend_fail} FAIL")
    print(f"Frontend Tests: {frontend_pass}/{frontend_total} PASS, {frontend_fail} FAIL")
    
    # Specific test results per requirement
    print("\nPER REQUIREMENT VALIDATION:")
    print("A) Auth + Brain API checks:")
    
    auth_status = "✅ PASS" if backend_results.get("auth", {}).get("status") == "PASS" else "❌ FAIL"
    print(f"  1) POST /api/auth/supabase/login: {auth_status}")
    
    runtime_status = "✅ PASS" if backend_results.get("brain_runtime", {}).get("status") == "PASS" else "❌ FAIL"
    print(f"  2) GET /api/brain/runtime-check: {runtime_status}")
    
    metrics_result = backend_results.get("brain_metrics", {})
    if metrics_result.get("status") == "PASS":
        metrics_status = "✅ PASS"
    elif metrics_result.get("status") == "FAIL":
        metrics_status = "❌ FAIL (Values don't match expectations)"
    else:
        metrics_status = "❌ FAIL"
    print(f"  3) GET /api/brain/metrics: {metrics_status}")
    if metrics_result.get("issues"):
        for issue in metrics_result["issues"]:
            print(f"     - {issue}")
    
    priorities_status = "✅ PASS" if backend_results.get("brain_priorities", {}).get("status") == "PASS" else "❌ FAIL"
    print(f"  4) GET /api/brain/priorities: {priorities_status}")
    
    print("\nB) Integration truth checks:")
    
    accounting_status = "✅ PASS" if backend_results.get("accounting_integration", {}).get("status") == "PASS" else "❌ FAIL"
    print(f"  5) GET /api/integrations/accounting/summary: {accounting_status}")
    
    outlook_status = "✅ PASS" if backend_results.get("outlook_email", {}).get("status") == "PASS" else "❌ FAIL"
    print(f"  6) GET /api/outlook/status + /api/email/priority-inbox: {outlook_status}")
    
    print("\nC) Advisor frontend checks:")
    if frontend_results and "advisor_page" in frontend_results:
        advisor = frontend_results["advisor_page"]
        if "tests" in advisor:
            tests = advisor["tests"]
            
            for i, (test_key, test_name) in enumerate([
                ("page_loads", "Login and open /advisor"),
                ("responsive_layout", "Layout responsiveness"),  
                ("brain_source_health", "Business Brain source health"),
                ("no_placeholders", "No placeholder strings"),
                ("brain_unavailable_handling", "Brain unavailable handling")
            ], 7):
                test_data = tests.get(test_key, {})
                status = test_data.get("status", "NOT_RUN")
                icon = "✅ PASS" if status == "PASS" else "⚠️ PARTIAL" if status == "PARTIAL" else "❌ FAIL"
                print(f"  {i}) {test_name}: {icon}")
    else:
        print("  7-11) Frontend tests: ❌ NOT_RUN (Auth required)")
    
    # Determine overall success
    critical_failures = []
    
    # Check for critical backend failures
    if backend_results.get("auth", {}).get("status") != "PASS":
        critical_failures.append("Authentication failed")
    if backend_results.get("brain_runtime", {}).get("status") != "PASS":
        critical_failures.append("Brain runtime-check failed")
    if backend_results.get("brain_priorities", {}).get("status") != "PASS":
        critical_failures.append("Brain priorities failed")
        
    # Check frontend
    if frontend_results and "advisor_page" in frontend_results:
        if frontend_results["advisor_page"].get("status") == "FAIL":
            critical_failures.append("Advisor page validation failed")
    
    print(f"\nOVERALL STATUS:")
    if critical_failures:
        print(f"❌ VALIDATION FAILED - Critical issues: {', '.join(critical_failures)}")
        return False
    else:
        print("✅ VALIDATION PASSED - All critical checks successful")
        if backend_results.get("brain_metrics", {}).get("status") == "FAIL":
            print("⚠️ NOTE: Brain metrics values differ from expectations (20 vs 100 metrics)")
        return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)