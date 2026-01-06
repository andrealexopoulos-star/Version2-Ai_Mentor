#!/usr/bin/env python3
"""
Complete Auth System Test - Email/Password Only (Google OAuth Removed)
Tests registration, login, business profile save & persistence, and score calculation
"""

import requests
import json
import sys
from datetime import datetime
from pymongo import MongoClient
import os

class AuthSystemTester:
    def __init__(self, base_url="https://smart-advisor-33.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
        # MongoDB connection for direct database verification
        mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
        db_name = os.environ.get('DB_NAME', 'test_database')
        self.mongo_client = MongoClient(mongo_url)
        self.db = self.mongo_client[db_name]

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
        
        result = {
            "test_name": name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {name}")
        if details:
            print(f"   Details: {details}")

    def test_registration_flow(self):
        """Test 1: Registration Flow with Email/Password"""
        print("\n" + "="*80)
        print("TEST 1: REGISTRATION FLOW (Email/Password Only)")
        print("="*80)
        
        # Registration data as specified in review request
        registration_data = {
            "email": "reliableauth@test.com",
            "password": "SecurePass123!",
            "name": "Reliable Auth Test"
        }
        
        url = f"{self.base_url}/auth/register"
        
        try:
            response = requests.post(url, json=registration_data, timeout=30)
            
            print(f"\n📤 POST {url}")
            print(f"📥 Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"📥 Response: {json.dumps(data, indent=2)[:500]}")
                
                # Verify access_token is present
                if 'access_token' in data:
                    self.log_test("Registration - access_token present", True, f"Token length: {len(data['access_token'])}")
                    self.token = data['access_token']
                else:
                    self.log_test("Registration - access_token present", False, "Missing access_token in response")
                    return False
                
                # Verify user object is present
                if 'user' in data:
                    user = data['user']
                    self.log_test("Registration - user object present", True, "")
                    
                    # Verify user fields
                    if 'id' in user:
                        self.user_id = user['id']
                        self.log_test("Registration - user.id present", True, f"User ID: {self.user_id}")
                    else:
                        self.log_test("Registration - user.id present", False, "Missing user.id")
                    
                    if user.get('email') == registration_data['email']:
                        self.log_test("Registration - email matches", True, f"Email: {user['email']}")
                    else:
                        self.log_test("Registration - email matches", False, f"Expected {registration_data['email']}, got {user.get('email')}")
                    
                    if user.get('name') == registration_data['name']:
                        self.log_test("Registration - name matches", True, f"Name: {user['name']}")
                    else:
                        self.log_test("Registration - name matches", False, f"Expected {registration_data['name']}, got {user.get('name')}")
                    
                else:
                    self.log_test("Registration - user object present", False, "Missing user object in response")
                    return False
                
                return True
                
            elif response.status_code == 400:
                # User might already exist, try to continue with login
                error_data = response.json()
                if "already registered" in error_data.get('detail', '').lower():
                    print(f"⚠️  User already exists, will test login flow instead")
                    self.log_test("Registration - User Already Exists", True, "Expected behavior for existing user")
                    return "USER_EXISTS"
                else:
                    self.log_test("Registration - Unexpected 400 error", False, f"Error: {error_data}")
                    return False
            else:
                self.log_test("Registration - HTTP Status", False, f"Expected 200, got {response.status_code}: {response.text[:200]}")
                return False
                
        except Exception as e:
            self.log_test("Registration - Exception", False, f"Exception: {str(e)}")
            return False

    def test_login_flow(self):
        """Test 2: Login Flow with Email/Password"""
        print("\n" + "="*80)
        print("TEST 2: LOGIN FLOW")
        print("="*80)
        
        login_data = {
            "email": "reliableauth@test.com",
            "password": "SecurePass123!"
        }
        
        url = f"{self.base_url}/auth/login"
        
        try:
            response = requests.post(url, json=login_data, timeout=30)
            
            print(f"\n📤 POST {url}")
            print(f"📥 Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"📥 Response: {json.dumps(data, indent=2)[:500]}")
                
                # Verify access_token is present
                if 'access_token' in data:
                    self.log_test("Login - access_token present", True, f"Token length: {len(data['access_token'])}")
                    self.token = data['access_token']
                else:
                    self.log_test("Login - access_token present", False, "Missing access_token in response")
                    return False
                
                # Verify user object
                if 'user' in data and 'id' in data['user']:
                    self.user_id = data['user']['id']
                    self.log_test("Login - user object with id", True, f"User ID: {self.user_id}")
                else:
                    self.log_test("Login - user object with id", False, "Missing user object or id")
                    return False
                
                return True
            else:
                error_data = response.json() if response.content else {}
                self.log_test("Login - HTTP Status", False, f"Expected 200, got {response.status_code}: {error_data}")
                return False
                
        except Exception as e:
            self.log_test("Login - Exception", False, f"Exception: {str(e)}")
            return False

    def test_auth_me(self):
        """Test 3: Verify /api/auth/me with token"""
        print("\n" + "="*80)
        print("TEST 3: AUTH ME ENDPOINT")
        print("="*80)
        
        if not self.token:
            self.log_test("Auth Me - Token Required", False, "No token available")
            return False
        
        url = f"{self.base_url}/auth/me"
        headers = {'Authorization': f'Bearer {self.token}'}
        
        try:
            response = requests.get(url, headers=headers, timeout=30)
            
            print(f"\n📤 GET {url}")
            print(f"📥 Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"📥 Response: {json.dumps(data, indent=2)}")
                
                # Verify user data
                if data.get('id') == self.user_id:
                    self.log_test("Auth Me - User ID matches", True, f"User ID: {self.user_id}")
                else:
                    self.log_test("Auth Me - User ID matches", False, f"Expected {self.user_id}, got {data.get('id')}")
                
                if data.get('email') == "reliableauth@test.com":
                    self.log_test("Auth Me - Email matches", True, "")
                else:
                    self.log_test("Auth Me - Email matches", False, f"Expected reliableauth@test.com, got {data.get('email')}")
                
                return True
            else:
                self.log_test("Auth Me - HTTP Status", False, f"Expected 200, got {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Auth Me - Exception", False, f"Exception: {str(e)}")
            return False

    def test_business_profile_save(self):
        """Test 4: Business Profile Save"""
        print("\n" + "="*80)
        print("TEST 4: BUSINESS PROFILE SAVE")
        print("="*80)
        
        if not self.token:
            self.log_test("Business Profile Save - Token Required", False, "No token available")
            return False
        
        # Business profile data as specified in review request
        profile_data = {
            "business_name": "Test Business",
            "industry": "Technology",
            "mission_statement": "To test data persistence",
            "short_term_goals": "Verify saves work"
        }
        
        url = f"{self.base_url}/business-profile"
        headers = {
            'Authorization': f'Bearer {self.token}',
            'Content-Type': 'application/json'
        }
        
        try:
            response = requests.put(url, json=profile_data, headers=headers, timeout=30)
            
            print(f"\n📤 PUT {url}")
            print(f"📤 Data: {json.dumps(profile_data, indent=2)}")
            print(f"📥 Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"📥 Response: {json.dumps(data, indent=2)[:1000]}")
                
                self.log_test("Business Profile - Save returns 200", True, "")
                
                # Verify saved data matches
                if data.get('business_name') == profile_data['business_name']:
                    self.log_test("Business Profile - business_name saved", True, f"Value: {data.get('business_name')}")
                else:
                    self.log_test("Business Profile - business_name saved", False, f"Expected {profile_data['business_name']}, got {data.get('business_name')}")
                
                if data.get('industry') == profile_data['industry']:
                    self.log_test("Business Profile - industry saved", True, f"Value: {data.get('industry')}")
                else:
                    self.log_test("Business Profile - industry saved", False, f"Expected {profile_data['industry']}, got {data.get('industry')}")
                
                if data.get('mission_statement') == profile_data['mission_statement']:
                    self.log_test("Business Profile - mission_statement saved", True, f"Value: {data.get('mission_statement')}")
                else:
                    self.log_test("Business Profile - mission_statement saved", False, f"Expected {profile_data['mission_statement']}, got {data.get('mission_statement')}")
                
                if data.get('short_term_goals') == profile_data['short_term_goals']:
                    self.log_test("Business Profile - short_term_goals saved", True, f"Value: {data.get('short_term_goals')}")
                else:
                    self.log_test("Business Profile - short_term_goals saved", False, f"Expected {profile_data['short_term_goals']}, got {data.get('short_term_goals')}")
                
                return True
            else:
                error_data = response.json() if response.content else {}
                self.log_test("Business Profile - Save returns 200", False, f"Expected 200, got {response.status_code}: {error_data}")
                return False
                
        except Exception as e:
            self.log_test("Business Profile - Save Exception", False, f"Exception: {str(e)}")
            return False

    def test_business_profile_persistence(self):
        """Test 5: Business Profile Persistence - Multiple GET requests"""
        print("\n" + "="*80)
        print("TEST 5: BUSINESS PROFILE PERSISTENCE")
        print("="*80)
        
        if not self.token:
            self.log_test("Business Profile Persistence - Token Required", False, "No token available")
            return False
        
        url = f"{self.base_url}/business-profile"
        headers = {'Authorization': f'Bearer {self.token}'}
        
        expected_data = {
            "business_name": "Test Business",
            "industry": "Technology",
            "mission_statement": "To test data persistence",
            "short_term_goals": "Verify saves work"
        }
        
        # Make 3 consecutive GET requests to verify persistence
        for i in range(1, 4):
            print(f"\n🔄 GET Request #{i}")
            try:
                response = requests.get(url, headers=headers, timeout=30)
                
                print(f"📤 GET {url}")
                print(f"📥 Status Code: {response.status_code}")
                
                if response.status_code == 200:
                    data = response.json()
                    print(f"📥 Response (excerpt): {json.dumps({k: data.get(k) for k in expected_data.keys()}, indent=2)}")
                    
                    # Verify all fields persist
                    all_match = True
                    for key, expected_value in expected_data.items():
                        if data.get(key) != expected_value:
                            all_match = False
                            self.log_test(f"Persistence GET #{i} - {key} persists", False, f"Expected '{expected_value}', got '{data.get(key)}'")
                        else:
                            self.log_test(f"Persistence GET #{i} - {key} persists", True, f"Value: {data.get(key)}")
                    
                    if all_match:
                        self.log_test(f"Persistence GET #{i} - All data persists", True, "All fields match expected values")
                else:
                    self.log_test(f"Persistence GET #{i} - HTTP Status", False, f"Expected 200, got {response.status_code}")
                    return False
                    
            except Exception as e:
                self.log_test(f"Persistence GET #{i} - Exception", False, f"Exception: {str(e)}")
                return False
        
        return True

    def test_mongodb_direct_verification(self):
        """Test 6: MongoDB Direct Verification"""
        print("\n" + "="*80)
        print("TEST 6: MONGODB DIRECT VERIFICATION")
        print("="*80)
        
        if not self.user_id:
            self.log_test("MongoDB Verification - User ID Required", False, "No user_id available")
            return False
        
        try:
            # Query MongoDB directly
            profile = self.db.business_profiles.find_one({"user_id": self.user_id}, {"_id": 0})
            
            if profile:
                print(f"\n📊 MongoDB Document Found:")
                print(json.dumps(profile, indent=2, default=str)[:1000])
                
                self.log_test("MongoDB - Profile document exists", True, f"Found profile for user_id: {self.user_id}")
                
                # Verify data in MongoDB
                expected_data = {
                    "business_name": "Test Business",
                    "industry": "Technology",
                    "mission_statement": "To test data persistence",
                    "short_term_goals": "Verify saves work"
                }
                
                for key, expected_value in expected_data.items():
                    if profile.get(key) == expected_value:
                        self.log_test(f"MongoDB - {key} matches", True, f"Value: {profile.get(key)}")
                    else:
                        self.log_test(f"MongoDB - {key} matches", False, f"Expected '{expected_value}', got '{profile.get(key)}'")
                
                return True
            else:
                self.log_test("MongoDB - Profile document exists", False, f"No profile found for user_id: {self.user_id}")
                return False
                
        except Exception as e:
            self.log_test("MongoDB - Verification Exception", False, f"Exception: {str(e)}")
            return False

    def test_business_profile_scores(self):
        """Test 7: Business Profile Scores Calculation"""
        print("\n" + "="*80)
        print("TEST 7: BUSINESS PROFILE SCORES CALCULATION")
        print("="*80)
        
        if not self.token:
            self.log_test("Profile Scores - Token Required", False, "No token available")
            return False
        
        url = f"{self.base_url}/business-profile/scores"
        headers = {'Authorization': f'Bearer {self.token}'}
        
        try:
            response = requests.get(url, headers=headers, timeout=30)
            
            print(f"\n📤 GET {url}")
            print(f"📥 Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"📥 Response: {json.dumps(data, indent=2)}")
                
                # Verify completeness_score exists and is a number
                if 'completeness_score' in data:
                    completeness = data['completeness_score']
                    if isinstance(completeness, (int, float)) and 0 <= completeness <= 100:
                        self.log_test("Scores - completeness_score valid", True, f"Score: {completeness}%")
                        
                        # Since we saved 4 fields, completeness should be > 0
                        if completeness > 0:
                            self.log_test("Scores - completeness_score updated", True, f"Score increased to {completeness}% after profile save")
                        else:
                            self.log_test("Scores - completeness_score updated", False, "Score is 0 despite saving profile data")
                    else:
                        self.log_test("Scores - completeness_score valid", False, f"Invalid score value: {completeness}")
                else:
                    self.log_test("Scores - completeness_score exists", False, "Missing completeness_score field")
                
                # Verify business_score exists and is a number
                if 'business_score' in data:
                    business_score = data['business_score']
                    if isinstance(business_score, (int, float)) and 0 <= business_score <= 100:
                        self.log_test("Scores - business_score valid", True, f"Score: {business_score}%")
                        
                        # Business score should also be > 0 after saving profile
                        if business_score > 0:
                            self.log_test("Scores - business_score updated", True, f"Score increased to {business_score}% after profile save")
                        else:
                            self.log_test("Scores - business_score updated", False, "Score is 0 despite saving profile data")
                    else:
                        self.log_test("Scores - business_score valid", False, f"Invalid score value: {business_score}")
                else:
                    self.log_test("Scores - business_score exists", False, "Missing business_score field")
                
                return True
            else:
                error_data = response.json() if response.content else {}
                self.log_test("Scores - HTTP Status", False, f"Expected 200, got {response.status_code}: {error_data}")
                return False
                
        except Exception as e:
            self.log_test("Scores - Exception", False, f"Exception: {str(e)}")
            return False

    def run_all_tests(self):
        """Run all auth system tests"""
        print("\n" + "="*80)
        print("🚀 COMPLETE AUTH SYSTEM TEST - EMAIL/PASSWORD ONLY")
        print("="*80)
        print(f"Base URL: {self.base_url}")
        print(f"Timestamp: {datetime.now().isoformat()}")
        
        # Test 1: Registration
        reg_result = self.test_registration_flow()
        
        # Test 2: Login (if registration failed or user exists)
        if reg_result == "USER_EXISTS" or not reg_result:
            login_result = self.test_login_flow()
            if not login_result:
                print("\n❌ CRITICAL: Authentication failed, cannot continue tests")
                return self.generate_report()
        
        # Test 3: Auth Me
        self.test_auth_me()
        
        # Test 4: Business Profile Save
        save_result = self.test_business_profile_save()
        
        if save_result:
            # Test 5: Business Profile Persistence (multiple GET requests)
            self.test_business_profile_persistence()
            
            # Test 6: MongoDB Direct Verification
            self.test_mongodb_direct_verification()
            
            # Test 7: Business Profile Scores
            self.test_business_profile_scores()
        else:
            print("\n⚠️  Skipping persistence tests due to save failure")
        
        return self.generate_report()

    def generate_report(self):
        """Generate test report"""
        print("\n" + "="*80)
        print("📊 TEST REPORT")
        print("="*80)
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        
        print(f"\nTotal Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {success_rate:.1f}%")
        
        # Show failed tests
        failed_tests = [t for t in self.test_results if not t['success']]
        if failed_tests:
            print("\n❌ FAILED TESTS:")
            for test in failed_tests:
                print(f"  - {test['test_name']}")
                if test['details']:
                    print(f"    {test['details']}")
        
        report = {
            "summary": f"Auth System Testing - {self.tests_passed}/{self.tests_run} tests passed ({success_rate:.1f}%)",
            "total_tests": self.tests_run,
            "passed_tests": self.tests_passed,
            "failed_tests": self.tests_run - self.tests_passed,
            "success_rate": f"{success_rate:.1f}%",
            "test_details": self.test_results,
            "timestamp": datetime.now().isoformat()
        }
        
        return report

def main():
    tester = AuthSystemTester()
    report = tester.run_all_tests()
    
    # Save report
    try:
        os.makedirs('/app/test_reports', exist_ok=True)
        with open('/app/test_reports/auth_system_test_results.json', 'w') as f:
            json.dump(report, f, indent=2)
        print(f"\n📄 Report saved to: /app/test_reports/auth_system_test_results.json")
    except Exception as e:
        print(f"\n⚠️  Could not save report: {e}")
    
    # Return exit code based on test results
    return 0 if report['failed_tests'] == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
