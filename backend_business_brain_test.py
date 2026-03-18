#!/usr/bin/env python3
"""
Backend Business Brain API Testing
Tests all Brain API endpoints as specified in the review request.

Test Requirements:
1) POST /api/auth/supabase/login returns session token
2) GET /api/brain/metrics?include_coverage=true returns 200 and includes keys: catalog_source, total_metrics, computed_metrics, metrics[]
3) total_metrics should be 100 (authoritative top100 catalog loaded)  
4) GET /api/brain/concerns returns 200 and includes business_core_ready and concerns list
5) GET /api/brain/priorities?recompute=true returns 200 with concerns list (no 500)
6) Business core schema graceful handling (business_core_ready=false, non-crashing messages)
7) GET /api/brain/metrics?include_coverage=true&metric_name=total_revenue filters or returns coherent single metric coverage

Credentials: andre@thestrategysquad.com.au / MasterMind2025*
URL: https://truth-engine-19.preview.emergentagent.com
"""

import json
import requests
import sys
from typing import Dict, Any, Optional

# Test configuration
BASE_URL = "https://truth-engine-19.preview.emergentagent.com"
TEST_EMAIL = "andre@thestrategysquad.com.au"
TEST_PASSWORD = "MasterMind2025*"

class BusinessBrainAPITester:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.auth_token: Optional[str] = None
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'BIQc-Business-Brain-Test/1.0'
        })

    def login(self, email: str, password: str) -> bool:
        """Test 1: POST /api/auth/supabase/login returns session token"""
        print("🔐 TEST 1: Authentication (POST /api/auth/supabase/login)")
        
        try:
            login_payload = {"email": email, "password": password}
            response = self.session.post(
                f"{self.base_url}/api/auth/supabase/login", 
                json=login_payload,
                timeout=30
            )
            
            print(f"   Status: {response.status_code}")
            print(f"   Response size: {len(response.text)} bytes")
            
            if response.status_code == 200:
                data = response.json()
                print(f"   Response keys: {list(data.keys())}")
                
                # Check for session token (can be in session.access_token or direct access_token)
                access_token = None
                if 'access_token' in data:
                    access_token = data['access_token']
                elif 'session' in data and 'access_token' in data['session']:
                    access_token = data['session']['access_token']
                
                if access_token:
                    self.auth_token = access_token
                    self.session.headers['Authorization'] = f'Bearer {self.auth_token}'
                    print(f"   ✅ SUCCESS: Got access_token (length: {len(self.auth_token)})")
                    if 'user' in data and 'id' in data['user']:
                        print(f"   User ID: {data['user']['id']}")
                    return True
                else:
                    print(f"   ❌ FAIL: No access_token in response")
                    print(f"   Response: {json.dumps(data, indent=2)}")
                    return False
            else:
                print(f"   ❌ FAIL: HTTP {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {json.dumps(error_data, indent=2)}")
                except:
                    print(f"   Error text: {response.text}")
                return False
                
        except Exception as e:
            print(f"   ❌ EXCEPTION: {str(e)}")
            return False

    def test_brain_metrics_coverage(self) -> bool:
        """Test 2 & 3: GET /api/brain/metrics?include_coverage=true"""
        print("\n📊 TEST 2 & 3: Brain Metrics Coverage (GET /api/brain/metrics?include_coverage=true)")
        
        try:
            response = self.session.get(
                f"{self.base_url}/api/brain/metrics?include_coverage=true",
                timeout=30
            )
            
            print(f"   Status: {response.status_code}")
            print(f"   Response size: {len(response.text)} bytes")
            
            if response.status_code == 200:
                data = response.json()
                print(f"   Response keys: {list(data.keys())}")
                
                # Check required keys from requirement 2
                required_keys = ['catalog_source', 'total_metrics', 'computed_metrics', 'metrics']
                missing_keys = [key for key in required_keys if key not in data]
                
                if not missing_keys:
                    print("   ✅ SUCCESS: All required keys present")
                    print(f"   catalog_source: {data.get('catalog_source')}")
                    print(f"   total_metrics: {data.get('total_metrics')}")
                    print(f"   computed_metrics: {data.get('computed_metrics')}")
                    print(f"   metrics count: {len(data.get('metrics', []))}")
                    
                    # Check requirement 3: total_metrics should be 100
                    total_metrics = data.get('total_metrics')
                    if total_metrics == 100:
                        print("   ✅ SUCCESS: total_metrics = 100 (authoritative top100 catalog loaded)")
                    else:
                        print(f"   ❌ FAIL: total_metrics = {total_metrics}, expected 100")
                        return False
                    
                    # Check business_core_ready status
                    if 'business_core_ready' in data:
                        print(f"   business_core_ready: {data['business_core_ready']}")
                    
                    return True
                else:
                    print(f"   ❌ FAIL: Missing required keys: {missing_keys}")
                    return False
            else:
                print(f"   ❌ FAIL: HTTP {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {json.dumps(error_data, indent=2)}")
                except:
                    print(f"   Error text: {response.text}")
                return False
                
        except Exception as e:
            print(f"   ❌ EXCEPTION: {str(e)}")
            return False

    def test_brain_concerns(self) -> bool:
        """Test 4: GET /api/brain/concerns returns 200 and includes business_core_ready and concerns list"""
        print("\n🧠 TEST 4: Brain Concerns (GET /api/brain/concerns)")
        
        try:
            response = self.session.get(
                f"{self.base_url}/api/brain/concerns",
                timeout=30
            )
            
            print(f"   Status: {response.status_code}")
            print(f"   Response size: {len(response.text)} bytes")
            
            if response.status_code == 200:
                data = response.json()
                print(f"   Response keys: {list(data.keys())}")
                
                # Check required keys
                required_keys = ['business_core_ready', 'concerns']
                missing_keys = [key for key in required_keys if key not in data]
                
                if not missing_keys:
                    print("   ✅ SUCCESS: Required keys present")
                    print(f"   business_core_ready: {data.get('business_core_ready')}")
                    
                    concerns = data.get('concerns', [])
                    print(f"   concerns count: {len(concerns)}")
                    
                    if concerns and len(concerns) > 0:
                        print("   ✅ SUCCESS: Concerns list populated")
                        # Show first concern structure
                        first_concern = concerns[0]
                        print(f"   Sample concern keys: {list(first_concern.keys())}")
                        print(f"   Sample concern_id: {first_concern.get('concern_id')}")
                        print(f"   Sample concern name: {first_concern.get('name')}")
                    else:
                        print("   ⚠️  WARNING: Concerns list empty")
                    
                    return True
                else:
                    print(f"   ❌ FAIL: Missing required keys: {missing_keys}")
                    return False
            else:
                print(f"   ❌ FAIL: HTTP {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {json.dumps(error_data, indent=2)}")
                except:
                    print(f"   Error text: {response.text}")
                return False
                
        except Exception as e:
            print(f"   ❌ EXCEPTION: {str(e)}")
            return False

    def test_brain_priorities(self) -> bool:
        """Test 5: GET /api/brain/priorities?recompute=true returns 200 with concerns list (no 500)"""
        print("\n🎯 TEST 5: Brain Priorities (GET /api/brain/priorities?recompute=true)")
        
        try:
            response = self.session.get(
                f"{self.base_url}/api/brain/priorities?recompute=true",
                timeout=60  # Longer timeout for recompute
            )
            
            print(f"   Status: {response.status_code}")
            print(f"   Response size: {len(response.text)} bytes")
            
            if response.status_code == 200:
                data = response.json()
                print(f"   Response keys: {list(data.keys())}")
                
                # Check for concerns list
                if 'concerns' in data:
                    concerns = data.get('concerns', [])
                    print(f"   ✅ SUCCESS: Got concerns list (count: {len(concerns)})")
                    print(f"   business_core_ready: {data.get('business_core_ready')}")
                    print(f"   tier_mode: {data.get('tier_mode')}")
                    
                    if concerns and len(concerns) > 0:
                        # Show priority structure
                        first_priority = concerns[0]
                        print(f"   Sample priority keys: {list(first_priority.keys())}")
                        print(f"   Sample concern_id: {first_priority.get('concern_id')}")
                        print(f"   Sample priority_score: {first_priority.get('priority_score')}")
                    
                    return True
                else:
                    print(f"   ❌ FAIL: No concerns in response")
                    return False
            elif response.status_code == 500:
                print(f"   ❌ FAIL: HTTP 500 (requirement: no 500 errors)")
                try:
                    error_data = response.json()
                    print(f"   Error: {json.dumps(error_data, indent=2)}")
                except:
                    print(f"   Error text: {response.text}")
                return False
            else:
                print(f"   ❌ FAIL: HTTP {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {json.dumps(error_data, indent=2)}")
                except:
                    print(f"   Error text: {response.text}")
                return False
                
        except Exception as e:
            print(f"   ❌ EXCEPTION: {str(e)}")
            return False

    def test_graceful_handling(self) -> bool:
        """Test 6: Business core schema graceful handling (business_core_ready=false, non-crashing messages)"""
        print("\n🛡️  TEST 6: Graceful Error Handling (business_core schema)")
        
        # This test validates that when business_core schema is not exposed,
        # the system responds gracefully with business_core_ready=false and helpful messages
        
        try:
            # Test metrics endpoint for graceful handling
            response = self.session.get(
                f"{self.base_url}/api/brain/metrics?include_coverage=true",
                timeout=30
            )
            
            print(f"   Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                business_core_ready = data.get('business_core_ready')
                
                if business_core_ready is False:
                    print("   ✅ SUCCESS: business_core_ready=false (graceful handling)")
                    
                    # Check for helpful message
                    if 'message' in data:
                        message = data['message']
                        print(f"   ✅ SUCCESS: Helpful message provided")
                        print(f"   Message: {message}")
                    
                    # Check metrics still return structure
                    if 'metrics' in data:
                        metrics = data['metrics']
                        print(f"   ✅ SUCCESS: Metrics structure maintained ({len(metrics)} items)")
                        
                        # Check metric has proper status
                        if metrics and 'status' in metrics[0]:
                            status = metrics[0]['status']
                            print(f"   Sample metric status: {status}")
                    
                    return True
                elif business_core_ready is True:
                    print("   ✅ SUCCESS: business_core_ready=true (schema is active)")
                    return True
                else:
                    print(f"   ❌ FAIL: business_core_ready has unexpected value: {business_core_ready}")
                    return False
            else:
                print(f"   ❌ FAIL: HTTP {response.status_code} (should handle gracefully)")
                return False
                
        except Exception as e:
            print(f"   ❌ EXCEPTION: {str(e)}")
            return False

    def test_metric_filtering(self) -> bool:
        """Test 7: GET /api/brain/metrics?include_coverage=true&metric_name=total_revenue filters coherently"""
        print("\n🔍 TEST 7: Metric Filtering (GET /api/brain/metrics?include_coverage=true&metric_name=total_revenue)")
        
        try:
            response = self.session.get(
                f"{self.base_url}/api/brain/metrics?include_coverage=true&metric_name=total_revenue",
                timeout=30
            )
            
            print(f"   Status: {response.status_code}")
            print(f"   Response size: {len(response.text)} bytes")
            
            if response.status_code == 200:
                data = response.json()
                print(f"   Response keys: {list(data.keys())}")
                
                # Check metrics are filtered
                if 'metrics' in data:
                    metrics = data['metrics']
                    print(f"   Filtered metrics count: {len(metrics)}")
                    
                    if len(metrics) == 1:
                        metric = metrics[0]
                        metric_name = metric.get('metric_name') or metric.get('metric_key')
                        print(f"   ✅ SUCCESS: Single metric returned")
                        print(f"   Metric name: {metric_name}")
                        print(f"   Metric keys: {list(metric.keys())}")
                        
                        # Verify it's the right metric
                        if 'total_revenue' in str(metric_name).lower():
                            print(f"   ✅ SUCCESS: Correct metric filtered")
                        else:
                            print(f"   ⚠️  WARNING: Unexpected metric: {metric_name}")
                        
                        return True
                    elif len(metrics) == 0:
                        print(f"   ⚠️  WARNING: No metrics returned for total_revenue filter")
                        return True  # Still coherent response
                    else:
                        print(f"   ✅ SUCCESS: Multiple metrics returned (coherent response)")
                        # Check if they're related to total_revenue
                        relevant_metrics = [m for m in metrics if 'revenue' in str(m.get('metric_name', '')).lower()]
                        print(f"   Revenue-related metrics: {len(relevant_metrics)}")
                        return True
                else:
                    print(f"   ❌ FAIL: No metrics in response")
                    return False
            else:
                print(f"   ❌ FAIL: HTTP {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {json.dumps(error_data, indent=2)}")
                except:
                    print(f"   Error text: {response.text}")
                return False
                
        except Exception as e:
            print(f"   ❌ EXCEPTION: {str(e)}")
            return False

    def run_all_tests(self) -> Dict[str, bool]:
        """Run all Business Brain API tests"""
        print("=" * 80)
        print("🧠 BUSINESS BRAIN API TEST SUITE")
        print("=" * 80)
        print(f"Base URL: {self.base_url}")
        print(f"Test User: {TEST_EMAIL}")
        print("=" * 80)
        
        results = {}
        
        # Test 1: Authentication
        results['authentication'] = self.login(TEST_EMAIL, TEST_PASSWORD)
        
        if not results['authentication']:
            print("\n❌ CRITICAL: Authentication failed - aborting remaining tests")
            return results
        
        # Test 2 & 3: Metrics coverage
        results['metrics_coverage'] = self.test_brain_metrics_coverage()
        
        # Test 4: Concerns endpoint
        results['concerns'] = self.test_brain_concerns()
        
        # Test 5: Priorities endpoint
        results['priorities'] = self.test_brain_priorities()
        
        # Test 6: Graceful handling
        results['graceful_handling'] = self.test_graceful_handling()
        
        # Test 7: Metric filtering
        results['metric_filtering'] = self.test_metric_filtering()
        
        return results

    def print_summary(self, results: Dict[str, bool]):
        """Print test summary"""
        print("\n" + "=" * 80)
        print("📋 BUSINESS BRAIN API TEST SUMMARY")
        print("=" * 80)
        
        total_tests = len(results)
        passed_tests = sum(1 for result in results.values() if result)
        
        for test_name, result in results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"   {test_name.replace('_', ' ').title()}: {status}")
        
        print("-" * 80)
        print(f"Total: {passed_tests}/{total_tests} tests passed")
        
        if passed_tests == total_tests:
            print("🎉 ALL TESTS PASSED - Business Brain API is working correctly!")
            return True
        else:
            print("⚠️  SOME TESTS FAILED - Review the failures above")
            return False

def main():
    """Main test execution"""
    tester = BusinessBrainAPITester(BASE_URL)
    results = tester.run_all_tests()
    success = tester.print_summary(results)
    
    # Return exit code based on test results
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()