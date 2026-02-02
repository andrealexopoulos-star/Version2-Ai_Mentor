import requests
import sys
import json
from datetime import datetime
import uuid

class StrategicAdvisorAPITester:
    def __init__(self, base_url="https://biqc-advisor.preview.emergentagent.com/api"):
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
        """Test user registration with Supabase"""
        print("\n🔍 Testing User Registration (Supabase)...")
        
        # Test with valid data - use unique email with proper domain
        unique_id = str(uuid.uuid4())[:8]
        user_data = {
            "email": f"testuser{unique_id}@testdomain.com",
            "password": "testpass123456",  # Supabase requires 6+ chars
            "full_name": "Test User",
            "company_name": "Test Business",
            "industry": "Technology"
        }
        
        success, response = self.run_test(
            "User Registration (Supabase)",
            "POST",
            "auth/supabase/signup",
            200,
            data=user_data
        )
        
        if success:
            # Check for session with access_token
            session = response.get('session', {})
            if session and session.get('access_token'):
                self.token = session['access_token']
                user_info = response.get('user', {})
                self.user_id = user_info.get('id')
                self.log_test("Registration - Token Received", True, "")
                return True
            else:
                self.log_test("Registration - Token Received", False, "No access_token in response")
                return False
        return False

    def test_user_login(self):
        """Test user login with Supabase"""
        print("\n🔍 Testing User Login (Supabase)...")
        
        # Register a new user for login test
        unique_id = str(uuid.uuid4())[:8]
        login_data = {
            "email": f"logintest{unique_id}@testdomain.com",
            "password": "testpass123456"
        }
        
        reg_data = {
            "email": login_data["email"],
            "password": login_data["password"],
            "full_name": "Login Test User",
            "company_name": "Login Test Business",
            "industry": "Technology"
        }
        
        reg_success, reg_response = self.run_test(
            "Login Test User Registration (Supabase)",
            "POST",
            "auth/supabase/signup",
            200,
            data=reg_data
        )
        
        if not reg_success:
            return False
        
        # Now test login
        success, response = self.run_test(
            "User Login (Supabase)",
            "POST",
            "auth/supabase/login",
            200,
            data=login_data
        )
        
        if success:
            session = response.get('session', {})
            if session and session.get('access_token'):
                self.token = session['access_token']
                user_info = response.get('user', {})
                self.user_id = user_info.get('id')
                self.log_test("Login - Token Received", True, "")
                return True
            else:
                self.log_test("Login - Token Received", False, "No access_token in response")
                return False
        return False

    def test_auth_me(self):
        """Test get current user with Supabase"""
        print("\n🔍 Testing Auth Me (Supabase)...")
        success, response = self.run_test("Get Current User (Supabase)", "GET", "auth/supabase/me", 200)
        
        if success:
            # Verify user field is present
            user = response.get('user')
            if user and user.get('id') and user.get('email'):
                self.log_test("Auth Me - User Data Present", True, f"User: {user.get('email')}")
            else:
                self.log_test("Auth Me - User Data Present", False, "Missing user data")
        
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

    def test_advisor_brain_analysis(self):
        """Test Analysis with Advisor Brain pattern"""
        print("\n🔍 Testing Advisor Brain Analysis Pattern...")
        
        # First, update business profile to provide context for personalization
        profile_data = {
            "business_name": "Tech Consulting Firm",
            "industry": "M",  # Professional Services
            "business_type": "Company (Pty Ltd)",
            "business_stage": "established",
            "target_country": "Australia",
            "employee_count": "1-5",
            "main_challenges": "Scaling from 5 to 20 clients while maintaining quality",
            "short_term_goals": "Increase client base and streamline operations"
        }
        
        success, profile_response = self.run_test(
            "Setup Business Profile for Advisor Brain",
            "PUT",
            "business-profile",
            200,
            data=profile_data
        )
        
        if not success:
            self.log_test("Advisor Brain - Profile Setup Failed", False, "Could not set up business profile")
            return None
        
        # Create analysis with Advisor Brain
        analysis_data = {
            "title": "Growth Strategy Analysis",
            "analysis_type": "business_analysis",
            "business_context": "Tech consulting business, 2 years old, looking to scale from 5 to 20 clients"
        }
        
        success, response = self.run_test(
            "Create Advisor Brain Analysis",
            "POST",
            "analyses",
            200,
            data=analysis_data
        )
        
        if not success:
            self.log_test("Advisor Brain - Analysis Creation Failed", False, "Could not create analysis")
            return None
        
        analysis_id = response.get('id')
        
        # Verify response structure
        if 'id' in response:
            self.log_test("Advisor Brain - ID Field Present", True, f"ID: {response['id']}")
        else:
            self.log_test("Advisor Brain - ID Field Present", False, "Missing 'id' field")
        
        if 'analysis' in response:
            analysis_text = response['analysis']
            self.log_test("Advisor Brain - Analysis Field Present", True, f"Length: {len(analysis_text)} chars")
            
            # Debug: Print first 1000 chars of analysis
            print(f"\n🔍 DEBUG - Analysis text (first 1000 chars):\n{analysis_text[:1000]}\n")
        else:
            self.log_test("Advisor Brain - Analysis Field Present", False, "Missing 'analysis' field")
        
        if 'insights' in response:
            insights = response['insights']
            if isinstance(insights, list):
                self.log_test("Advisor Brain - Insights Array Present", True, f"Count: {len(insights)}")
                
                # Debug: Print insights for inspection
                print(f"\n🔍 DEBUG - Insights received: {json.dumps(insights, indent=2)[:500]}")
                
                # Verify insights structure
                if len(insights) > 0:
                    first_insight = insights[0]
                    required_fields = ['title', 'reason', 'actions', 'why', 'confidence', 'citations']
                    missing_fields = []
                    
                    for field in required_fields:
                        if field not in first_insight:
                            missing_fields.append(field)
                    
                    if not missing_fields:
                        self.log_test("Advisor Brain - Insight Structure Complete", True, "All required fields present")
                        
                        # Verify field types
                        if isinstance(first_insight.get('actions'), list):
                            self.log_test("Advisor Brain - Actions is Array", True, f"Actions count: {len(first_insight['actions'])}")
                        else:
                            self.log_test("Advisor Brain - Actions is Array", False, f"Actions type: {type(first_insight.get('actions'))}")
                        
                        if isinstance(first_insight.get('citations'), list):
                            self.log_test("Advisor Brain - Citations is Array", True, f"Citations count: {len(first_insight['citations'])}")
                        else:
                            self.log_test("Advisor Brain - Citations is Array", False, f"Citations type: {type(first_insight.get('citations'))}")
                        
                        # Check confidence value
                        confidence = first_insight.get('confidence')
                        if confidence and str(confidence).lower() in ['high', 'medium', 'low']:
                            self.log_test("Advisor Brain - Valid Confidence Level", True, f"Confidence: {confidence}")
                        else:
                            self.log_test("Advisor Brain - Valid Confidence Level", False, f"Invalid or missing confidence: {confidence}")
                    else:
                        self.log_test("Advisor Brain - Insight Structure Complete", False, f"Missing fields: {missing_fields}")
                else:
                    self.log_test("Advisor Brain - Insights Not Empty", False, "Insights array is empty")
            else:
                self.log_test("Advisor Brain - Insights Array Present", False, f"Insights type: {type(insights)}")
        else:
            self.log_test("Advisor Brain - Insights Array Present", False, "Missing 'insights' field")
        
        if 'created_at' in response:
            self.log_test("Advisor Brain - Created At Present", True, "")
        else:
            self.log_test("Advisor Brain - Created At Present", False, "Missing 'created_at' field")
        
        # Check if business profile data was used for personalization
        if 'analysis' in response:
            analysis_text = response['analysis'].lower()
            profile_terms = ['tech consulting', 'consulting', 'professional services', 'clients', 'scale', 'scaling']
            found_terms = [term for term in profile_terms if term in analysis_text]
            
            if found_terms:
                self.log_test("Advisor Brain - Uses Business Context", True, f"Found terms: {', '.join(found_terms[:3])}")
            else:
                self.log_test("Advisor Brain - Uses Business Context", False, "No business-specific terms found in analysis")
        
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
        
        # Since there are already users in the database, new users won't be admin
        # This test verifies that the admin endpoint exists and properly rejects non-admin users
        
        # Create a regular user to test admin functionality on
        test_user_id = str(uuid.uuid4())[:8]
        test_user_data = {
            "name": "Test Target User",
            "email": f"target{test_user_id}@example.com",
            "password": "testpass123",
            "business_name": "Target Business",
            "industry": "Technology"
        }
        
        success, response = self.run_test(
            "Create Target User for Admin Test",
            "POST",
            "auth/register",
            200,
            data=test_user_data
        )
        
        if not success:
            self.log_test("Admin Subscription Test", False, "Could not create target user")
            return False
        
        target_user_id = response['user']['id']
        
        # Test admin endpoint with non-admin user (should fail with 403)
        subscription_data = {
            "subscription_tier": "professional"
        }
        
        success, response = self.run_test(
            "Admin Endpoint Access Control",
            "PUT",
            f"admin/users/{target_user_id}/subscription",
            403,  # Expect 403 for non-admin user
            data=subscription_data
        )
        
        if success:
            self.log_test("Admin - Access Control Working", True, "Non-admin user properly rejected")
        else:
            self.log_test("Admin - Access Control Working", False, "Admin endpoint security issue")
        
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
        
        # Test admin stats (should fail with 403 for non-admin user)
        success1, response1 = self.run_test("Admin Stats Access Control", "GET", "admin/stats", 403)
        
        # Test get users (should fail with 403 for non-admin user)
        success2, response2 = self.run_test("Admin Users Access Control", "GET", "admin/users", 403)
        
        if success1 and success2:
            self.log_test("Admin Endpoints - Access Control Working", True, "Non-admin users properly rejected")
        else:
            self.log_test("Admin Endpoints - Access Control Working", False, "Admin endpoint security issue")
        
        return success1 and success2

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

    def test_supabase_auth_endpoints(self):
        """Test Supabase authentication endpoints"""
        print("\n🔍 Testing Supabase Auth Endpoints...")
        
        # Test /api/auth/supabase/me endpoint
        success, response = self.run_test(
            "Supabase Auth Me",
            "GET",
            "auth/supabase/me",
            200
        )
        
        if success:
            # Verify response structure
            if 'user' in response:
                self.log_test("Supabase Auth Me - User Field Present", True, "")
                user = response['user']
                
                # Verify user has required fields
                required_fields = ['id', 'email']
                missing = [f for f in required_fields if f not in user]
                if not missing:
                    self.log_test("Supabase Auth Me - Required Fields", True, "")
                else:
                    self.log_test("Supabase Auth Me - Required Fields", False, f"Missing: {missing}")
            else:
                self.log_test("Supabase Auth Me - User Field Present", False, "Missing 'user' field")
        
        # Test /api/auth/check-profile endpoint
        success, response = self.run_test(
            "Check Profile Endpoint",
            "GET",
            "auth/check-profile",
            200
        )
        
        if success:
            # Verify response structure
            expected_fields = ['profile_exists', 'needs_onboarding', 'user']
            missing = [f for f in expected_fields if f not in response]
            if not missing:
                self.log_test("Check Profile - Response Structure", True, "")
            else:
                self.log_test("Check Profile - Response Structure", False, f"Missing: {missing}")
        
        return success
    
    def test_outlook_integration_supabase(self):
        """Test Outlook integration with Supabase storage"""
        print("\n🔍 Testing Outlook Integration (Supabase)...")
        
        # Test /api/outlook/status endpoint
        success, response = self.run_test(
            "Outlook Status Endpoint",
            "GET",
            "outlook/status",
            200
        )
        
        if success:
            # Verify response structure
            expected_fields = ['connected', 'emails_synced']
            missing = [f for f in expected_fields if f not in response]
            if not missing:
                self.log_test("Outlook Status - Response Structure", True, "")
                
                # Log connection status
                connected = response.get('connected', False)
                emails_count = response.get('emails_synced', 0)
                self.log_test("Outlook Status - Connection Info", True, 
                             f"Connected: {connected}, Emails: {emails_count}")
                
                # If connected, test email sync
                if connected:
                    self.test_outlook_email_sync()
                else:
                    self.log_test("Outlook Email Sync", True, "Skipped - Outlook not connected")
            else:
                self.log_test("Outlook Status - Response Structure", False, f"Missing: {missing}")
        
        return success
    
    def test_outlook_email_sync(self):
        """Test Outlook email sync endpoint (only if Outlook connected)"""
        print("\n🔍 Testing Outlook Email Sync...")
        
        # Test email sync with small batch
        success, response = self.run_test(
            "Outlook Email Sync",
            "GET",
            "outlook/emails/sync?folder=inbox&top=5",
            200
        )
        
        if success:
            # Verify response structure
            if 'status' in response and 'emails_synced' in response:
                self.log_test("Email Sync - Response Structure", True, "")
                
                synced_count = response.get('emails_synced', 0)
                self.log_test("Email Sync - Emails Synced", True, f"Synced: {synced_count} emails")
            else:
                self.log_test("Email Sync - Response Structure", False, "Missing required fields")
        
        return success
    
    def test_outlook_disconnect(self):
        """Test Outlook disconnect endpoint"""
        print("\n🔍 Testing Outlook Disconnect...")
        
        # First check if Outlook is connected
        success, status_response = self.run_test(
            "Check Outlook Status Before Disconnect",
            "GET",
            "outlook/status",
            200
        )
        
        if not success:
            self.log_test("Outlook Disconnect Test", False, "Could not check Outlook status")
            return False
        
        connected = status_response.get('connected', False)
        
        if not connected:
            self.log_test("Outlook Disconnect", True, "Skipped - Outlook not connected")
            return True
        
        # Test disconnect endpoint
        success, response = self.run_test(
            "Outlook Disconnect",
            "POST",
            "outlook/disconnect",
            200
        )
        
        if success:
            # Verify response structure
            expected_fields = ['success', 'message', 'deleted_emails', 'deleted_jobs']
            missing = [f for f in expected_fields if f not in response]
            if not missing:
                self.log_test("Outlook Disconnect - Response Structure", True, "")
                
                deleted_emails = response.get('deleted_emails', 0)
                deleted_jobs = response.get('deleted_jobs', 0)
                self.log_test("Outlook Disconnect - Data Cleanup", True, 
                             f"Deleted {deleted_emails} emails, {deleted_jobs} jobs")
            else:
                self.log_test("Outlook Disconnect - Response Structure", False, f"Missing: {missing}")
        
        return success
    
    def test_cognitive_core_supabase(self):
        """Test Cognitive Core migration to Supabase - CRITICAL"""
        print("\n🔍 Testing Cognitive Core (Supabase Migration)...")
        
        # Test 1: Business profile update should trigger cognitive_core.observe()
        profile_data = {
            "business_name": "Test Cognitive Business",
            "industry": "M",  # Professional Services
            "business_type": "Company (Pty Ltd)",
            "target_country": "Australia",
            "main_challenges": "Testing cognitive core integration"
        }
        
        success, response = self.run_test(
            "Cognitive Core - Business Profile Update",
            "PUT",
            "business-profile",
            200,
            data=profile_data
        )
        
        if success:
            self.log_test("Cognitive Core - Profile Update No Errors", True, "Business profile updated successfully")
        else:
            self.log_test("Cognitive Core - Profile Update No Errors", False, "Business profile update failed")
        
        # Test 2: Chat endpoint (uses cognitive core)
        chat_data = {
            "message": "What should I focus on for my business?",
            "context_type": "advisor"
        }
        
        success, response = self.run_test(
            "Cognitive Core - Chat with Advisor Context",
            "POST",
            "chat",
            200,
            data=chat_data
        )
        
        if success:
            if 'response' in response and 'session_id' in response:
                self.log_test("Cognitive Core - Chat Response Structure", True, "Chat returned valid response")
            else:
                self.log_test("Cognitive Core - Chat Response Structure", False, f"Missing fields in response: {response.keys()}")
        
        # Test 3: Analysis endpoint (uses cognitive core for personalization)
        analysis_data = {
            "title": "Cognitive Core Test Analysis",
            "analysis_type": "business_analysis",
            "business_context": "Testing cognitive core integration with analysis"
        }
        
        success, response = self.run_test(
            "Cognitive Core - Analysis Creation",
            "POST",
            "analyses",
            200,
            data=analysis_data
        )
        
        if success:
            if 'id' in response and 'analysis' in response:
                self.log_test("Cognitive Core - Analysis No FK Errors", True, "Analysis created successfully")
            else:
                self.log_test("Cognitive Core - Analysis No FK Errors", False, "Analysis response incomplete")
        
        return success
    
    def test_document_creation_supabase(self):
        """Test document creation with Supabase (was failing before)"""
        print("\n🔍 Testing Document Creation (Supabase)...")
        
        doc_data = {
            "title": "Supabase Migration Test Document",
            "document_type": "SOP",
            "content": "# Test Document\n\nTesting document creation after Supabase migration.",
            "tags": ["test", "supabase", "migration"]
        }
        
        success, response = self.run_test(
            "Document Creation - No FK Errors",
            "POST",
            "documents",
            200,
            data=doc_data
        )
        
        if success:
            if 'id' in response and 'user_id' in response:
                self.log_test("Document Creation - Response Structure", True, f"Document ID: {response.get('id')}")
                return response.get('id')
            else:
                self.log_test("Document Creation - Response Structure", False, "Missing required fields")
                return None
        
        return None
    
    def test_chat_history_supabase(self):
        """Test chat history (needed context_type column)"""
        print("\n🔍 Testing Chat History (Supabase)...")
        
        # First create a chat message
        chat_data = {
            "message": "Test message for chat history",
            "context_type": "general"
        }
        
        success, response = self.run_test(
            "Chat History - Create Message",
            "POST",
            "chat",
            200,
            data=chat_data
        )
        
        if not success:
            self.log_test("Chat History - Setup Failed", False, "Could not create chat message")
            return False
        
        # Now retrieve chat history
        success, response = self.run_test(
            "Chat History - Retrieve History",
            "GET",
            "chat/history",
            200
        )
        
        if success:
            if isinstance(response, list):
                self.log_test("Chat History - No Schema Errors", True, f"Retrieved {len(response)} messages")
            else:
                self.log_test("Chat History - No Schema Errors", False, f"Unexpected response type: {type(response)}")
        
        return success
    
    def test_email_intelligence_supabase(self):
        """Test email intelligence retrieval"""
        print("\n🔍 Testing Email Intelligence (Supabase)...")
        
        success, response = self.run_test(
            "Email Intelligence - Retrieve",
            "GET",
            "intelligence/emails",
            200
        )
        
        if success:
            # Response should be a dict with intelligence data or empty state
            if isinstance(response, dict):
                self.log_test("Email Intelligence - Response Structure", True, "Valid response structure")
            else:
                self.log_test("Email Intelligence - Response Structure", False, f"Unexpected type: {type(response)}")
        
        return success
    
    def test_calendar_intelligence_supabase(self):
        """Test calendar intelligence retrieval"""
        print("\n🔍 Testing Calendar Intelligence (Supabase)...")
        
        success, response = self.run_test(
            "Calendar Intelligence - Retrieve",
            "GET",
            "intelligence/calendar",
            200
        )
        
        if success:
            if isinstance(response, dict):
                self.log_test("Calendar Intelligence - Response Structure", True, "Valid response structure")
            else:
                self.log_test("Calendar Intelligence - Response Structure", False, f"Unexpected type: {type(response)}")
        
        return success
    
    def test_priority_analysis_supabase(self):
        """Test priority analysis"""
        print("\n🔍 Testing Priority Analysis (Supabase)...")
        
        success, response = self.run_test(
            "Priority Analysis - Retrieve",
            "GET",
            "intelligence/priority",
            200
        )
        
        if success:
            if isinstance(response, dict):
                self.log_test("Priority Analysis - Response Structure", True, "Valid response structure")
            else:
                self.log_test("Priority Analysis - Response Structure", False, f"Unexpected type: {type(response)}")
        
        return success
    
    def test_complete_regression(self):
        """Test all critical endpoints for 500 errors"""
        print("\n🔍 Running Complete Regression Test...")
        
        critical_endpoints = [
            ("GET", "health", 200),
            ("GET", "auth/me", 200),
            ("GET", "business-profile", 200),
            ("GET", "documents", 200),
            ("GET", "analyses", 200),
            ("GET", "chat/history", 200),
            ("GET", "chat/sessions", 200),
            ("GET", "dashboard/stats", 200),
            ("GET", "outlook/status", 200),
            ("GET", "intelligence/emails", 200),
            ("GET", "intelligence/calendar", 200),
            ("GET", "intelligence/priority", 200)
        ]
        
        all_passed = True
        for method, endpoint, expected_status in critical_endpoints:
            success, response = self.run_test(
                f"Regression - {method} /{endpoint}",
                method,
                endpoint,
                expected_status
            )
            if not success:
                all_passed = False
        
        if all_passed:
            self.log_test("Complete Regression - No 500 Errors", True, "All critical endpoints working")
        else:
            self.log_test("Complete Regression - No 500 Errors", False, "Some endpoints returned errors")
        
        return all_passed
    
    def test_hubspot_crm_data_fetching(self):
        """
        Test HubSpot CRM data fetching via Merge.dev Unified API
        Tests all 4 CRM endpoints: contacts, companies, deals, owners
        """
        print("\n🔍 Testing HubSpot CRM Data Fetching via Merge.dev...")
        
        # Test 1: GET /api/integrations/crm/contacts (default page_size=100)
        success1, response1 = self.run_test(
            "CRM Contacts - Default Page Size",
            "GET",
            "integrations/crm/contacts",
            200
        )
        
        if success1:
            # Verify response structure
            if 'results' in response1:
                results = response1['results']
                self.log_test("CRM Contacts - Results Array Present", True, f"Count: {len(results)}")
                
                # Verify pagination fields
                if 'next' in response1:
                    self.log_test("CRM Contacts - Pagination Fields Present", True, f"next: {response1.get('next')}")
                else:
                    self.log_test("CRM Contacts - Pagination Fields Present", False, "Missing 'next' field")
                
                # Verify actual data (check first contact if exists)
                if len(results) > 0:
                    first_contact = results[0]
                    self.log_test("CRM Contacts - Contains Data", True, f"First contact ID: {first_contact.get('id', 'N/A')}")
                    
                    # Log sample data for verification
                    print(f"\n📊 Sample Contact Data:")
                    print(f"   ID: {first_contact.get('id')}")
                    print(f"   First Name: {first_contact.get('first_name')}")
                    print(f"   Last Name: {first_contact.get('last_name')}")
                    print(f"   Email: {first_contact.get('email_addresses', [{}])[0] if first_contact.get('email_addresses') else 'N/A'}")
                else:
                    self.log_test("CRM Contacts - Contains Data", False, "No contacts returned (empty results)")
            else:
                self.log_test("CRM Contacts - Results Array Present", False, "Missing 'results' field")
        
        # Test 2: GET /api/integrations/crm/contacts?page_size=10
        success2, response2 = self.run_test(
            "CRM Contacts - Custom Page Size (10)",
            "GET",
            "integrations/crm/contacts?page_size=10",
            200
        )
        
        if success2:
            results = response2.get('results', [])
            if len(results) <= 10:
                self.log_test("CRM Contacts - Page Size Respected", True, f"Returned {len(results)} records")
            else:
                self.log_test("CRM Contacts - Page Size Respected", False, f"Expected ≤10, got {len(results)}")
        
        # Test 3: GET /api/integrations/crm/companies
        success3, response3 = self.run_test(
            "CRM Companies - Fetch Data",
            "GET",
            "integrations/crm/companies",
            200
        )
        
        if success3:
            if 'results' in response3:
                results = response3['results']
                self.log_test("CRM Companies - Results Array Present", True, f"Count: {len(results)}")
                
                if len(results) > 0:
                    first_company = results[0]
                    self.log_test("CRM Companies - Contains Data", True, f"First company ID: {first_company.get('id', 'N/A')}")
                    
                    print(f"\n🏢 Sample Company Data:")
                    print(f"   ID: {first_company.get('id')}")
                    print(f"   Name: {first_company.get('name')}")
                else:
                    self.log_test("CRM Companies - Contains Data", False, "No companies returned")
            else:
                self.log_test("CRM Companies - Results Array Present", False, "Missing 'results' field")
        
        # Test 4: GET /api/integrations/crm/deals
        success4, response4 = self.run_test(
            "CRM Deals - Fetch Data",
            "GET",
            "integrations/crm/deals",
            200
        )
        
        if success4:
            if 'results' in response4:
                results = response4['results']
                self.log_test("CRM Deals - Results Array Present", True, f"Count: {len(results)}")
                
                if len(results) > 0:
                    first_deal = results[0]
                    self.log_test("CRM Deals - Contains Data", True, f"First deal ID: {first_deal.get('id', 'N/A')}")
                    
                    print(f"\n💼 Sample Deal Data:")
                    print(f"   ID: {first_deal.get('id')}")
                    print(f"   Name: {first_deal.get('name')}")
                    print(f"   Amount: {first_deal.get('amount')}")
                else:
                    self.log_test("CRM Deals - Contains Data", False, "No deals returned")
            else:
                self.log_test("CRM Deals - Results Array Present", False, "Missing 'results' field")
        
        # Test 5: GET /api/integrations/crm/owners
        success5, response5 = self.run_test(
            "CRM Owners - Fetch Data",
            "GET",
            "integrations/crm/owners",
            200
        )
        
        if success5:
            if 'results' in response5:
                results = response5['results']
                self.log_test("CRM Owners - Results Array Present", True, f"Count: {len(results)}")
                
                if len(results) > 0:
                    first_owner = results[0]
                    self.log_test("CRM Owners - Contains Data", True, f"First owner ID: {first_owner.get('id', 'N/A')}")
                    
                    print(f"\n👥 Sample Owner Data:")
                    print(f"   ID: {first_owner.get('id')}")
                    print(f"   Name: {first_owner.get('name')}")
                    print(f"   Email: {first_owner.get('email')}")
                else:
                    self.log_test("CRM Owners - Contains Data", False, "No owners returned")
            else:
                self.log_test("CRM Owners - Results Array Present", False, "Missing 'results' field")
        
        # Test 6: Error scenario - Invalid auth token
        print("\n🔍 Testing Error Scenarios...")
        
        # Save current token
        original_token = self.token
        
        # Set invalid token
        self.token = "invalid_token_12345"
        
        success6, response6 = self.run_test(
            "CRM Contacts - Invalid Auth Token",
            "GET",
            "integrations/crm/contacts",
            401  # Expect 401 Unauthorized
        )
        
        if success6:
            self.log_test("CRM - Invalid Token Handling", True, "Correctly returned 401 for invalid token")
        else:
            self.log_test("CRM - Invalid Token Handling", False, "Did not return 401 for invalid token")
        
        # Restore original token
        self.token = original_token
        
        # Summary
        all_endpoints_passed = success1 and success3 and success4 and success5
        
        if all_endpoints_passed:
            self.log_test("HubSpot CRM Integration - All Endpoints Working", True, "All 4 CRM endpoints returned 200 OK with data")
        else:
            failed = []
            if not success1: failed.append("contacts")
            if not success3: failed.append("companies")
            if not success4: failed.append("deals")
            if not success5: failed.append("owners")
            self.log_test("HubSpot CRM Integration - All Endpoints Working", False, f"Failed endpoints: {', '.join(failed)}")
        
        return all_endpoints_passed
    
    def run_hubspot_crm_tests(self):
        """Run HubSpot CRM data fetching tests"""
        print("🚀 Starting HubSpot CRM Data Fetching Tests via Merge.dev...")
        print(f"Base URL: {self.base_url}")
        print(f"Test User: andre@thestrategysquad.com.au")
        print("\n" + "="*80)
        print("TESTING SCOPE: HubSpot CRM Data via Merge.dev Unified API")
        print("="*80)
        
        # Health check
        self.test_health_check()
        
        # Authentication - Try to login as andre@thestrategysquad.com.au
        print("\n📋 PHASE 1: Authentication")
        print("Attempting to login as andre@thestrategysquad.com.au...")
        
        # Try Supabase login first
        login_data = {
            "email": "andre@thestrategysquad.com.au",
            "password": "testpass123456"  # This will likely fail, but we'll try
        }
        
        success, response = self.run_test(
            "Login as andre@thestrategysquad.com.au (Supabase)",
            "POST",
            "auth/supabase/login",
            200,
            data=login_data
        )
        
        if success:
            session = response.get('session', {})
            if session and session.get('access_token'):
                self.token = session['access_token']
                user_info = response.get('user', {})
                self.user_id = user_info.get('id')
                print(f"✅ Successfully logged in as {user_info.get('email')}")
            else:
                print("❌ Login failed - no access token in response")
                print("⚠️  Cannot proceed with CRM tests without authentication")
                return self.generate_report()
        else:
            print("❌ Login failed - user may not exist or password incorrect")
            print("⚠️  Cannot proceed with CRM tests without authentication")
            print("\n💡 MANUAL TESTING REQUIRED:")
            print("   1. User andre@thestrategysquad.com.au must log in via UI")
            print("   2. Navigate to /integrations page")
            print("   3. Test CRM endpoints manually via browser console:")
            print("      fetch('https://biqc-advisor.preview.emergentagent.com/api/integrations/crm/contacts', {")
            print("        headers: {'Authorization': 'Bearer ' + localStorage.getItem('supabase.auth.token')}")
            print("      }).then(r => r.json()).then(console.log)")
            return self.generate_report()
        
        # Test auth/me to verify token works
        self.test_auth_me()
        
        # CRITICAL: HubSpot CRM Data Fetching Tests
        print("\n📋 PHASE 2: HubSpot CRM Data Fetching (CRITICAL)")
        self.test_hubspot_crm_data_fetching()
        
        return self.generate_report()
    
    def run_supabase_migration_tests(self):
        """Run comprehensive Supabase migration tests"""
        print("🚀 Starting FINAL SUPABASE MIGRATION VALIDATION...")
        print(f"Base URL: {self.base_url}")
        print("\n" + "="*80)
        print("TESTING SCOPE: Complete Supabase Migration")
        print("="*80)
        
        # Health checks
        self.test_health_check()
        
        # Authentication flow (MongoDB - for getting token)
        print("\n📋 PHASE 1: Authentication & User Management")
        if not self.test_user_registration():
            if not self.test_user_login():
                print("❌ Authentication failed, stopping tests")
                return self.generate_report()
        
        self.test_auth_me()
        
        # Test Supabase auth endpoints
        self.test_supabase_auth_endpoints()
        
        # CRITICAL: Cognitive Core Testing
        print("\n📋 PHASE 2: Cognitive Core (CRITICAL - Just Migrated)")
        self.test_cognitive_core_supabase()
        
        # Document System
        print("\n📋 PHASE 3: Documents System")
        doc_id = self.test_document_creation_supabase()
        if doc_id:
            # Test document retrieval
            self.run_test("Document Retrieval", "GET", f"documents/{doc_id}", 200)
        
        # Chat History
        print("\n📋 PHASE 4: Chat History (context_type column)")
        self.test_chat_history_supabase()
        
        # Outlook Integration
        print("\n📋 PHASE 5: Outlook Integration")
        self.test_outlook_integration_supabase()
        
        # Intelligence Collections
        print("\n📋 PHASE 6: Intelligence Collections")
        self.test_email_intelligence_supabase()
        self.test_calendar_intelligence_supabase()
        self.test_priority_analysis_supabase()
        
        # Complete Regression Test
        print("\n📋 PHASE 7: Complete Regression Test")
        self.test_complete_regression()
        
        return self.generate_report()
    
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
    
    def run_advisor_brain_test(self):
        """Run only Advisor Brain analysis test"""
        print("🚀 Starting Advisor Brain Analysis Test...")
        print(f"Base URL: {self.base_url}")
        
        # Health check
        self.test_health_check()
        
        # Authentication flow
        if not self.test_user_registration():
            if not self.test_user_login():
                print("❌ Authentication failed, stopping tests")
                return self.generate_report()
        
        self.test_auth_me()
        
        # Test Advisor Brain Analysis
        analysis_id = self.test_advisor_brain_analysis()
        
        # Cleanup
        if analysis_id:
            self.test_cleanup(analysis_id=analysis_id)
        
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
    
    # Check if we should run specific test suites
    if len(sys.argv) > 1:
        if sys.argv[1] == "--advisor-brain":
            report = tester.run_advisor_brain_test()
        elif sys.argv[1] == "--supabase":
            report = tester.run_supabase_migration_tests()
        elif sys.argv[1] == "--hubspot-crm":
            report = tester.run_hubspot_crm_tests()
        else:
            report = tester.run_all_tests()
    else:
        report = tester.run_all_tests()
    
    # Save report
    with open('/app/test_reports/backend_api_test_results.json', 'w') as f:
        json.dump(report, f, indent=2)
    
    print(f"\n📄 Report saved to: /app/test_reports/backend_api_test_results.json")
    
    return 0 if report['failed_tests'] == 0 else 1

if __name__ == "__main__":
    sys.exit(main())