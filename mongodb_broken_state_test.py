#!/usr/bin/env python3
"""
COMPREHENSIVE SYSTEM TEST: Validate current broken state before final fix

Context: Troubleshoot agent confirmed 27 MongoDB references in server.py causing all 500 errors.
This test documents the current broken state before fixing.

Test User: andre@thestrategysquad.com.au or andre+test@thestrategysquad.com.au
Auth: MongoDB JWT token
"""

import requests
import json
from datetime import datetime
import sys

class MongoDBBrokenStateTest:
    def __init__(self, base_url="https://FORK_PREVIEW_URL_PLACEHOLDER/api"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.test_results = []
        self.tests_run = 0
        self.tests_passed = 0
        
    def log_result(self, category, endpoint, expected_result, actual_status, response_data, notes=""):
        """Log test result with detailed information"""
        self.tests_run += 1
        
        result = {
            "category": category,
            "endpoint": endpoint,
            "expected": expected_result,
            "actual_status": actual_status,
            "response": response_data,
            "notes": notes,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        
        # Determine if test passed based on expected result
        if expected_result == "SHOULD_WORK":
            passed = actual_status in [200, 201]
        elif expected_result == "SHOULD_FAIL_500":
            passed = actual_status == 500
        elif expected_result == "MAY_WORK_OR_FAIL":
            passed = True  # Any result is acceptable
        else:
            passed = False
        
        if passed:
            self.tests_passed += 1
        
        status_icon = "✅" if passed else "❌"
        print(f"\n{status_icon} [{category}] {endpoint}")
        print(f"   Expected: {expected_result}")
        print(f"   Actual Status: {actual_status}")
        if response_data:
            print(f"   Response: {json.dumps(response_data, indent=2)[:300]}")
        if notes:
            print(f"   Notes: {notes}")
        
        return passed
    
    def make_request(self, method, endpoint, data=None, use_auth=True):
        """Make HTTP request and return status code and response"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if use_auth and self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)
            
            # Try to parse JSON response
            try:
                response_data = response.json()
            except:
                response_data = {"raw_text": response.text[:500]}
            
            return response.status_code, response_data
        
        except Exception as e:
            return None, {"error": str(e)}
    
    def authenticate_mongodb_user(self, email, password):
        """Authenticate using MongoDB auth (legacy system)"""
        print(f"\n🔐 Authenticating MongoDB user: {email}")
        
        # Try to login with existing user
        login_data = {
            "email": email,
            "password": password
        }
        
        status, response = self.make_request('POST', 'auth/login', data=login_data, use_auth=False)
        
        if status == 200 and 'access_token' in response:
            self.token = response['access_token']
            self.user_id = response.get('user', {}).get('id')
            print(f"✅ Authentication successful - Token obtained")
            print(f"   User ID: {self.user_id}")
            return True
        else:
            print(f"❌ Authentication failed - Status: {status}")
            print(f"   Response: {response}")
            return False
    
    def test_1_auth_system(self):
        """Test 1: Auth System (Should Work) - Supabase signup/login/session"""
        print("\n" + "="*80)
        print("TEST 1: AUTH SYSTEM (SHOULD WORK)")
        print("="*80)
        
        # Test Supabase signup endpoint
        status, response = self.make_request('GET', 'auth/supabase/signup', use_auth=False)
        self.log_result(
            "Auth System",
            "GET /api/auth/supabase/signup",
            "SHOULD_WORK",
            status,
            response,
            "Supabase signup endpoint should be accessible"
        )
        
        # Test Supabase login endpoint
        status, response = self.make_request('GET', 'auth/supabase/login', use_auth=False)
        self.log_result(
            "Auth System",
            "GET /api/auth/supabase/login",
            "SHOULD_WORK",
            status,
            response,
            "Supabase login endpoint should be accessible"
        )
        
        # Test auth/me with MongoDB token (should work as hybrid auth is implemented)
        status, response = self.make_request('GET', 'auth/me', use_auth=True)
        self.log_result(
            "Auth System",
            "GET /api/auth/me",
            "SHOULD_WORK",
            status,
            response,
            "MongoDB JWT token should work with hybrid auth"
        )
    
    def test_2_outlook_integration(self):
        """Test 2: Outlook Integration (May Work or Fail)"""
        print("\n" + "="*80)
        print("TEST 2: OUTLOOK INTEGRATION (MAY WORK OR FAIL)")
        print("="*80)
        
        # Test Outlook status endpoint
        status, response = self.make_request('GET', 'outlook/status', use_auth=True)
        self.log_result(
            "Outlook Integration",
            "GET /api/outlook/status",
            "MAY_WORK_OR_FAIL",
            status,
            response,
            "May work or fail depending on code path and MongoDB references"
        )
    
    def test_3_soundboard(self):
        """Test 3: Soundboard (Should Fail - User Reported)"""
        print("\n" + "="*80)
        print("TEST 3: SOUNDBOARD (SHOULD FAIL - USER REPORTED)")
        print("="*80)
        
        # Test POST /api/soundboard/chat
        chat_data = {
            "message": "Test soundboard message",
            "context": "business strategy"
        }
        status, response = self.make_request('POST', 'soundboard/chat', data=chat_data, use_auth=True)
        self.log_result(
            "Soundboard",
            "POST /api/soundboard/chat",
            "SHOULD_FAIL_500",
            status,
            response,
            "Uses db.soundboard_conversations - should return 500 error"
        )
        
        # Test GET /api/soundboard/conversations
        status, response = self.make_request('GET', 'soundboard/conversations', use_auth=True)
        self.log_result(
            "Soundboard",
            "GET /api/soundboard/conversations",
            "SHOULD_FAIL_500",
            status,
            response,
            "Uses db.soundboard_conversations - should return 500 error"
        )
    
    def test_4_chat_biqc(self):
        """Test 4: Chat/BIQC (Should Fail)"""
        print("\n" + "="*80)
        print("TEST 4: CHAT/BIQC (SHOULD FAIL)")
        print("="*80)
        
        # Test POST /api/chat
        chat_data = {
            "message": "What should I focus on for my business?",
            "context_type": "general"
        }
        status, response = self.make_request('POST', 'chat', data=chat_data, use_auth=True)
        self.log_result(
            "Chat/BIQC",
            "POST /api/chat",
            "SHOULD_FAIL_500",
            status,
            response,
            "Uses db.chat_history, db.analyses - should return 500 error"
        )
        
        # Test GET /api/chat/history
        status, response = self.make_request('GET', 'chat/history', use_auth=True)
        self.log_result(
            "Chat/BIQC",
            "GET /api/chat/history",
            "SHOULD_FAIL_500",
            status,
            response,
            "Uses db.chat_history - should return 500 error"
        )
    
    def test_5_business_profile(self):
        """Test 5: Business Profile (Should Fail)"""
        print("\n" + "="*80)
        print("TEST 5: BUSINESS PROFILE (SHOULD FAIL)")
        print("="*80)
        
        # Test GET /api/business-profile
        status, response = self.make_request('GET', 'business-profile', use_auth=True)
        self.log_result(
            "Business Profile",
            "GET /api/business-profile",
            "SHOULD_FAIL_500",
            status,
            response,
            "Uses db.business_profiles_versioned - should return 500 error"
        )
        
        # Test PUT /api/business-profile
        profile_data = {
            "business_name": "Test Business",
            "industry": "Technology"
        }
        status, response = self.make_request('PUT', 'business-profile', data=profile_data, use_auth=True)
        self.log_result(
            "Business Profile",
            "PUT /api/business-profile",
            "SHOULD_FAIL_500",
            status,
            response,
            "Uses db.business_profiles_versioned - should return 500 error"
        )
    
    def test_6_data_files(self):
        """Test 6: Data Files (Should Fail)"""
        print("\n" + "="*80)
        print("TEST 6: DATA FILES (SHOULD FAIL)")
        print("="*80)
        
        # Test GET /api/data-center/files
        status, response = self.make_request('GET', 'data-center/files', use_auth=True)
        self.log_result(
            "Data Files",
            "GET /api/data-center/files",
            "SHOULD_FAIL_500",
            status,
            response,
            "Uses db.data_files - should return 500 error"
        )
        
        # Test GET /api/data-center/stats
        status, response = self.make_request('GET', 'data-center/stats', use_auth=True)
        self.log_result(
            "Data Files",
            "GET /api/data-center/stats",
            "SHOULD_FAIL_500",
            status,
            response,
            "Uses db.data_files - should return 500 error"
        )
    
    def test_additional_endpoints(self):
        """Test additional endpoints that may use MongoDB"""
        print("\n" + "="*80)
        print("ADDITIONAL ENDPOINTS (MongoDB References)")
        print("="*80)
        
        # Test GET /api/analyses
        status, response = self.make_request('GET', 'analyses', use_auth=True)
        self.log_result(
            "Additional",
            "GET /api/analyses",
            "SHOULD_FAIL_500",
            status,
            response,
            "May use MongoDB references"
        )
        
        # Test GET /api/documents
        status, response = self.make_request('GET', 'documents', use_auth=True)
        self.log_result(
            "Additional",
            "GET /api/documents",
            "SHOULD_FAIL_500",
            status,
            response,
            "May use MongoDB references"
        )
        
        # Test GET /api/dashboard/stats
        status, response = self.make_request('GET', 'dashboard/stats', use_auth=True)
        self.log_result(
            "Additional",
            "GET /api/dashboard/stats",
            "SHOULD_FAIL_500",
            status,
            response,
            "May use MongoDB references"
        )
    
    def generate_report(self):
        """Generate comprehensive test report"""
        print("\n" + "="*80)
        print("COMPREHENSIVE TEST REPORT")
        print("="*80)
        
        # Categorize results
        working_endpoints = []
        failing_endpoints = []
        unexpected_results = []
        
        for result in self.test_results:
            status = result['actual_status']
            expected = result['expected']
            endpoint = result['endpoint']
            
            if expected == "SHOULD_WORK" and status in [200, 201]:
                working_endpoints.append(result)
            elif expected == "SHOULD_FAIL_500" and status == 500:
                failing_endpoints.append(result)
            elif expected == "MAY_WORK_OR_FAIL":
                if status in [200, 201]:
                    working_endpoints.append(result)
                else:
                    failing_endpoints.append(result)
            else:
                unexpected_results.append(result)
        
        print(f"\n📊 SUMMARY:")
        print(f"   Total Tests: {self.tests_run}")
        print(f"   Tests Passed: {self.tests_passed}")
        print(f"   Tests Failed: {self.tests_run - self.tests_passed}")
        
        print(f"\n✅ WORKING ENDPOINTS ({len(working_endpoints)}):")
        for result in working_endpoints:
            print(f"   • {result['endpoint']} - Status {result['actual_status']}")
        
        print(f"\n❌ FAILING ENDPOINTS ({len(failing_endpoints)}):")
        for result in failing_endpoints:
            error_msg = ""
            if isinstance(result['response'], dict):
                error_msg = result['response'].get('detail', result['response'].get('error', ''))
            print(f"   • {result['endpoint']} - Status {result['actual_status']}")
            if error_msg:
                print(f"     Error: {error_msg[:100]}")
        
        if unexpected_results:
            print(f"\n⚠️  UNEXPECTED RESULTS ({len(unexpected_results)}):")
            for result in unexpected_results:
                print(f"   • {result['endpoint']} - Expected {result['expected']}, Got {result['actual_status']}")
        
        # Save detailed report
        report = {
            "test_date": datetime.now().isoformat(),
            "summary": {
                "total_tests": self.tests_run,
                "passed": self.tests_passed,
                "failed": self.tests_run - self.tests_passed,
                "working_endpoints": len(working_endpoints),
                "failing_endpoints": len(failing_endpoints),
                "unexpected_results": len(unexpected_results)
            },
            "working_endpoints": working_endpoints,
            "failing_endpoints": failing_endpoints,
            "unexpected_results": unexpected_results,
            "all_results": self.test_results
        }
        
        return report
    
    def run_all_tests(self, email, password):
        """Run all tests in sequence"""
        print("🚀 COMPREHENSIVE SYSTEM TEST: MongoDB Broken State Validation")
        print(f"Base URL: {self.base_url}")
        print(f"Test User: {email}")
        print("\n" + "="*80)
        
        # Authenticate
        if not self.authenticate_mongodb_user(email, password):
            print("\n❌ CRITICAL: Authentication failed. Cannot proceed with tests.")
            return None
        
        # Run all test suites
        self.test_1_auth_system()
        self.test_2_outlook_integration()
        self.test_3_soundboard()
        self.test_4_chat_biqc()
        self.test_5_business_profile()
        self.test_6_data_files()
        self.test_additional_endpoints()
        
        # Generate report
        report = self.generate_report()
        
        # Save report to file
        report_file = '/app/mongodb_broken_state_report.json'
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"\n📄 Detailed report saved to: {report_file}")
        
        return report

def main():
    """Main entry point"""
    # Test with the specified user
    email = "andre@thestrategysquad.com.au"
    password = "password123"  # Default password - may need to be updated
    
    # Allow command line override
    if len(sys.argv) > 1:
        email = sys.argv[1]
    if len(sys.argv) > 2:
        password = sys.argv[2]
    
    tester = MongoDBBrokenStateTest()
    report = tester.run_all_tests(email, password)
    
    if report is None:
        return 1
    
    # Return 0 if all expected results match, 1 otherwise
    return 0 if report['summary']['unexpected_results'] == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
