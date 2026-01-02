import requests
import sys
import json
from datetime import datetime
import uuid

class StrategicAdvisorAPITester:
    def __init__(self, base_url="https://aiadvice-platform.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.admin_token = None
        self.admin_user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

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
        if details and not success:
            print(f"   Details: {details}")

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
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
                    details += f", Response: {error_data}"
                except:
                    details += f", Response: {response.text[:200]}"
            
            self.log_test(name, success, details if not success else "")
            
            return success, response.json() if success and response.content else {}

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test basic health endpoints"""
        print("\n🔍 Testing Health Endpoints...")
        self.run_test("Health Check", "GET", "health", 200)
        self.run_test("Root Endpoint", "GET", "", 200)

    def test_user_registration(self):
        """Test user registration"""
        print("\n🔍 Testing User Registration...")
        
        # Test with valid data - use unique email
        unique_id = str(uuid.uuid4())[:8]
        user_data = {
            "name": "Test User",
            "email": f"test{unique_id}@example.com",
            "password": "testpass123",
            "business_name": "Test Business",
            "industry": "Technology"
        }
        
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data=user_data
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_id = response['user']['id']
            
            # Verify subscription_tier is present and defaults to 'free'
            user_info = response.get('user', {})
            subscription_tier = user_info.get('subscription_tier')
            if subscription_tier == 'free':
                self.log_test("Registration - Default Free Tier", True, "")
            else:
                self.log_test("Registration - Default Free Tier", False, f"Expected 'free', got '{subscription_tier}'")
            
            return True
        return False

    def test_user_login(self):
        """Test user login"""
        print("\n🔍 Testing User Login...")
        
        # Now test regular login with existing user
        login_data = {
            "email": f"test{str(uuid.uuid4())[:8]}@example.com",
            "password": "testpass123"
        }
        
        # Register a new user for login test
        reg_data = {
            "name": "Login Test User",
            "email": login_data["email"],
            "password": login_data["password"],
            "business_name": "Login Test Business",
            "industry": "Technology"
        }
        
        reg_success, reg_response = self.run_test(
            "Login Test User Registration",
            "POST",
            "auth/register",
            200,
            data=reg_data
        )
        
        if not reg_success:
            return False
        
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login",
            200,
            data=login_data
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_id = response['user']['id']
            
            # Check if this user is admin (first user becomes admin)
            user_info = response.get('user', {})
            if user_info.get('role') == 'admin':
                self.admin_token = self.token
                self.admin_user_id = self.user_id
                self.log_test("Admin User Setup", True, "First user is admin")
            
            return True
        return False

    def test_auth_me(self):
        """Test get current user"""
        print("\n🔍 Testing Auth Me...")
        success, response = self.run_test("Get Current User", "GET", "auth/me", 200)
        
        if success:
            # Verify subscription_tier is present
            subscription_tier = response.get('subscription_tier')
            if subscription_tier is not None:
                self.log_test("Auth Me - Subscription Tier Present", True, f"Tier: {subscription_tier}")
            else:
                self.log_test("Auth Me - Subscription Tier Present", False, "subscription_tier field missing")
        
        return success

    def test_chat_functionality(self):
        """Test chat endpoints"""
        print("\n🔍 Testing Chat Functionality...")
        
        # Test chat message
        chat_data = {
            "message": "Hello, I need help with my business strategy",
            "context_type": "general"
        }
        
        success, response = self.run_test(
            "Send Chat Message",
            "POST",
            "chat",
            200,
            data=chat_data
        )
        
        session_id = None
        if success and 'session_id' in response:
            session_id = response['session_id']
        
        # Test chat history
        self.run_test("Get Chat History", "GET", "chat/history", 200)
        
        # Test chat sessions
        self.run_test("Get Chat Sessions", "GET", "chat/sessions", 200)
        
        return session_id

    def test_analysis_functionality(self):
        """Test business analysis endpoints"""
        print("\n🔍 Testing Analysis Functionality...")
        
        # Create analysis
        analysis_data = {
            "title": "Test Business Analysis",
            "analysis_type": "business_analysis",
            "business_context": "Small tech startup looking to optimize operations and growth strategy"
        }
        
        success, response = self.run_test(
            "Create Analysis",
            "POST",
            "analyses",
            200,
            data=analysis_data
        )
        
        analysis_id = None
        if success and 'id' in response:
            analysis_id = response['id']
        
        # Get all analyses
        self.run_test("Get All Analyses", "GET", "analyses", 200)
        
        # Get specific analysis
        if analysis_id:
            self.run_test(
                "Get Specific Analysis",
                "GET",
                f"analyses/{analysis_id}",
                200
            )
        
        return analysis_id

    def test_document_functionality(self):
        """Test document management endpoints"""
        print("\n🔍 Testing Document Functionality...")
        
        # Create document
        doc_data = {
            "title": "Test SOP Document",
            "document_type": "SOP",
            "content": "# Test SOP\n\nThis is a test standard operating procedure.",
            "tags": ["test", "sop"]
        }
        
        success, response = self.run_test(
            "Create Document",
            "POST",
            "documents",
            200,
            data=doc_data
        )
        
        doc_id = None
        if success and 'id' in response:
            doc_id = response['id']
        
        # Get all documents
        self.run_test("Get All Documents", "GET", "documents", 200)
        
        # Get specific document
        if doc_id:
            self.run_test(
                "Get Specific Document",
                "GET",
                f"documents/{doc_id}",
                200
            )
            
            # Update document
            update_data = {
                "title": "Updated Test SOP",
                "document_type": "SOP",
                "content": "# Updated Test SOP\n\nThis is an updated test procedure.",
                "tags": ["test", "sop", "updated"]
            }
            
            self.run_test(
                "Update Document",
                "PUT",
                f"documents/{doc_id}",
                200,
                data=update_data
            )
        
        return doc_id

    def test_business_profile_au_fields(self):
        """Test business profile with new AU fields"""
        print("\n🔍 Testing Business Profile AU Fields...")
        
        # Test business profile update with AU fields
        profile_data = {
            "industry": "M",  # ANZSIC division M
            "business_type": "Company (Pty Ltd)",
            "abn": "12345678901",
            "acn": "123456789",
            "target_country": "Australia",
            "retention_known": True,
            "retention_rate_range": "60-80%"
        }
        
        success, response = self.run_test(
            "Update Business Profile with AU Fields",
            "PUT",
            "business-profile",
            200,
            data=profile_data
        )
        
        if success:
            # Verify retention_rag is computed and present
            retention_rag = response.get('retention_rag')
            if retention_rag is not None:
                self.log_test("Business Profile - Retention RAG Computed", True, f"RAG: {retention_rag}")
            else:
                self.log_test("Business Profile - Retention RAG Computed", False, "retention_rag field missing")
            
            # Verify all AU fields are present
            au_fields = ['industry', 'business_type', 'abn', 'acn', 'target_country', 'retention_known', 'retention_rate_range']
            missing_fields = []
            for field in au_fields:
                if field not in response:
                    missing_fields.append(field)
            
            if not missing_fields:
                self.log_test("Business Profile - All AU Fields Present", True, "")
            else:
                self.log_test("Business Profile - All AU Fields Present", False, f"Missing: {missing_fields}")
        
        return success

    def test_oac_recommendations(self):
        """Test OAC recommendations endpoint"""
        print("\n🔍 Testing OAC Recommendations...")
        
        # First call - should return locked:false, items length 5
        success1, response1 = self.run_test(
            "OAC Recommendations - First Call",
            "GET",
            "oac/recommendations",
            200
        )
        
        if success1:
            # Verify locked is false
            locked = response1.get('locked')
            if locked == False:
                self.log_test("OAC - First Call Not Locked", True, "")
            else:
                self.log_test("OAC - First Call Not Locked", False, f"locked: {locked}")
            
            # Verify items length is 5
            items = response1.get('items', [])
            if len(items) == 5:
                self.log_test("OAC - First Call Items Length", True, f"Items: {len(items)}")
            else:
                self.log_test("OAC - First Call Items Length", False, f"Expected 5 items, got {len(items)}")
            
            # Store usage for comparison
            usage1 = response1.get('usage', {})
            used1 = usage1.get('used', 0)
        
        # Second call - should be cached and not increment usage
        success2, response2 = self.run_test(
            "OAC Recommendations - Second Call (Cached)",
            "GET",
            "oac/recommendations",
            200
        )
        
        if success2:
            # Verify cached is true
            meta = response2.get('meta', {})
            cached = meta.get('cached')
            if cached == True:
                self.log_test("OAC - Second Call Cached", True, "")
            else:
                self.log_test("OAC - Second Call Cached", False, f"cached: {cached}")
            
            # Verify usage didn't increment
            usage2 = response2.get('usage', {})
            used2 = usage2.get('used', 0)
            if success1 and used1 == used2:
                self.log_test("OAC - Usage Not Incremented on Cache", True, f"Usage stayed at {used2}")
            else:
                self.log_test("OAC - Usage Not Incremented on Cache", False, f"Usage changed from {used1} to {used2}")
        
        return success1 and success2

    def test_admin_subscription_endpoint(self):
        """Test admin subscription management"""
        print("\n🔍 Testing Admin Subscription Endpoint...")
        
        if not self.admin_token or not self.user_id:
            self.log_test("Admin Subscription Test", False, "Admin token or user ID not available")
            return False
        
        # Save current token and switch to admin
        user_token = self.token
        self.token = self.admin_token
        
        # Test setting subscription tier to professional
        subscription_data = {
            "subscription_tier": "professional"
        }
        
        success, response = self.run_test(
            "Admin Set Subscription Tier",
            "PUT",
            f"admin/users/{self.user_id}/subscription",
            200,
            data=subscription_data
        )
        
        if success:
            # Verify the tier was updated
            updated_tier = response.get('subscription_tier')
            if updated_tier == 'professional':
                self.log_test("Admin - Subscription Tier Updated", True, f"Tier: {updated_tier}")
            else:
                self.log_test("Admin - Subscription Tier Updated", False, f"Expected 'professional', got '{updated_tier}'")
        
        # Restore user token
        self.token = user_token
        
        return success

    def test_quota_lock_simulation(self):
        """Test quota lock behavior for free users"""
        print("\n🔍 Testing Quota Lock Simulation...")
        
        # First, make one OAC call to establish baseline
        success, response = self.run_test(
            "Quota Test - Initial OAC Call",
            "GET",
            "oac/recommendations",
            200
        )
        
        if success:
            usage = response.get('usage', {})
            used = usage.get('used', 0)
            limit = usage.get('limit', 0)
            locked = response.get('locked', True)
            
            # Verify used <= limit and locked is false after first call
            if used <= limit:
                self.log_test("Quota - Used Within Limit", True, f"Used: {used}, Limit: {limit}")
            else:
                self.log_test("Quota - Used Within Limit", False, f"Used: {used} exceeds Limit: {limit}")
            
            if locked == False:
                self.log_test("Quota - Not Locked After First Call", True, "")
            else:
                self.log_test("Quota - Not Locked After First Call", False, f"locked: {locked}")
        
        return success

    def test_sop_generators(self):
        """Test SOP generation endpoints"""
        print("\n🔍 Testing SOP Generators...")
        
        # Test SOP generation
        sop_data = {
            "topic": "Customer Onboarding Process",
            "business_context": "SaaS company with subscription model"
        }
        
        self.run_test(
            "Generate SOP",
            "POST",
            "generate/sop",
            200,
            data=sop_data
        )
        
        # Test checklist generation
        checklist_data = {
            "topic": "Product Launch Checklist",
            "context": "New feature launch for existing product"
        }
        
        self.run_test(
            "Generate Checklist",
            "POST",
            "generate/checklist",
            200,
            data=checklist_data
        )
        
        # Test action plan generation
        action_plan_data = {
            "goal": "Increase monthly revenue by 25%",
            "timeline": "6 months",
            "resources": "Marketing team of 3, $10k budget"
        }
        
        self.run_test(
            "Generate Action Plan",
            "POST",
            "generate/action-plan",
            200,
            data=action_plan_data
        )

    def test_dashboard_stats(self):
        """Test dashboard statistics"""
        print("\n🔍 Testing Dashboard Stats...")
        self.run_test("Get Dashboard Stats", "GET", "dashboard/stats", 200)

    def test_admin_functionality(self):
        """Test admin endpoints"""
        print("\n🔍 Testing Admin Functionality...")
        
        # Test admin stats
        self.run_test("Get Admin Stats", "GET", "admin/stats", 200)
        
        # Test get users
        self.run_test("Get All Users", "GET", "admin/users", 200)

    def test_cleanup(self, analysis_id=None, doc_id=None):
        """Clean up test data"""
        print("\n🧹 Cleaning up test data...")
        
        if analysis_id:
            self.run_test(
                "Delete Analysis",
                "DELETE",
                f"analyses/{analysis_id}",
                200
            )
        
        if doc_id:
            self.run_test(
                "Delete Document",
                "DELETE",
                f"documents/{doc_id}",
                200
            )

    def run_all_tests(self):
        """Run all tests"""
        print("🚀 Starting Strategic Advisor API Tests...")
        print(f"Base URL: {self.base_url}")
        
        # Health checks
        self.test_health_check()
        
        # Authentication flow
        if not self.test_user_registration():
            # If registration fails, try login
            if not self.test_user_login():
                print("❌ Authentication failed, stopping tests")
                return self.generate_report()
        
        self.test_auth_me()
        
        # NEW: Test business profile with AU fields
        self.test_business_profile_au_fields()
        
        # NEW: Test OAC recommendations
        self.test_oac_recommendations()
        
        # NEW: Test admin subscription endpoint
        self.test_admin_subscription_endpoint()
        
        # NEW: Test quota lock simulation
        self.test_quota_lock_simulation()
        
        # Core functionality tests
        session_id = self.test_chat_functionality()
        analysis_id = self.test_analysis_functionality()
        doc_id = self.test_document_functionality()
        
        # Generator tests
        self.test_sop_generators()
        
        # Dashboard and admin tests
        self.test_dashboard_stats()
        self.test_admin_functionality()
        
        # Cleanup
        self.test_cleanup(analysis_id, doc_id)
        
        return self.generate_report()

    def generate_report(self):
        """Generate test report"""
        print(f"\n📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        
        report = {
            "summary": f"Backend API testing completed - {self.tests_passed}/{self.tests_run} tests passed ({success_rate:.1f}%)",
            "total_tests": self.tests_run,
            "passed_tests": self.tests_passed,
            "failed_tests": self.tests_run - self.tests_passed,
            "success_rate": f"{success_rate:.1f}%",
            "test_details": self.test_results,
            "timestamp": datetime.now().isoformat()
        }
        
        return report

def main():
    tester = StrategicAdvisorAPITester()
    report = tester.run_all_tests()
    
    # Save report
    with open('/app/test_reports/backend_api_test_results.json', 'w') as f:
        json.dump(report, f, indent=2)
    
    print(f"\n📄 Report saved to: /app/test_reports/backend_api_test_results.json")
    
    return 0 if report['failed_tests'] == 0 else 1

if __name__ == "__main__":
    sys.exit(main())