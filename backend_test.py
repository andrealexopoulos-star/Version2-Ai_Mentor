#!/usr/bin/env python3
"""
Backend Testing for Tier-Aware Brain KPI Policy and Threshold Configuration

Review Request Requirements:
1. Auth/login works
2. GET /api/brain/kpis returns 200 with plan_tier, plan_label, visible_metric_limit, and KPI threshold rows
3. PUT /api/brain/kpis can save a harmless threshold/note update and GET reflects it
4. GET /api/brain/metrics?include_coverage=true includes threshold_config / threshold_state metadata and respects visible metric limit
5. GET /api/brain/priorities includes brain_policy metadata
6. Flag any backend regressions

Target: https://advisor-engine.preview.emergentagent.com
Credentials: andre@thestrategysquad.com.au / MasterMind2025*
"""

import requests
import json
import time
from datetime import datetime

# Configuration
BASE_URL = "https://advisor-engine.preview.emergentagent.com"
CREDENTIALS = {
    "email": "andre@thestrategysquad.com.au",
    "password": "MasterMind2025*"
}

def log(message):
    """Log with timestamp"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] {message}")

def test_auth_login():
    """Test 1: Verify auth/login works"""
    log("Testing authentication...")
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/auth/supabase/login",
            json=CREDENTIALS,
            timeout=15
        )
        
        if response.status_code != 200:
            return False, f"Login failed: {response.status_code} - {response.text}"
        
        data = response.json()
        session = data.get("session", {})
        access_token = session.get("access_token")
        
        if not access_token:
            return False, "No access token returned in login response"
        
        user_id = data.get("user", {}).get("id")
        if not user_id:
            return False, "No user ID returned in login response"
        
        log(f"✅ Login successful - User ID: {user_id}")
        log(f"✅ Token length: {len(access_token)} chars")
        
        return True, {
            "token": access_token,
            "user_id": user_id,
            "session": session
        }
    
    except Exception as e:
        return False, f"Auth test failed: {str(e)}"

def test_brain_kpis_get(token):
    """Test 2: GET /api/brain/kpis returns required fields"""
    log("Testing GET /api/brain/kpis...")
    
    try:
        response = requests.get(
            f"{BASE_URL}/api/brain/kpis",
            headers={"Authorization": f"Bearer {token}"},
            timeout=30
        )
        
        if response.status_code != 200:
            return False, f"GET /api/brain/kpis failed: {response.status_code} - {response.text}"
        
        data = response.json()
        
        # Check required fields
        required_fields = ["plan_tier", "plan_label", "visible_metric_limit", "metrics"]
        missing_fields = [field for field in required_fields if field not in data]
        
        if missing_fields:
            return False, f"Missing required fields: {missing_fields}"
        
        # Validate metrics array and threshold configuration
        metrics = data.get("metrics", [])
        if not metrics:
            return False, "No metrics returned"
        
        # Check threshold structure on first metric
        first_metric = metrics[0]
        required_metric_fields = ["metric_id", "metric_name", "metric_key", "category", "threshold_config"]
        missing_metric_fields = [field for field in required_metric_fields if field not in first_metric]
        
        if missing_metric_fields:
            return False, f"Missing metric fields: {missing_metric_fields}"
        
        threshold_config = first_metric.get("threshold_config", {})
        required_threshold_fields = ["enabled", "comparator", "warning_value", "critical_value"]
        missing_threshold_fields = [field for field in required_threshold_fields if field not in threshold_config]
        
        if missing_threshold_fields:
            return False, f"Missing threshold config fields: {missing_threshold_fields}"
        
        # Log success details
        log(f"✅ Plan: {data.get('plan_label')} ({data.get('plan_tier')})")
        log(f"✅ Visible metric limit: {data.get('visible_metric_limit')}")
        log(f"✅ Metrics count: {len(metrics)}")
        log(f"✅ Sample metric: {first_metric.get('metric_name')} [{first_metric.get('metric_key')}]")
        
        return True, data
    
    except Exception as e:
        return False, f"GET /api/brain/kpis test failed: {str(e)}"

def test_brain_kpis_save_and_verify(token, original_data):
    """Test 3: PUT /api/brain/kpis can save threshold and GET reflects it"""
    log("Testing PUT /api/brain/kpis save and verify...")
    
    try:
        metrics = original_data.get("metrics", [])
        if not metrics:
            return False, "No metrics available for testing"
        
        # Find total_revenue metric or use first metric
        test_metric_key = "total_revenue"
        test_metric = None
        
        for metric in metrics:
            if metric.get("metric_key") == test_metric_key:
                test_metric = metric
                break
        
        if not test_metric:
            test_metric = metrics[0]
            test_metric_key = test_metric.get("metric_key")
        
        log(f"Testing threshold save for: {test_metric.get('metric_name')} [{test_metric_key}]")
        
        # Prepare harmless test threshold
        test_note = f"Test threshold update - {datetime.now().strftime('%H:%M:%S')}"
        test_payload = {
            "thresholds": [
                {
                    "metric_key": test_metric_key,
                    "enabled": True,
                    "comparator": "below",
                    "warning_value": 75000.0,
                    "critical_value": 50000.0,
                    "note": test_note
                }
            ]
        }
        
        # Save threshold
        put_response = requests.put(
            f"{BASE_URL}/api/brain/kpis",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            },
            json=test_payload,
            timeout=30
        )
        
        if put_response.status_code != 200:
            return False, f"PUT /api/brain/kpis failed: {put_response.status_code} - {put_response.text}"
        
        put_data = put_response.json()
        if "message" not in put_data:
            return False, "PUT response missing success message"
        
        log(f"✅ PUT successful: {put_data.get('message')}")
        
        # Wait for persistence
        time.sleep(1)
        
        # Verify by GET
        verify_response = requests.get(
            f"{BASE_URL}/api/brain/kpis",
            headers={"Authorization": f"Bearer {token}"},
            timeout=30
        )
        
        if verify_response.status_code != 200:
            return False, f"Verification GET failed: {verify_response.status_code}"
        
        verify_data = verify_response.json()
        verify_metrics = verify_data.get("metrics", [])
        
        # Find our saved metric
        saved_metric = None
        for metric in verify_metrics:
            if metric.get("metric_key") == test_metric_key:
                saved_metric = metric
                break
        
        if not saved_metric:
            return False, f"Could not find saved metric {test_metric_key} in verification"
        
        saved_threshold = saved_metric.get("threshold_config", {})
        
        # Verify saved values
        if saved_threshold.get("enabled") != True:
            return False, f"Expected enabled=True, got {saved_threshold.get('enabled')}"
        
        if saved_threshold.get("comparator") != "below":
            return False, f"Expected comparator=below, got {saved_threshold.get('comparator')}"
        
        if saved_threshold.get("warning_value") != 75000.0:
            return False, f"Expected warning_value=75000, got {saved_threshold.get('warning_value')}"
        
        if saved_threshold.get("critical_value") != 50000.0:
            return False, f"Expected critical_value=50000, got {saved_threshold.get('critical_value')}"
        
        if saved_threshold.get("note") != test_note:
            return False, f"Expected note='{test_note}', got '{saved_threshold.get('note')}'"
        
        log(f"✅ Threshold save verified: enabled={saved_threshold.get('enabled')}, warning={saved_threshold.get('warning_value')}, critical={saved_threshold.get('critical_value')}")
        log(f"✅ Note saved: {saved_threshold.get('note')}")
        
        return True, {
            "metric_key": test_metric_key,
            "saved_threshold": saved_threshold,
            "put_response": put_data,
            "verify_response": verify_data
        }
    
    except Exception as e:
        return False, f"PUT/GET verification test failed: {str(e)}"

def test_brain_metrics_coverage(token):
    """Test 4: GET /api/brain/metrics?include_coverage=true includes threshold metadata and respects visible limit"""
    log("Testing GET /api/brain/metrics?include_coverage=true...")
    
    try:
        response = requests.get(
            f"{BASE_URL}/api/brain/metrics",
            params={"include_coverage": "true"},
            headers={"Authorization": f"Bearer {token}"},
            timeout=45
        )
        
        if response.status_code != 200:
            return False, f"GET /api/brain/metrics?include_coverage=true failed: {response.status_code} - {response.text}"
        
        data = response.json()
        
        # Check required fields
        required_fields = ["visible_metric_limit", "total_metrics", "metrics"]
        missing_fields = [field for field in required_fields if field not in data]
        
        if missing_fields:
            return False, f"Missing required fields: {missing_fields}"
        
        visible_limit = data.get("visible_metric_limit")
        total_metrics = data.get("total_metrics")
        metrics = data.get("metrics", [])
        metrics_count = len(metrics)
        
        log(f"✅ Visible metric limit: {visible_limit}")
        log(f"✅ Total metrics: {total_metrics}")
        log(f"✅ Metrics array length: {metrics_count}")
        
        # For super_admin/custom user, expect 100 visible metrics
        if visible_limit != 100:
            return False, f"Expected visible_metric_limit=100 for this user, got {visible_limit}"
        
        # Metrics array should respect visible limit
        if metrics_count != visible_limit:
            return False, f"Expected {visible_limit} metrics in array, got {metrics_count}"
        
        # Check threshold_config and threshold_state are present
        if not metrics:
            return False, "No metrics in response"
        
        sample_metrics = metrics[:3]  # Check first 3 metrics
        for i, metric in enumerate(sample_metrics):
            metric_key = metric.get("metric_key", f"metric_{i}")
            
            if "threshold_config" not in metric:
                return False, f"Missing threshold_config in metric {metric_key}"
            
            if "threshold_state" not in metric:
                return False, f"Missing threshold_state in metric {metric_key}"
            
            threshold_config = metric.get("threshold_config", {})
            required_threshold_fields = ["enabled", "comparator", "warning_value", "critical_value"]
            missing_threshold_fields = [field for field in required_threshold_fields if field not in threshold_config]
            
            if missing_threshold_fields:
                return False, f"Missing threshold config fields in {metric_key}: {missing_threshold_fields}"
        
        log(f"✅ Threshold metadata verified in {len(sample_metrics)} sample metrics")
        log(f"✅ Visible metric limit respected: {metrics_count} metrics returned")
        
        return True, data
    
    except Exception as e:
        return False, f"GET /api/brain/metrics coverage test failed: {str(e)}"

def test_brain_priorities_policy(token):
    """Test 5: GET /api/brain/priorities includes brain_policy metadata"""
    log("Testing GET /api/brain/priorities brain_policy...")
    
    try:
        response = requests.get(
            f"{BASE_URL}/api/brain/priorities",
            params={"recompute": "false"},
            headers={"Authorization": f"Bearer {token}"},
            timeout=45
        )
        
        if response.status_code != 200:
            return False, f"GET /api/brain/priorities failed: {response.status_code} - {response.text}"
        
        data = response.json()
        
        # Check brain_policy is present
        if "brain_policy" not in data:
            return False, "Missing brain_policy in priorities response"
        
        brain_policy = data.get("brain_policy", {})
        
        # Check required brain_policy fields
        required_policy_fields = ["plan_tier", "plan_label", "visible_metric_limit"]
        missing_policy_fields = [field for field in required_policy_fields if field not in brain_policy]
        
        if missing_policy_fields:
            return False, f"Missing brain_policy fields: {missing_policy_fields}"
        
        # Log brain policy details
        log(f"✅ Brain policy plan: {brain_policy.get('plan_label')} ({brain_policy.get('plan_tier')})")
        log(f"✅ Brain policy visible metric limit: {brain_policy.get('visible_metric_limit')}")
        
        # For super_admin/custom user, expect 100 visible metrics
        if brain_policy.get("visible_metric_limit") != 100:
            return False, f"Expected brain_policy visible_metric_limit=100, got {brain_policy.get('visible_metric_limit')}"
        
        # Check concerns array is present
        concerns = data.get("concerns", [])
        log(f"✅ Brain priorities concerns: {len(concerns)} returned")
        
        # Check other expected fields
        expected_top_level_fields = ["tenant_id", "business_core_ready", "tier_mode", "generated_at"]
        for field in expected_top_level_fields:
            if field not in data:
                log(f"⚠️  Optional field missing: {field}")
        
        return True, data
    
    except Exception as e:
        return False, f"GET /api/brain/priorities test failed: {str(e)}"

def check_for_regressions(all_results):
    """Test 6: Flag any backend regressions"""
    log("Checking for backend regressions...")
    
    regressions = []
    
    # Check if all tests passed
    failed_tests = [name for name, (success, _) in all_results.items() if not success]
    if failed_tests:
        regressions.extend([f"Failed tests: {', '.join(failed_tests)}"])
    
    # Check for specific regression indicators
    auth_result = all_results.get("auth")
    if auth_result and auth_result[0]:
        auth_data = auth_result[1]
        if isinstance(auth_data, dict) and auth_data.get("token"):
            if len(auth_data.get("token")) < 100:
                regressions.append("Auth token unexpectedly short")
    
    kpi_get_result = all_results.get("brain_kpis_get")
    if kpi_get_result and kpi_get_result[0]:
        kpi_data = kpi_get_result[1]
        if isinstance(kpi_data, dict):
            visible_limit = kpi_data.get("visible_metric_limit", 0)
            if visible_limit < 100:
                regressions.append(f"Super admin visible metric limit lower than expected: {visible_limit}")
            
            metrics_count = len(kpi_data.get("metrics", []))
            if metrics_count == 0:
                regressions.append("No metrics returned in KPI configuration")
    
    metrics_result = all_results.get("brain_metrics_coverage")
    if metrics_result and metrics_result[0]:
        metrics_data = metrics_result[1]
        if isinstance(metrics_data, dict):
            catalog_source = metrics_data.get("catalog_source", "")
            if "fallback" in catalog_source.lower():
                regressions.append(f"Metrics using fallback catalog: {catalog_source}")
    
    if regressions:
        log(f"❌ Backend regressions detected: {len(regressions)}")
        for regression in regressions:
            log(f"❌ Regression: {regression}")
        return False, regressions
    else:
        log("✅ No backend regressions detected")
        return True, []

def main():
    """Main test execution"""
    print("="*80)
    print("Backend Testing: Tier-Aware Brain KPI Policy and Threshold Configuration")
    print("="*80)
    
    results = {}
    
    # Test 1: Authentication
    auth_success, auth_data = test_auth_login()
    results["auth"] = (auth_success, auth_data)
    
    if not auth_success:
        print(f"❌ Authentication failed: {auth_data}")
        return False
    
    token = auth_data["token"] if isinstance(auth_data, dict) else None
    if not token:
        print("❌ No token available for further testing")
        return False
    
    # Test 2: GET /api/brain/kpis
    kpi_get_success, kpi_get_data = test_brain_kpis_get(token)
    results["brain_kpis_get"] = (kpi_get_success, kpi_get_data)
    
    if not kpi_get_success:
        print(f"❌ GET /api/brain/kpis failed: {kpi_get_data}")
        return False
    
    # Test 3: PUT /api/brain/kpis save and verify
    save_success, save_data = test_brain_kpis_save_and_verify(token, kpi_get_data)
    results["brain_kpis_save"] = (save_success, save_data)
    
    if not save_success:
        print(f"❌ PUT /api/brain/kpis save/verify failed: {save_data}")
        return False
    
    # Test 4: GET /api/brain/metrics?include_coverage=true
    coverage_success, coverage_data = test_brain_metrics_coverage(token)
    results["brain_metrics_coverage"] = (coverage_success, coverage_data)
    
    if not coverage_success:
        print(f"❌ GET /api/brain/metrics coverage failed: {coverage_data}")
        return False
    
    # Test 5: GET /api/brain/priorities brain_policy
    priorities_success, priorities_data = test_brain_priorities_policy(token)
    results["brain_priorities_policy"] = (priorities_success, priorities_data)
    
    if not priorities_success:
        print(f"❌ GET /api/brain/priorities policy failed: {priorities_data}")
        return False
    
    # Test 6: Check for regressions
    regression_success, regression_data = check_for_regressions(results)
    results["regressions"] = (regression_success, regression_data)
    
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    for test_name, (success, data) in results.items():
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if not success:
            print(f"    Error: {data}")
    
    all_passed = all(success for success, _ in results.values())
    
    if all_passed:
        print("\n🎉 ALL TESTS PASSED - Backend tier-aware Brain KPI policy is working correctly!")
        print("✅ Authentication working")
        print("✅ GET /api/brain/kpis returns correct plan/policy fields")
        print("✅ PUT /api/brain/kpis saves and persists thresholds")
        print("✅ GET /api/brain/metrics includes threshold metadata and respects visible limit")
        print("✅ GET /api/brain/priorities includes brain_policy metadata")
        print("✅ No backend regressions detected")
    else:
        print("\n❌ SOME TESTS FAILED - Review failures above")
    
    return all_passed

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)