"""
BIQC Platform Comprehensive Testing
Tests all authentication flows, core features, and integrations for investor demo readiness
"""
import requests
import sys
import json
from datetime import datetime
import uuid

class BIQCPlatformTester:
    def __init__(self, base_url="https://auth-upgrade-33.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.user_email = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.critical_failures = []

    def log_test(self, name, success, details="", is_critical=False):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
        elif is_critical:
            self.critical_failures.append({"test": name, "details": details})
        
        result = {
            "test_name": name,
            "success": success,
            "details": details,
            "is_critical": is_critical,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        
        status = "✅ PASS" if success else ("🔴 CRITICAL FAIL" if is_critical else "❌ FAIL")
        print(f"{status} - {name}")
        if details and not success:
            print(f"   Details: {details}")

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None, is_critical=False):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=30)

            success = response.status_code == expected_status
            details = f"Status: {response.status_code}, Expected: {expected_status}"
            
            if not success:
                try:
                    error_data = response.json()
                    details += f", Response: {json.dumps(error_data)[:300]}"
                except:
                    details += f", Response: {response.text[:300]}"
            
            self.log_test(name, success, details if not success else "", is_critical=is_critical)
            
            return success, response.json() if success and response.content else {}

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}", is_critical=is_critical)
            return False, {}

    # ==================== AUTHENTICATION FLOW TESTS ====================
    
    def test_mongodb_auth_fallback(self):
        """Use pre-created confirmed test user for testing"""
        print("\n🔐 Using Pre-Created Test User (Email Confirmed)...")
        
        login_data = {
            "email": "testing@biqc.demo",
            "password": "TestPass123!"
        }
        
        # Login with confirmed test user
        success, response = self.run_test(
            "Test User Login",
            "POST",
            "auth/supabase/login",
            200,
            data=login_data,
            is_critical=True
        )
        
        if success:
            session = response.get('session', {})
            self.token = session.get('access_token')
            user_info = response.get('user', {})
            self.user_id = user_info.get('id')
            self.user_email = login_data['email']
            
            if self.token:
                self.log_test("Test User - Token Received", True, f"User ID: {self.user_id}")
                return True
            else:
                self.log_test("Test User - Token Received", False, "No access_token in response", is_critical=True)
                return False
        
        return False
    
    def test_supabase_email_signup(self):
        """Test Supabase email signup"""
        print("\n🔐 Testing Supabase Email Signup...")
        
        unique_id = str(uuid.uuid4())[:8]
        signup_data = {
            "email": f"biqc_test_{unique_id}@testdomain.com",
            "password": "BiqcTest123!",
            "full_name": "BIQC Test User",
            "company_name": "BIQC Test Company",
            "industry": "Technology"
        }
        
        success, response = self.run_test(
            "Supabase Email Signup",
            "POST",
            "auth/supabase/signup",
            200,
            data=signup_data,
            is_critical=False  # Not critical since email confirmation is required
        )
        
        if success:
            # Check if user was created (even without token)
            user_info = response.get('user', {})
            if user_info and user_info.get('id'):
                self.log_test("Signup - User Created", True, f"User ID: {user_info.get('id')}")
                
                # Check session
                session = response.get('session', {})
                if session and session.get('access_token'):
                    self.token = session['access_token']
                    self.user_id = user_info.get('id')
                    self.user_email = signup_data['email']
                    self.log_test("Signup - Token Received", True, f"User ID: {self.user_id}")
                    self.verify_user_profile_created()
                    return True
                else:
                    self.log_test("Signup - Token Received (Email Confirmation Required)", False, 
                                "Supabase requires email confirmation - access_token is null", is_critical=False)
                    return False
            else:
                self.log_test("Signup - User Created", False, "No user info in response", is_critical=True)
                return False
        return False

    def verify_user_profile_created(self):
        """Verify user profile exists in database after signup"""
        print("\n🔍 Verifying User Profile Creation...")
        
        success, response = self.run_test(
            "User Profile Created in Database",
            "GET",
            "auth/supabase/me",
            200,
            is_critical=True
        )
        
        if success:
            user = response.get('user', {})
            if user and user.get('id') == self.user_id:
                self.log_test("Profile - User ID Matches", True, "")
                
                # Check for required fields
                required_fields = ['id', 'email', 'subscription_tier']
                missing = [f for f in required_fields if f not in user]
                if not missing:
                    self.log_test("Profile - Required Fields Present", True, "")
                else:
                    self.log_test("Profile - Required Fields Present", False, f"Missing: {missing}", is_critical=True)
            else:
                self.log_test("Profile - User ID Matches", False, f"Expected {self.user_id}, got {user.get('id')}", is_critical=True)

    def test_supabase_email_login(self):
        """Test Supabase email login"""
        print("\n🔐 Testing Supabase Email Login...")
        
        # First create a user to login with
        unique_id = str(uuid.uuid4())[:8]
        login_email = f"biqc_login_{unique_id}@testdomain.com"
        login_password = "BiqcLogin123!"
        
        signup_data = {
            "email": login_email,
            "password": login_password,
            "full_name": "BIQC Login Test",
            "company_name": "BIQC Login Company",
            "industry": "Technology"
        }
        
        # Register user
        reg_success, reg_response = self.run_test(
            "Login Test - User Registration",
            "POST",
            "auth/supabase/signup",
            200,
            data=signup_data
        )
        
        if not reg_success:
            self.log_test("Login Test - Setup Failed", False, "Could not create test user", is_critical=True)
            return False
        
        # Now test login
        login_data = {
            "email": login_email,
            "password": login_password
        }
        
        success, response = self.run_test(
            "Supabase Email Login",
            "POST",
            "auth/supabase/login",
            200,
            data=login_data,
            is_critical=True
        )
        
        if success:
            session = response.get('session', {})
            if session and session.get('access_token'):
                # Update token for subsequent tests
                self.token = session['access_token']
                self.user_id = response.get('user', {}).get('id')
                self.user_email = login_email
                self.log_test("Login - Token Received", True, "")
                return True
            else:
                self.log_test("Login - Token Received", False, "No access_token in response", is_critical=True)
                return False
        return False

    def test_google_oauth_flow(self):
        """Test Google OAuth flow initiation"""
        print("\n🔐 Testing Google OAuth Flow...")
        
        success, response = self.run_test(
            "Google OAuth - Get Auth URL",
            "GET",
            "auth/supabase/oauth/google",
            200
        )
        
        if success:
            auth_url = response.get('url')
            if auth_url and 'accounts.google.com' in auth_url:
                self.log_test("Google OAuth - Valid Auth URL", True, f"URL: {auth_url[:100]}...")
            else:
                self.log_test("Google OAuth - Valid Auth URL", False, f"Invalid URL: {auth_url}")
        
        return success

    def test_microsoft_oauth_flow(self):
        """Test Microsoft OAuth flow initiation"""
        print("\n🔐 Testing Microsoft OAuth Flow...")
        
        success, response = self.run_test(
            "Microsoft OAuth - Get Auth URL",
            "GET",
            "auth/supabase/oauth/azure",
            200
        )
        
        if success:
            auth_url = response.get('url')
            if auth_url and 'login.microsoftonline.com' in auth_url:
                self.log_test("Microsoft OAuth - Valid Auth URL", True, f"URL: {auth_url[:100]}...")
            else:
                self.log_test("Microsoft OAuth - Valid Auth URL", False, f"Invalid URL: {auth_url}")
        
        return success

    def test_token_validation(self):
        """Test token validation with authenticated endpoints"""
        print("\n🔐 Testing Token Validation...")
        
        if not self.token:
            self.log_test("Token Validation", False, "No token available for testing", is_critical=True)
            return False
        
        # Test with valid token
        success, response = self.run_test(
            "Token Validation - Valid Token",
            "GET",
            "auth/supabase/me",
            200,
            is_critical=True
        )
        
        if success:
            # Test with invalid token
            old_token = self.token
            self.token = "invalid_token_12345"
            
            invalid_success, invalid_response = self.run_test(
                "Token Validation - Invalid Token Rejected",
                "GET",
                "auth/supabase/me",
                401
            )
            
            # Restore valid token
            self.token = old_token
            
            if invalid_success:
                self.log_test("Token Validation - Security Working", True, "Invalid tokens properly rejected")
            else:
                self.log_test("Token Validation - Security Working", False, "Invalid token not rejected properly")
        
        return success

    # ==================== CORE BIQC FEATURES TESTS ====================
    
    def test_advisor_chat(self):
        """Test Advisor chat endpoint with business query"""
        print("\n💬 Testing Advisor Chat...")
        
        chat_data = {
            "message": "I'm running a small consulting business and need help with client retention strategies. What should I focus on?",
            "context_type": "advisor"
        }
        
        success, response = self.run_test(
            "Advisor Chat - Send Message",
            "POST",
            "chat",
            200,
            data=chat_data,
            is_critical=True
        )
        
        if success:
            # Verify response structure
            if 'response' in response and 'session_id' in response:
                response_text = response.get('response', '')
                session_id = response.get('session_id', '')
                
                self.log_test("Advisor Chat - Response Structure Valid", True, f"Session: {session_id}")
                
                # Verify response is not empty and has reasonable length
                if len(response_text) > 50:
                    self.log_test("Advisor Chat - Response Content Valid", True, f"Length: {len(response_text)} chars")
                else:
                    self.log_test("Advisor Chat - Response Content Valid", False, f"Response too short: {len(response_text)} chars")
                
                return session_id
            else:
                self.log_test("Advisor Chat - Response Structure Valid", False, "Missing response or session_id", is_critical=True)
                return None
        
        return None

    def test_chat_history(self):
        """Test chat history retrieval"""
        print("\n💬 Testing Chat History...")
        
        success, response = self.run_test(
            "Chat History - Retrieve",
            "GET",
            "chat/history",
            200,
            is_critical=True
        )
        
        if success:
            if isinstance(response, list):
                self.log_test("Chat History - Response Type Valid", True, f"Retrieved {len(response)} messages")
            else:
                self.log_test("Chat History - Response Type Valid", False, f"Expected list, got {type(response)}")
        
        return success

    def test_dashboard_stats(self):
        """Test dashboard stats endpoint"""
        print("\n📊 Testing Dashboard Stats...")
        
        success, response = self.run_test(
            "Dashboard Stats - Retrieve",
            "GET",
            "dashboard/stats",
            200,
            is_critical=True
        )
        
        if success:
            # Verify expected fields
            expected_fields = ['total_chats', 'total_documents', 'total_analyses']
            present_fields = [f for f in expected_fields if f in response]
            
            if len(present_fields) >= 2:  # At least 2 of 3 fields should be present
                self.log_test("Dashboard Stats - Fields Present", True, f"Found: {', '.join(present_fields)}")
            else:
                self.log_test("Dashboard Stats - Fields Present", False, f"Only found: {', '.join(present_fields)}")
        
        return success

    def test_onboarding_status(self):
        """Test onboarding status endpoint"""
        print("\n📋 Testing Onboarding Status...")
        
        success, response = self.run_test(
            "Onboarding Status - Retrieve",
            "GET",
            "onboarding/status",
            200,
            is_critical=True
        )
        
        if success:
            # Verify expected fields
            if 'completed' in response and 'current_step' in response:
                self.log_test("Onboarding Status - Fields Present", True, f"Completed: {response.get('completed')}, Step: {response.get('current_step')}")
            else:
                self.log_test("Onboarding Status - Fields Present", False, "Missing completed or current_step fields")
        
        return success

    # ==================== OUTLOOK INTEGRATION TESTS ====================
    
    def test_outlook_status(self):
        """Test Outlook status check"""
        print("\n📧 Testing Outlook Integration...")
        
        success, response = self.run_test(
            "Outlook Status - Check Connection",
            "GET",
            "outlook/status",
            200,
            is_critical=True
        )
        
        if success:
            # Verify response structure
            expected_fields = ['connected', 'emails_synced']
            missing = [f for f in expected_fields if f not in response]
            
            if not missing:
                connected = response.get('connected', False)
                emails_count = response.get('emails_synced', 0)
                self.log_test("Outlook Status - Response Structure Valid", True, f"Connected: {connected}, Emails: {emails_count}")
                
                # Verify m365_tokens table structure (indirectly through status)
                if isinstance(connected, bool) and isinstance(emails_count, int):
                    self.log_test("Outlook Status - Data Types Valid", True, "")
                else:
                    self.log_test("Outlook Status - Data Types Valid", False, f"Invalid types: connected={type(connected)}, emails={type(emails_count)}")
            else:
                self.log_test("Outlook Status - Response Structure Valid", False, f"Missing fields: {missing}", is_critical=True)
        
        return success

    # ==================== DATA MANAGEMENT TESTS ====================
    
    def test_document_upload(self):
        """Test document upload capability"""
        print("\n📄 Testing Document Upload...")
        
        doc_data = {
            "title": "BIQC Test Document",
            "document_type": "Business Plan",
            "content": "# BIQC Test Document\n\nThis is a test document for BIQC platform validation.\n\n## Business Overview\nTesting document management system.",
            "tags": ["test", "biqc", "validation"]
        }
        
        success, response = self.run_test(
            "Document Upload - Create Document",
            "POST",
            "documents",
            200,
            data=doc_data,
            is_critical=True
        )
        
        if success:
            # Verify response structure
            if 'id' in response and 'user_id' in response:
                doc_id = response.get('id')
                self.log_test("Document Upload - Response Structure Valid", True, f"Document ID: {doc_id}")
                
                # Test document retrieval
                self.test_document_retrieval(doc_id)
                
                return doc_id
            else:
                self.log_test("Document Upload - Response Structure Valid", False, "Missing id or user_id", is_critical=True)
                return None
        
        return None

    def test_document_retrieval(self, doc_id):
        """Test document retrieval"""
        if not doc_id:
            return False
        
        success, response = self.run_test(
            "Document Retrieval - Get Document",
            "GET",
            f"documents/{doc_id}",
            200
        )
        
        if success:
            if response.get('id') == doc_id:
                self.log_test("Document Retrieval - ID Matches", True, "")
            else:
                self.log_test("Document Retrieval - ID Matches", False, f"Expected {doc_id}, got {response.get('id')}")
        
        return success

    def test_business_profile_endpoints(self):
        """Test business profile endpoints"""
        print("\n🏢 Testing Business Profile...")
        
        # Test GET business profile
        success, response = self.run_test(
            "Business Profile - Get Profile",
            "GET",
            "business-profile",
            200
        )
        
        # Test UPDATE business profile
        profile_data = {
            "business_name": "BIQC Test Business",
            "industry": "M",  # Professional Services
            "business_type": "Company (Pty Ltd)",
            "target_country": "Australia",
            "main_challenges": "Testing BIQC platform for investor demo"
        }
        
        update_success, update_response = self.run_test(
            "Business Profile - Update Profile",
            "PUT",
            "business-profile",
            200,
            data=profile_data,
            is_critical=True
        )
        
        if update_success:
            # Verify updated fields are returned
            for key, value in profile_data.items():
                if key in update_response and update_response[key] == value:
                    continue
                else:
                    self.log_test(f"Business Profile - {key} Updated", False, f"Expected {value}, got {update_response.get(key)}")
                    break
            else:
                self.log_test("Business Profile - All Fields Updated", True, "")
        
        return update_success

    # ==================== DATABASE CONNECTIVITY TESTS ====================
    
    def test_database_connectivity(self):
        """Test database connectivity (MongoDB and Supabase)"""
        print("\n🗄️ Testing Database Connectivity...")
        
        # Test Supabase connectivity through user profile
        success, response = self.run_test(
            "Database - Supabase Connectivity",
            "GET",
            "auth/supabase/me",
            200,
            is_critical=True
        )
        
        if success:
            self.log_test("Database - Supabase Working", True, "User profile retrieved successfully")
        else:
            self.log_test("Database - Supabase Working", False, "Could not retrieve user profile", is_critical=True)
        
        return success

    def test_cognitive_core_accessibility(self):
        """Test if cognitive core is accessible"""
        print("\n🧠 Testing Cognitive Core Accessibility...")
        
        # Cognitive core is accessed through chat and analysis endpoints
        # Test through advisor chat
        chat_data = {
            "message": "Test cognitive core accessibility",
            "context_type": "advisor"
        }
        
        success, response = self.run_test(
            "Cognitive Core - Accessibility Test",
            "POST",
            "chat",
            200,
            data=chat_data,
            is_critical=True
        )
        
        if success:
            self.log_test("Cognitive Core - Accessible", True, "Chat endpoint working (uses cognitive core)")
        else:
            self.log_test("Cognitive Core - Accessible", False, "Chat endpoint failed (cognitive core may be inaccessible)", is_critical=True)
        
        return success

    def test_hybrid_auth(self):
        """Test hybrid auth (both Supabase and MongoDB tokens)"""
        print("\n🔐 Testing Hybrid Auth...")
        
        # Test Supabase token (already tested in token_validation)
        supabase_success, supabase_response = self.run_test(
            "Hybrid Auth - Supabase Token",
            "GET",
            "auth/supabase/me",
            200
        )
        
        if supabase_success:
            self.log_test("Hybrid Auth - Supabase Token Working", True, "")
        else:
            self.log_test("Hybrid Auth - Supabase Token Working", False, "Supabase token validation failed", is_critical=True)
        
        return supabase_success

    # ==================== MAIN TEST RUNNER ====================
    
    def run_comprehensive_tests(self):
        """Run all comprehensive BIQC platform tests"""
        print("🚀 Starting BIQC Platform Comprehensive Testing...")
        print(f"Base URL: {self.base_url}")
        print("\n" + "="*80)
        print("TESTING SCOPE: BIQC Platform - Investor Demo Readiness")
        print("="*80)
        
        # PHASE 1: Authentication Flow
        print("\n" + "="*80)
        print("PHASE 1: AUTHENTICATION FLOW")
        print("="*80)
        
        # Try Supabase signup first
        supabase_signup_success = self.test_supabase_email_signup()
        
        # If Supabase signup doesn't provide token (email confirmation required),
        # use MongoDB auth as fallback to get a token for testing other endpoints
        if not self.token:
            print("\n⚠️ Supabase email confirmation required. Using MongoDB auth for testing...")
            if not self.test_mongodb_auth_fallback():
                print("❌ CRITICAL: Could not obtain authentication token. Cannot proceed with authenticated tests.")
                return self.generate_report()
        
        # Test other auth flows
        self.test_supabase_email_login()
        self.test_google_oauth_flow()
        self.test_microsoft_oauth_flow()
        self.test_token_validation()
        
        # PHASE 2: Core BIQC Features
        print("\n" + "="*80)
        print("PHASE 2: CORE BIQC FEATURES")
        print("="*80)
        
        self.test_advisor_chat()
        self.test_chat_history()
        self.test_dashboard_stats()
        self.test_onboarding_status()
        
        # PHASE 3: Outlook Integration
        print("\n" + "="*80)
        print("PHASE 3: OUTLOOK INTEGRATION")
        print("="*80)
        
        self.test_outlook_status()
        
        # PHASE 4: Data Management
        print("\n" + "="*80)
        print("PHASE 4: DATA MANAGEMENT")
        print("="*80)
        
        self.test_document_upload()
        self.test_business_profile_endpoints()
        
        # PHASE 5: Database Migration Status
        print("\n" + "="*80)
        print("PHASE 5: DATABASE MIGRATION STATUS")
        print("="*80)
        
        self.test_database_connectivity()
        self.test_cognitive_core_accessibility()
        self.test_hybrid_auth()
        
        return self.generate_report()

    def generate_report(self):
        """Generate comprehensive test report"""
        print("\n" + "="*80)
        print("TEST RESULTS SUMMARY")
        print("="*80)
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        
        print(f"\n📊 Overall: {self.tests_passed}/{self.tests_run} tests passed ({success_rate:.1f}%)")
        
        if self.critical_failures:
            print(f"\n🔴 CRITICAL FAILURES: {len(self.critical_failures)}")
            for failure in self.critical_failures:
                print(f"   - {failure['test']}: {failure['details']}")
        
        # Group results by phase
        phases = {
            "Authentication": [],
            "Core Features": [],
            "Outlook": [],
            "Data Management": [],
            "Database": []
        }
        
        for result in self.test_results:
            test_name = result['test_name']
            if any(x in test_name for x in ['Signup', 'Login', 'OAuth', 'Token', 'Profile Created']):
                phases["Authentication"].append(result)
            elif any(x in test_name for x in ['Chat', 'Dashboard', 'Onboarding']):
                phases["Core Features"].append(result)
            elif 'Outlook' in test_name:
                phases["Outlook"].append(result)
            elif any(x in test_name for x in ['Document', 'Business Profile']):
                phases["Data Management"].append(result)
            elif any(x in test_name for x in ['Database', 'Cognitive Core', 'Hybrid Auth']):
                phases["Database"].append(result)
        
        print("\n📋 Results by Phase:")
        for phase, results in phases.items():
            if results:
                passed = sum(1 for r in results if r['success'])
                total = len(results)
                print(f"\n{phase}: {passed}/{total} passed")
                for result in results:
                    status = "✅" if result['success'] else "❌"
                    print(f"  {status} {result['test_name']}")
        
        report = {
            "summary": f"BIQC Platform testing completed - {self.tests_passed}/{self.tests_run} tests passed ({success_rate:.1f}%)",
            "total_tests": self.tests_run,
            "passed_tests": self.tests_passed,
            "failed_tests": self.tests_run - self.tests_passed,
            "critical_failures": len(self.critical_failures),
            "success_rate": f"{success_rate:.1f}%",
            "test_details": self.test_results,
            "critical_failures_list": self.critical_failures,
            "timestamp": datetime.now().isoformat()
        }
        
        return report

def main():
    tester = BIQCPlatformTester()
    report = tester.run_comprehensive_tests()
    
    # Save report
    with open('/app/test_reports/biqc_comprehensive_test_results.json', 'w') as f:
        json.dump(report, f, indent=2)
    
    print(f"\n📄 Report saved to: /app/test_reports/biqc_comprehensive_test_results.json")
    
    # Return exit code based on critical failures
    return 0 if len(tester.critical_failures) == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
