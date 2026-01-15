#!/usr/bin/env python3
"""
Onboarding Wizard Backend API Testing Script
Tests the onboarding flow and profile scores endpoints
"""

import requests
import json
from datetime import datetime

# Configuration
BASE_URL = "https://mongo-to-supa-1.preview.emergentagent.com/api"
TEST_USER_EMAIL = "onboard@test.com"
TEST_USER_PASSWORD = "Test123!"
TEST_USER_NAME = "Onboard Tester"

class OnboardingTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.token = None
        self.user_id = None
        self.tests_passed = 0
        self.tests_failed = 0
        self.test_results = []
    
    def log_result(self, test_name, passed, details=""):
        """Log test result"""
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} - {test_name}")
        if details:
            print(f"   {details}")
        
        if passed:
            self.tests_passed += 1
        else:
            self.tests_failed += 1
        
        self.test_results.append({
            "test": test_name,
            "passed": passed,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })
    
    def make_request(self, method, endpoint, data=None, expected_status=200):
        """Make HTTP request to API"""
        url = f"{self.base_url}/{endpoint}"
        headers = {"Content-Type": "application/json"}
        
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        
        try:
            if method == "GET":
                response = requests.get(url, headers=headers, timeout=30)
            elif method == "POST":
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == "PUT":
                response = requests.put(url, json=data, headers=headers, timeout=30)
            
            success = response.status_code == expected_status
            
            if not success:
                print(f"   ⚠️  Expected status {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Response: {json.dumps(error_data, indent=2)}")
                except:
                    print(f"   Response: {response.text[:200]}")
            
            return success, response.json() if response.content else {}
        
        except Exception as e:
            print(f"   ❌ Exception: {str(e)}")
            return False, {}
    
    def test_1_register_user(self):
        """Test 1: Register a new user"""
        print("\n" + "="*60)
        print("TEST 1: Register New User")
        print("="*60)
        
        user_data = {
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD,
            "name": TEST_USER_NAME
        }
        
        success, response = self.make_request("POST", "auth/register", user_data, 200)
        
        if success and "access_token" in response:
            self.token = response["access_token"]
            self.user_id = response["user"]["id"]
            self.log_result("Register User", True, f"User ID: {self.user_id}")
            return True
        else:
            # User might already exist, try login
            print("   ℹ️  Registration failed, attempting login...")
            return self.test_login_existing_user()
    
    def test_login_existing_user(self):
        """Login with existing user"""
        login_data = {
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        }
        
        success, response = self.make_request("POST", "auth/login", login_data, 200)
        
        if success and "access_token" in response:
            self.token = response["access_token"]
            self.user_id = response["user"]["id"]
            self.log_result("Login Existing User", True, f"User ID: {self.user_id}")
            return True
        else:
            self.log_result("Register/Login User", False, "Could not authenticate")
            return False
    
    def test_2_check_initial_onboarding_status(self):
        """Test 2: Check onboarding status for new user"""
        print("\n" + "="*60)
        print("TEST 2: Check Initial Onboarding Status")
        print("="*60)
        
        success, response = self.make_request("GET", "onboarding/status", expected_status=200)
        
        if not success:
            self.log_result("Get Onboarding Status", False, "API call failed")
            return False
        
        # Check if completed is false
        completed = response.get("completed")
        current_step = response.get("current_step")
        
        print(f"   Response: {json.dumps(response, indent=2)}")
        
        if completed == False:
            self.log_result("Onboarding Status - Completed False", True, f"completed: {completed}")
        else:
            self.log_result("Onboarding Status - Completed False", False, f"Expected False, got {completed}")
        
        if current_step == 0:
            self.log_result("Onboarding Status - Current Step 0", True, f"current_step: {current_step}")
        else:
            self.log_result("Onboarding Status - Current Step 0", False, f"Expected 0, got {current_step}")
        
        return success
    
    def test_3_save_onboarding_progress(self):
        """Test 3: Save onboarding progress"""
        print("\n" + "="*60)
        print("TEST 3: Save Onboarding Progress")
        print("="*60)
        
        onboarding_data = {
            "current_step": 1,
            "business_stage": "startup",
            "data": {
                "business_name": "Test Co",
                "industry": "Technology",
                "employee_count": "1-5"
            },
            "completed": False
        }
        
        success, response = self.make_request("POST", "onboarding/save", onboarding_data, 200)
        
        if success:
            print(f"   Response: {json.dumps(response, indent=2)}")
            
            # Check if status is saved
            if response.get("status") == "saved":
                self.log_result("Save Onboarding Progress", True, "Progress saved successfully")
            else:
                self.log_result("Save Onboarding Progress", False, f"Unexpected response: {response}")
            
            # Verify current_step in response
            if response.get("current_step") == 1:
                self.log_result("Save Progress - Current Step", True, "current_step: 1")
            else:
                self.log_result("Save Progress - Current Step", False, f"Expected 1, got {response.get('current_step')}")
        else:
            self.log_result("Save Onboarding Progress", False, "API call failed")
        
        return success
    
    def test_4_check_profile_scores_after_save(self):
        """Test 4: Check profile scores after saving data"""
        print("\n" + "="*60)
        print("TEST 4: Check Profile Scores After Save")
        print("="*60)
        
        success, response = self.make_request("GET", "business-profile/scores", expected_status=200)
        
        if not success:
            self.log_result("Get Profile Scores", False, "API call failed")
            return False
        
        print(f"   Response: {json.dumps(response, indent=2)}")
        
        # Check if completeness and strength are present
        completeness = response.get("completeness")
        strength = response.get("strength")
        
        if completeness is not None:
            self.log_result("Profile Scores - Completeness Present", True, f"completeness: {completeness}")
        else:
            self.log_result("Profile Scores - Completeness Present", False, "completeness field missing")
        
        if strength is not None:
            self.log_result("Profile Scores - Strength Present", True, f"strength: {strength}")
        else:
            self.log_result("Profile Scores - Strength Present", False, "strength field missing")
        
        # Note: Scores might still be 0 if profile hasn't been updated yet
        # This is expected behavior - onboarding data is separate from business profile
        
        return success
    
    def test_5_complete_onboarding(self):
        """Test 5: Complete onboarding"""
        print("\n" + "="*60)
        print("TEST 5: Complete Onboarding")
        print("="*60)
        
        success, response = self.make_request("POST", "onboarding/complete", expected_status=200)
        
        if success:
            print(f"   Response: {json.dumps(response, indent=2)}")
            
            if response.get("status") == "completed":
                self.log_result("Complete Onboarding", True, "Onboarding marked as completed")
            else:
                self.log_result("Complete Onboarding", False, f"Unexpected response: {response}")
        else:
            self.log_result("Complete Onboarding", False, "API call failed")
        
        return success
    
    def test_6_verify_onboarding_completed(self):
        """Test 6: Verify onboarding status shows completed=true"""
        print("\n" + "="*60)
        print("TEST 6: Verify Onboarding Completed")
        print("="*60)
        
        success, response = self.make_request("GET", "onboarding/status", expected_status=200)
        
        if not success:
            self.log_result("Verify Onboarding Status", False, "API call failed")
            return False
        
        print(f"   Response: {json.dumps(response, indent=2)}")
        
        completed = response.get("completed")
        
        if completed == True:
            self.log_result("Onboarding Status - Completed True", True, "Onboarding successfully completed")
        else:
            self.log_result("Onboarding Status - Completed True", False, f"Expected True, got {completed}")
        
        return success
    
    def test_7_profile_scores_with_empty_profile(self):
        """Test 7: Test profile scores with empty profile (should return 0s)"""
        print("\n" + "="*60)
        print("TEST 7: Profile Scores with Empty Profile")
        print("="*60)
        
        # This test verifies the endpoint works even with no business profile data
        success, response = self.make_request("GET", "business-profile/scores", expected_status=200)
        
        if success:
            print(f"   Response: {json.dumps(response, indent=2)}")
            
            completeness = response.get("completeness", -1)
            strength = response.get("strength", -1)
            
            # Scores should be 0 or low if no profile data exists
            if completeness >= 0:
                self.log_result("Empty Profile - Completeness Score", True, f"completeness: {completeness}")
            else:
                self.log_result("Empty Profile - Completeness Score", False, "completeness field missing")
            
            if strength >= 0:
                self.log_result("Empty Profile - Strength Score", True, f"strength: {strength}")
            else:
                self.log_result("Empty Profile - Strength Score", False, "strength field missing")
        else:
            self.log_result("Profile Scores with Empty Profile", False, "API call failed")
        
        return success
    
    def test_8_save_business_profile_data(self):
        """Test 8: Save some business profile data and verify scores increase"""
        print("\n" + "="*60)
        print("TEST 8: Save Business Profile Data")
        print("="*60)
        
        profile_data = {
            "business_name": "Test Co",
            "industry": "M",  # ANZSIC division
            "business_type": "Company (Pty Ltd)",
            "target_country": "Australia",
            "website": "https://testco.com.au",
            "employee_count": "1-5",
            "annual_revenue": "$100k-$500k"
        }
        
        success, response = self.make_request("PUT", "business-profile", profile_data, 200)
        
        if success:
            print(f"   Profile updated successfully")
            self.log_result("Update Business Profile", True, "Profile data saved")
            
            # Now check scores again
            print("\n   Checking scores after profile update...")
            success2, scores = self.make_request("GET", "business-profile/scores", expected_status=200)
            
            if success2:
                print(f"   Scores: {json.dumps(scores, indent=2)}")
                
                completeness = scores.get("completeness", 0)
                strength = scores.get("strength", 0)
                
                if completeness > 0:
                    self.log_result("Profile Scores Increased - Completeness", True, f"completeness: {completeness}")
                else:
                    self.log_result("Profile Scores Increased - Completeness", False, f"Expected > 0, got {completeness}")
                
                if strength > 0:
                    self.log_result("Profile Scores Increased - Strength", True, f"strength: {strength}")
                else:
                    self.log_result("Profile Scores Increased - Strength", False, f"Expected > 0, got {strength}")
            else:
                self.log_result("Get Scores After Profile Update", False, "API call failed")
        else:
            self.log_result("Update Business Profile", False, "API call failed")
        
        return success
    
    def run_all_tests(self):
        """Run all onboarding tests"""
        print("\n" + "="*70)
        print("🚀 ONBOARDING WIZARD BACKEND API TESTING")
        print("="*70)
        print(f"Base URL: {self.base_url}")
        print(f"Test User: {TEST_USER_EMAIL}")
        print("="*70)
        
        # Run tests in sequence
        if not self.test_1_register_user():
            print("\n❌ Authentication failed. Cannot continue tests.")
            return self.generate_report()
        
        self.test_2_check_initial_onboarding_status()
        self.test_3_save_onboarding_progress()
        self.test_4_check_profile_scores_after_save()
        self.test_5_complete_onboarding()
        self.test_6_verify_onboarding_completed()
        self.test_7_profile_scores_with_empty_profile()
        self.test_8_save_business_profile_data()
        
        return self.generate_report()
    
    def generate_report(self):
        """Generate final test report"""
        print("\n" + "="*70)
        print("📊 TEST SUMMARY")
        print("="*70)
        
        total_tests = self.tests_passed + self.tests_failed
        success_rate = (self.tests_passed / total_tests * 100) if total_tests > 0 else 0
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {self.tests_passed} ✅")
        print(f"Failed: {self.tests_failed} ❌")
        print(f"Success Rate: {success_rate:.1f}%")
        print("="*70)
        
        if self.tests_failed == 0:
            print("\n🎉 All tests passed!")
        else:
            print(f"\n⚠️  {self.tests_failed} test(s) failed. Review details above.")
        
        return {
            "total_tests": total_tests,
            "passed": self.tests_passed,
            "failed": self.tests_failed,
            "success_rate": f"{success_rate:.1f}%",
            "test_results": self.test_results,
            "timestamp": datetime.now().isoformat()
        }

if __name__ == "__main__":
    tester = OnboardingTester()
    report = tester.run_all_tests()
    
    # Save report
    with open("/app/onboarding_test_report.json", "w") as f:
        json.dump(report, f, indent=2)
    
    print(f"\n📄 Report saved to: /app/onboarding_test_report.json")
