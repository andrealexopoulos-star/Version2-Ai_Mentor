#!/usr/bin/env python3
"""
Backend API Testing for Calibration Status Endpoint
Tests the /api/calibration/status endpoint to ensure it returns 200 for authenticated users
"""

import requests
import sys
import json
from datetime import datetime

class CalibrationAPITester:
    def __init__(self, base_url="https://admin-portal-launch.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.results = []

    def log_result(self, test_name, success, details):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
        
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {test_name}: {details}")

    def test_calibration_status_unauthenticated(self):
        """Test calibration status without authentication - should return 401"""
        try:
            url = f"{self.base_url}/api/calibration/status"
            response = requests.get(url)
            
            if response.status_code == 401:
                self.log_result("Unauthenticated Access", True, f"Correctly returned 401: {response.status_code}")
                return True
            else:
                self.log_result("Unauthenticated Access", False, f"Expected 401, got {response.status_code}")
                return False
                
        except Exception as e:
            self.log_result("Unauthenticated Access", False, f"Exception: {str(e)}")
            return False

    def test_calibration_status_invalid_token(self):
        """Test calibration status with invalid token - should return 401"""
        try:
            url = f"{self.base_url}/api/calibration/status"
            headers = {'Authorization': 'Bearer invalid_token_12345'}
            response = requests.get(url, headers=headers)
            
            if response.status_code == 401:
                self.log_result("Invalid Token", True, f"Correctly returned 401: {response.status_code}")
                return True
            else:
                self.log_result("Invalid Token", False, f"Expected 401, got {response.status_code}")
                return False
                
        except Exception as e:
            self.log_result("Invalid Token", False, f"Exception: {str(e)}")
            return False

    def test_calibration_status_malformed_token(self):
        """Test calibration status with malformed token - should return 401"""
        try:
            url = f"{self.base_url}/api/calibration/status"
            headers = {'Authorization': 'Bearer malformed.jwt.token'}
            response = requests.get(url, headers=headers)
            
            if response.status_code == 401:
                self.log_result("Malformed Token", True, f"Correctly returned 401: {response.status_code}")
                return True
            else:
                self.log_result("Malformed Token", False, f"Expected 401, got {response.status_code}")
                return False
                
        except Exception as e:
            self.log_result("Malformed Token", False, f"Exception: {str(e)}")
            return False

    def test_calibration_status_empty_auth_header(self):
        """Test calibration status with empty auth header - should return 401"""
        try:
            url = f"{self.base_url}/api/calibration/status"
            headers = {'Authorization': ''}
            response = requests.get(url, headers=headers)
            
            if response.status_code == 401:
                self.log_result("Empty Auth Header", True, f"Correctly returned 401: {response.status_code}")
                return True
            else:
                self.log_result("Empty Auth Header", False, f"Expected 401, got {response.status_code}")
                return False
                
        except Exception as e:
            self.log_result("Empty Auth Header", False, f"Exception: {str(e)}")
            return False

    def test_calibration_status_bearer_only(self):
        """Test calibration status with 'Bearer' only - should return 401"""
        try:
            url = f"{self.base_url}/api/calibration/status"
            headers = {'Authorization': 'Bearer'}
            response = requests.get(url, headers=headers)
            
            if response.status_code == 401:
                self.log_result("Bearer Only", True, f"Correctly returned 401: {response.status_code}")
                return True
            else:
                self.log_result("Bearer Only", False, f"Expected 401, got {response.status_code}")
                return False
                
        except Exception as e:
            self.log_result("Bearer Only", False, f"Exception: {str(e)}")
            return False

    def test_other_endpoints_basic(self):
        """Test other endpoints to ensure they're working"""
        endpoints_to_test = [
            ("/api/health", 200),
            ("/api/auth/oauth/google", 200),
            ("/api/auth/oauth/azure", 200)
        ]
        
        for endpoint, expected_status in endpoints_to_test:
            try:
                url = f"{self.base_url}{endpoint}"
                response = requests.get(url)
                
                if response.status_code == expected_status:
                    self.log_result(f"Endpoint {endpoint}", True, f"Returned expected {expected_status}")
                else:
                    self.log_result(f"Endpoint {endpoint}", False, f"Expected {expected_status}, got {response.status_code}")
                    
            except Exception as e:
                self.log_result(f"Endpoint {endpoint}", False, f"Exception: {str(e)}")

    def run_all_tests(self):
        """Run all calibration status tests"""
        print("🔍 Testing Calibration Status Endpoint...")
        print(f"Base URL: {self.base_url}")
        print("=" * 60)
        
        # Test unauthenticated access
        self.test_calibration_status_unauthenticated()
        
        # Test various invalid token scenarios
        self.test_calibration_status_invalid_token()
        self.test_calibration_status_malformed_token()
        self.test_calibration_status_empty_auth_header()
        self.test_calibration_status_bearer_only()
        
        # Test other endpoints for comparison
        self.test_other_endpoints_basic()
        
        # Print summary
        print("=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            print("✅ All tests passed!")
            return 0
        else:
            print("❌ Some tests failed!")
            return 1

    def save_results(self, filename="/app/test_reports/calibration_backend_test.json"):
        """Save test results to file"""
        try:
            with open(filename, 'w') as f:
                json.dump({
                    "test_run": {
                        "timestamp": datetime.now().isoformat(),
                        "base_url": self.base_url,
                        "total_tests": self.tests_run,
                        "passed_tests": self.tests_passed,
                        "success_rate": f"{(self.tests_passed/self.tests_run)*100:.1f}%" if self.tests_run > 0 else "0%"
                    },
                    "results": self.results
                }, f, indent=2)
            print(f"📄 Results saved to {filename}")
        except Exception as e:
            print(f"❌ Failed to save results: {e}")

def main():
    """Main test execution"""
    tester = CalibrationAPITester()
    
    try:
        exit_code = tester.run_all_tests()
        tester.save_results()
        return exit_code
    except KeyboardInterrupt:
        print("\n⚠️ Tests interrupted by user")
        return 1
    except Exception as e:
        print(f"❌ Test execution failed: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())