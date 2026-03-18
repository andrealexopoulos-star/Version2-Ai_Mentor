#!/usr/bin/env python3

"""
BIQc Forensic Truth-Engine Backend Testing
Testing the specific review requirements on preview environment:

1. GET /api/brain/priorities returns 200, integrity_alerts > 0, truth_summary.connector_truth states present, no false zero-value phrases in issue_brief fields
2. GET /api/integrations/merge/connected exposes canonical truth states crm_state/accounting_state/email_state  
3. GET /api/outlook/status responds quickly and no longer takes ~15s; confirm reasonable time with token metadata
4. Spot-check GET /api/email/priority-inbox and GET /api/intelligence/watchtower still work
"""

import asyncio
import json
import logging
import sys
import time
from pathlib import Path

import httpx

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Test configuration - using preview environment
BACKEND_URL = "https://truth-engine-19.preview.emergentagent.com"
TEST_CREDENTIALS = {
    "email": "andre@thestrategysquad.com.au",
    "password": "MasterMind2025*"
}

class ForensicTruthEngineTester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.client = httpx.AsyncClient(timeout=30.0)  # Reduced timeout to 30s
        self.test_results = {}
        self.auth_token = None
        
    async def close(self):
        await self.client.aclose()
    
    async def authenticate(self):
        """Authenticate with Supabase login to get access token"""
        logger.info("Authenticating with Supabase...")
        
        try:
            response = await self.client.post(
                f"{self.base_url}/api/auth/supabase/login",
                json=TEST_CREDENTIALS
            )
            
            if response.status_code == 200:
                auth_data = response.json()
                self.auth_token = auth_data.get("session", {}).get("access_token")
                user_id = auth_data.get("session", {}).get("user", {}).get("id")
                
                if self.auth_token:
                    self.client.headers.update({
                        "Authorization": f"Bearer {self.auth_token}"
                    })
                    logger.info(f"✅ Authentication successful - User ID: {user_id}")
                    logger.info(f"Token length: {len(self.auth_token)} chars")
                    return True
                else:
                    logger.error("❌ No access token in response")
                    return False
            else:
                logger.error(f"❌ Authentication failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Authentication error: {e}")
            return False

    async def test_brain_priorities_endpoint(self):
        """Test 1: GET /api/brain/priorities comprehensive validation"""
        logger.info("Testing Brain Priorities endpoint...")
        
        try:
            start_time = time.time()
            response = await self.client.get(f"{self.base_url}/api/brain/priorities")
            response_time = time.time() - start_time
            
            logger.info(f"Brain priorities response time: {response_time:.2f}s")
            
            # Check status code
            if response.status_code != 200:
                self.test_results["brain_priorities"] = {
                    "status": "FAIL",
                    "error": f"Expected 200, got {response.status_code}",
                    "response_body": response.text[:500]
                }
                return False
            
            data = response.json()
            
            # Requirement validations
            validation_results = {}
            
            # 1. Check for integrity_alerts > 0 (it's a list, so check length)
            integrity_alerts = data.get("integrity_alerts", [])
            integrity_alerts_count = len(integrity_alerts) if isinstance(integrity_alerts, list) else integrity_alerts
            validation_results["integrity_alerts_check"] = {
                "value": integrity_alerts_count,
                "alerts_list": integrity_alerts[:2] if isinstance(integrity_alerts, list) else None,  # Show first 2 for debugging
                "valid": integrity_alerts_count > 0,
                "requirement": "integrity_alerts > 0"
            }
            
            # 2. Check for truth_summary.connector_truth states present
            truth_summary = data.get("truth_summary", {})
            connector_truth = truth_summary.get("connector_truth", {})
            
            validation_results["truth_summary_check"] = {
                "truth_summary_present": bool(truth_summary),
                "connector_truth_present": bool(connector_truth),
                "connector_truth_keys": list(connector_truth.keys()) if connector_truth else [],
                "valid": bool(truth_summary) and bool(connector_truth),
                "requirement": "truth_summary.connector_truth states present"
            }
            
            # 3. Check for false zero-value phrases in issue_brief fields
            false_zero_phrases = [
                "no verified signal",
                "all clear",
                "no high-priority",
                "zero detected",
                "false zero",
                "generic fallback"
            ]
            
            issue_brief_problems = []
            if "concerns" in data:
                for concern in data["concerns"]:
                    issue_brief = concern.get("issue_brief", "")
                    if issue_brief:
                        for phrase in false_zero_phrases:
                            if phrase.lower() in issue_brief.lower():
                                issue_brief_problems.append({
                                    "concern": concern.get("concern_id", "unknown"),
                                    "phrase_found": phrase,
                                    "issue_brief_excerpt": issue_brief[:100]
                                })
            
            validation_results["issue_brief_check"] = {
                "false_zero_phrases_found": len(issue_brief_problems),
                "problems": issue_brief_problems,
                "valid": len(issue_brief_problems) == 0,
                "requirement": "no false zero-value phrases in issue_brief fields"
            }
            
            # Overall assessment
            all_valid = all(v["valid"] for v in validation_results.values())
            
            self.test_results["brain_priorities"] = {
                "status": "PASS" if all_valid else "PARTIAL",
                "response_time": response_time,
                "response_code": response.status_code,
                "validation_results": validation_results,
                "data_summary": {
                    "concerns_count": len(data.get("concerns", [])),
                    "integrity_alerts": integrity_alerts_count,
                    "has_truth_summary": bool(truth_summary),
                    "connector_truth_keys": list(connector_truth.keys()) if connector_truth else []
                },
                "sample_data": {
                    "first_concern": data.get("concerns", [{}])[0] if data.get("concerns") else None,
                    "truth_summary_sample": {k: v for k, v in truth_summary.items() if k != "connector_truth"} if truth_summary else None
                }
            }
            
            logger.info(f"Brain priorities validation - All checks passed: {all_valid}")
            return all_valid
            
        except Exception as e:
            self.test_results["brain_priorities"] = {
                "status": "FAIL",
                "error": str(e)
            }
            logger.error(f"❌ Brain priorities test failed: {e}")
            return False

    async def test_integrations_merge_connected(self):
        """Test 2: GET /api/integrations/merge/connected canonical truth states"""
        logger.info("Testing Integrations Merge Connected endpoint...")
        
        try:
            start_time = time.time()
            response = await self.client.get(f"{self.base_url}/api/integrations/merge/connected")
            response_time = time.time() - start_time
            
            logger.info(f"Merge connected response time: {response_time:.2f}s")
            
            if response.status_code != 200:
                self.test_results["integrations_merge_connected"] = {
                    "status": "FAIL",
                    "error": f"Expected 200, got {response.status_code}",
                    "response_body": response.text[:500]
                }
                return False
            
            data = response.json()
            
            # Check for canonical truth states - they might be in different structure
            states_found = {}
            
            # First check if the expected states are directly present
            required_states = ["crm_state", "accounting_state", "email_state"]
            direct_states_present = all(state in data for state in required_states)
            
            if direct_states_present:
                for state in required_states:
                    states_found[state] = {
                        "present": True,
                        "value": data.get(state),
                        "location": "direct"
                    }
            else:
                # Check if they're in canonical_truth
                canonical_truth = data.get("canonical_truth", {})
                for state in required_states:
                    states_found[state] = {
                        "present": state in canonical_truth,
                        "value": canonical_truth.get(state),
                        "location": "canonical_truth"
                    }
            
            # Check if we found canonical truth states in any form
            states_present = all(states_found[state]["present"] for state in required_states)
            
            # Additional check using the structure we see in the response
            if not states_present and "canonical_truth" in data:
                canonical_truth_keys = list(data["canonical_truth"].keys())
                states_present = all(state in canonical_truth_keys for state in required_states)
            
            self.test_results["integrations_merge_connected"] = {
                "status": "PASS" if states_present else "FAIL",
                "response_time": response_time,
                "response_code": response.status_code,
                "states_found": states_found,
                "canonical_truth_states_present": states_present,
                "required_states": required_states,
                "response_structure": {
                    "top_level_keys": list(data.keys()),
                    "canonical_truth_keys": list(data.get("canonical_truth", {}).keys()) if "canonical_truth" in data else None
                }
            }
            
            logger.info(f"Merge connected states check - Canonical truth states present: {states_present}")
            return states_present
            
        except Exception as e:
            self.test_results["integrations_merge_connected"] = {
                "status": "FAIL",
                "error": str(e)
            }
            logger.error(f"❌ Integrations merge connected test failed: {e}")
            return False

    async def test_outlook_status_performance(self):
        """Test 3: GET /api/outlook/status performance and token metadata"""
        logger.info("Testing Outlook Status endpoint performance...")
        
        try:
            start_time = time.time()
            response = await self.client.get(f"{self.base_url}/api/outlook/status")
            response_time = time.time() - start_time
            
            logger.info(f"Outlook status response time: {response_time:.2f}s")
            
            if response.status_code != 200:
                self.test_results["outlook_status"] = {
                    "status": "FAIL",
                    "error": f"Expected 200, got {response.status_code}",
                    "response_body": response.text[:500],
                    "response_time": response_time
                }
                return False
            
            data = response.json()
            
            # Check response time (should be reasonable, not ~15s)
            reasonable_time = response_time < 10.0  # Less than 10 seconds is reasonable
            
            # Check for token metadata
            has_token_metadata = bool(data.get("token"))
            token_fields = []
            if data.get("token"):
                token_fields = list(data["token"].keys())
            
            self.test_results["outlook_status"] = {
                "status": "PASS" if reasonable_time else "PERFORMANCE_ISSUE",
                "response_time": response_time,
                "response_code": response.status_code,
                "reasonable_time": reasonable_time,
                "time_threshold": 10.0,
                "has_token_metadata": has_token_metadata,
                "token_fields": token_fields,
                "data_summary": {
                    "connected": data.get("connected"),
                    "email_count": data.get("email_count"),
                    "sync_status": data.get("sync_status"),
                    "last_sync": data.get("last_sync")
                }
            }
            
            logger.info(f"Outlook status - Reasonable time: {reasonable_time}, Has token metadata: {has_token_metadata}")
            return reasonable_time
            
        except Exception as e:
            self.test_results["outlook_status"] = {
                "status": "FAIL",
                "error": str(e)
            }
            logger.error(f"❌ Outlook status test failed: {e}")
            return False

    async def test_spot_check_endpoints(self):
        """Test 4: Spot-check GET /api/email/priority-inbox and GET /api/intelligence/watchtower"""
        logger.info("Running spot-check on email/priority-inbox and intelligence/watchtower...")
        
        spot_check_results = {}
        
        # Test email/priority-inbox
        try:
            start_time = time.time()
            response = await self.client.get(f"{self.base_url}/api/email/priority-inbox")
            response_time = time.time() - start_time
            
            spot_check_results["email_priority_inbox"] = {
                "status": "PASS" if response.status_code == 200 else "FAIL",
                "response_code": response.status_code,
                "response_time": response_time,
                "working": response.status_code == 200
            }
            
            if response.status_code == 200:
                data = response.json()
                spot_check_results["email_priority_inbox"]["data_summary"] = {
                    "has_data": bool(data),
                    "keys": list(data.keys()) if isinstance(data, dict) else None,
                    "type": type(data).__name__
                }
            else:
                spot_check_results["email_priority_inbox"]["error"] = response.text[:300]
                
        except Exception as e:
            spot_check_results["email_priority_inbox"] = {
                "status": "FAIL",
                "error": str(e),
                "working": False
            }
        
        # Test intelligence/watchtower
        try:
            start_time = time.time()
            response = await self.client.get(f"{self.base_url}/api/intelligence/watchtower")
            response_time = time.time() - start_time
            
            spot_check_results["intelligence_watchtower"] = {
                "status": "PASS" if response.status_code == 200 else "FAIL",
                "response_code": response.status_code,
                "response_time": response_time,
                "working": response.status_code == 200
            }
            
            if response.status_code == 200:
                data = response.json()
                spot_check_results["intelligence_watchtower"]["data_summary"] = {
                    "has_data": bool(data),
                    "keys": list(data.keys()) if isinstance(data, dict) else None,
                    "type": type(data).__name__
                }
            else:
                spot_check_results["intelligence_watchtower"]["error"] = response.text[:300]
                
        except Exception as e:
            spot_check_results["intelligence_watchtower"] = {
                "status": "FAIL",
                "error": str(e),
                "working": False
            }
        
        # Both endpoints should be working
        both_working = (spot_check_results["email_priority_inbox"]["working"] and 
                       spot_check_results["intelligence_watchtower"]["working"])
        
        self.test_results["spot_check"] = {
            "status": "PASS" if both_working else "FAIL",
            "both_endpoints_working": both_working,
            "results": spot_check_results
        }
        
        logger.info(f"Spot-check - Both endpoints working: {both_working}")
        return both_working

    async def run_all_tests(self):
        """Run all forensic truth-engine tests"""
        logger.info("🚀 Starting BIQc Forensic Truth-Engine Testing...")
        logger.info(f"Target URL: {self.base_url}")
        logger.info(f"Test credentials: {TEST_CREDENTIALS['email']}")
        
        # First authenticate
        if not await self.authenticate():
            logger.error("❌ Authentication failed - cannot proceed with tests")
            return False
        
        tests = [
            ("Brain Priorities Endpoint", self.test_brain_priorities_endpoint),
            ("Integrations Merge Connected", self.test_integrations_merge_connected),
            ("Outlook Status Performance", self.test_outlook_status_performance),
            ("Spot-check Endpoints", self.test_spot_check_endpoints),
        ]
        
        all_passed = True
        
        for test_name, test_func in tests:
            logger.info(f"\n--- Running: {test_name} ---")
            try:
                result = await test_func()
                if not result:
                    all_passed = False
                logger.info(f"{'✅' if result else '❌'} {test_name}: {'PASS' if result else 'FAIL'}")
            except Exception as e:
                logger.error(f"❌ {test_name}: FAIL - {e}")
                all_passed = False
        
        return all_passed

    def print_summary(self):
        """Print comprehensive test summary"""
        logger.info("\n" + "="*60)
        logger.info("🏁 BIQc Forensic Truth-Engine Test Summary")
        logger.info("="*60)
        
        # Test-by-test summary
        for test_name, result in self.test_results.items():
            status_icon = "✅" if result["status"] == "PASS" else ("⚠️" if result["status"] == "PARTIAL" else "❌")
            logger.info(f"\n{status_icon} {test_name.upper()}: {result['status']}")
            
            if "details" in result:
                logger.info(f"    Response time: {result.get('response_time', 'N/A'):.2f}s" if result.get('response_time') else "")
                
                # Specific details for each test
                if test_name == "integrations_merge_connected" and result["status"] != "FAIL":
                    logger.info(f"    Required states present: {result['canonical_truth_states_present']}")
                    for state, info in result.get("states_found", {}).items():
                        state_icon = "✅" if info["present"] else "❌"
                        logger.info(f"      {state_icon} {state}: {info['value']} (found in {info['location']})")
                elif test_name == "integrations_merge_connected" and "response_structure" in result:
                    logger.info(f"    Required states present: {result['canonical_truth_states_present']}")
                    canonical_truth_keys = result.get("response_structure", {}).get("canonical_truth_keys", [])
                    required_states = result.get("required_states", [])
                    logger.info(f"    Canonical truth keys found: {canonical_truth_keys}")
                    for state in required_states:
                        present = state in canonical_truth_keys
                        state_icon = "✅" if present else "❌"
                        logger.info(f"      {state_icon} {state}: {'present' if present else 'missing'}")
            
            if "error" in result:
                logger.info(f"    Error: {result['error']}")
            
            # Specific details for each test  
            if test_name == "brain_priorities" and result["status"] != "FAIL":
                logger.info(f"    Response time: {result['response_time']:.2f}s")
                logger.info(f"    Concerns count: {result.get('data_summary', {}).get('concerns_count', 'N/A')}")
                logger.info(f"    Integrity alerts: {result.get('data_summary', {}).get('integrity_alerts', 'N/A')}")
                
                for check_name, check_result in result.get("validation_results", {}).items():
                    check_icon = "✅" if check_result["valid"] else "❌"
                    logger.info(f"      {check_icon} {check_name}: {check_result['requirement']}")
                    
            elif test_name == "integrations_merge_connected" and result["status"] != "FAIL":
                logger.info(f"    Response time: {result['response_time']:.2f}s")
                logger.info(f"    Required states present: {result['all_required_states_present']}")
                for state, info in result.get("states_found", {}).items():
                    state_icon = "✅" if info["present"] else "❌"
                    logger.info(f"      {state_icon} {state}: {info['value']}")
                    
            elif test_name == "outlook_status" and result["status"] != "FAIL":
                logger.info(f"    Response time: {result['response_time']:.2f}s (threshold: {result['time_threshold']}s)")
                logger.info(f"    Reasonable time: {result['reasonable_time']}")
                logger.info(f"    Has token metadata: {result['has_token_metadata']}")
                
            elif test_name == "spot_check" and result["status"] != "FAIL":
                for endpoint, endpoint_result in result.get("results", {}).items():
                    endpoint_icon = "✅" if endpoint_result["working"] else "❌"
                    logger.info(f"    {endpoint_icon} {endpoint}: {endpoint_result['response_code']} ({endpoint_result['response_time']:.2f}s)")
        
        # Overall results
        total_tests = len(self.test_results)
        passed_tests = sum(1 for r in self.test_results.values() if r["status"] == "PASS")
        partial_tests = sum(1 for r in self.test_results.values() if r["status"] == "PARTIAL")
        
        logger.info(f"\n📊 OVERALL RESULTS:")
        logger.info(f"    Total tests: {total_tests}")
        logger.info(f"    Passed: {passed_tests}")
        logger.info(f"    Partial: {partial_tests}")
        logger.info(f"    Failed: {total_tests - passed_tests - partial_tests}")
        
        # Export results to JSON
        timestamp = int(time.time())
        results_file = f'/app/forensic_truth_engine_test_results_{timestamp}.json'
        with open(results_file, 'w') as f:
            json.dump(self.test_results, f, indent=2)
        logger.info(f"\n📄 Test results saved to {results_file}")


async def main():
    """Main test runner"""
    tester = ForensicTruthEngineTester()
    
    try:
        all_passed = await tester.run_all_tests()
        tester.print_summary()
        
        if all_passed:
            logger.info("🎉 ALL FORENSIC TRUTH-ENGINE TESTS PASSED!")
            return 0
        else:
            logger.warning("⚠️ SOME FORENSIC TRUTH-ENGINE TESTS FAILED OR PARTIAL!")
            return 1
            
    except Exception as e:
        logger.error(f"Test execution failed: {e}")
        return 1
    finally:
        await tester.close()


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)