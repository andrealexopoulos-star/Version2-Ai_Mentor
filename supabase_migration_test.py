#!/usr/bin/env python3
"""
FINAL COMPREHENSIVE SUPABASE MIGRATION VALIDATION TEST
Tests all critical areas mentioned in the review request
"""

import requests
import json
import uuid
from datetime import datetime

BASE_URL = "https://auth-revival-11.preview.emergentagent.com/api"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

class SupabaseMigrationTester:
    def __init__(self):
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.critical_failures = []
        self.warnings = []
        
    def log_test(self, name, success, details="", critical=False):
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"{Colors.GREEN}✅ PASS{Colors.END} - {name}")
        else:
            print(f"{Colors.RED}❌ FAIL{Colors.END} - {name}")
            if details:
                print(f"   {Colors.YELLOW}Details: {details}{Colors.END}")
            if critical:
                self.critical_failures.append(f"{name}: {details}")
    
    def log_warning(self, message):
        self.warnings.append(message)
        print(f"{Colors.YELLOW}⚠️  WARNING: {message}{Colors.END}")
    
    def log_info(self, message):
        print(f"{Colors.BLUE}ℹ️  {message}{Colors.END}")
    
    def test_health(self):
        """Test health endpoint"""
        print(f"\n{Colors.BLUE}{'='*80}{Colors.END}")
        print(f"{Colors.BLUE}PHASE 0: Health Check{Colors.END}")
        print(f"{Colors.BLUE}{'='*80}{Colors.END}")
        
        try:
            response = requests.get(f"{BASE_URL}/health", timeout=10)
            success = response.status_code == 200
            self.log_test("Health Check", success, f"Status: {response.status_code}")
            return success
        except Exception as e:
            self.log_test("Health Check", False, str(e), critical=True)
            return False
    
    def test_supabase_auth(self):
        """Test Supabase authentication"""
        print(f"\n{Colors.BLUE}{'='*80}{Colors.END}")
        print(f"{Colors.BLUE}PHASE 1: Supabase Authentication{Colors.END}")
        print(f"{Colors.BLUE}{'='*80}{Colors.END}")
        
        # Create unique user
        unique_id = str(uuid.uuid4())[:8]
        user_data = {
            "email": f"supatest{unique_id}@testdomain.com",
            "password": "TestPass123!",
            "full_name": "Supabase Test User",
            "company_name": "Test Company",
            "industry": "Technology"
        }
        
        self.log_info(f"Creating user: {user_data['email']}")
        
        try:
            # Test signup
            response = requests.post(
                f"{BASE_URL}/auth/supabase/signup",
                json=user_data,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                session = data.get('session', {})
                user = data.get('user', {})
                
                if session and session.get('access_token'):
                    self.token = session['access_token']
                    self.user_id = user.get('id')
                    self.log_test("Supabase Signup", True, f"User ID: {self.user_id}")
                    
                    # Test /auth/supabase/me
                    headers = {'Authorization': f'Bearer {self.token}'}
                    me_response = requests.get(f"{BASE_URL}/auth/supabase/me", headers=headers, timeout=10)
                    
                    if me_response.status_code == 200:
                        me_data = me_response.json()
                        if 'user' in me_data and me_data['user'].get('id'):
                            self.log_test("Supabase Auth Me", True, f"Email: {me_data['user'].get('email')}")
                        else:
                            self.log_test("Supabase Auth Me", False, "Missing user data", critical=True)
                    else:
                        self.log_test("Supabase Auth Me", False, f"Status: {me_response.status_code}", critical=True)
                    
                    # Test /auth/check-profile
                    profile_response = requests.get(f"{BASE_URL}/auth/check-profile", headers=headers, timeout=10)
                    if profile_response.status_code == 200:
                        profile_data = profile_response.json()
                        required_fields = ['profile_exists', 'needs_onboarding', 'user']
                        missing = [f for f in required_fields if f not in profile_data]
                        if not missing:
                            self.log_test("Check Profile Endpoint", True, "")
                        else:
                            self.log_test("Check Profile Endpoint", False, f"Missing fields: {missing}")
                    else:
                        self.log_test("Check Profile Endpoint", False, f"Status: {profile_response.status_code}")
                    
                    return True
                else:
                    self.log_test("Supabase Signup", False, "No access_token in response", critical=True)
                    return False
            else:
                self.log_test("Supabase Signup", False, f"Status: {response.status_code}, Response: {response.text[:200]}", critical=True)
                return False
                
        except Exception as e:
            self.log_test("Supabase Signup", False, str(e), critical=True)
            return False
    
    def test_cognitive_core(self):
        """Test Cognitive Core - CRITICAL"""
        print(f"\n{Colors.BLUE}{'='*80}{Colors.END}")
        print(f"{Colors.BLUE}PHASE 2: Cognitive Core (CRITICAL){Colors.END}")
        print(f"{Colors.BLUE}{'='*80}{Colors.END}")
        
        if not self.token:
            self.log_test("Cognitive Core Tests", False, "No auth token available", critical=True)
            return False
        
        headers = {'Authorization': f'Bearer {self.token}', 'Content-Type': 'application/json'}
        
        # Test 1: Business profile update (triggers cognitive_core.observe())
        self.log_info("Testing business profile update (triggers cognitive_core.observe())...")
        profile_data = {
            "business_name": "Cognitive Test Business",
            "industry": "M",
            "business_type": "Company (Pty Ltd)",
            "target_country": "Australia",
            "main_challenges": "Testing cognitive core integration"
        }
        
        try:
            response = requests.put(
                f"{BASE_URL}/business-profile",
                json=profile_data,
                headers=headers,
                timeout=30
            )
            
            if response.status_code == 200:
                self.log_test("Cognitive Core - Profile Update (observe)", True, "No foreign key errors")
            else:
                error_msg = f"Status: {response.status_code}"
                try:
                    error_data = response.json()
                    error_msg += f", Error: {error_data}"
                except:
                    error_msg += f", Response: {response.text[:200]}"
                self.log_test("Cognitive Core - Profile Update (observe)", False, error_msg, critical=True)
        except Exception as e:
            self.log_test("Cognitive Core - Profile Update (observe)", False, str(e), critical=True)
        
        # Test 2: Chat endpoint (uses cognitive_core.get_context_for_agent())
        self.log_info("Testing chat endpoint (uses cognitive_core.get_context_for_agent())...")
        chat_data = {
            "message": "What should I focus on for my business?",
            "context_type": "advisor"
        }
        
        try:
            response = requests.post(
                f"{BASE_URL}/chat",
                json=chat_data,
                headers=headers,
                timeout=60
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'response' in data and 'session_id' in data:
                    self.log_test("Cognitive Core - Chat (get_context_for_agent)", True, "Chat response received")
                else:
                    self.log_test("Cognitive Core - Chat (get_context_for_agent)", False, f"Missing fields: {data.keys()}", critical=True)
            else:
                error_msg = f"Status: {response.status_code}"
                try:
                    error_data = response.json()
                    error_msg += f", Error: {error_data}"
                except:
                    error_msg += f", Response: {response.text[:200]}"
                self.log_test("Cognitive Core - Chat (get_context_for_agent)", False, error_msg, critical=True)
        except Exception as e:
            self.log_test("Cognitive Core - Chat (get_context_for_agent)", False, str(e), critical=True)
        
        # Test 3: Analysis endpoint (uses cognitive core for personalization)
        self.log_info("Testing analysis creation (uses cognitive core)...")
        analysis_data = {
            "title": "Cognitive Core Test Analysis",
            "analysis_type": "business_analysis",
            "business_context": "Testing cognitive core integration with analysis"
        }
        
        try:
            response = requests.post(
                f"{BASE_URL}/analyses",
                json=analysis_data,
                headers=headers,
                timeout=60
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'id' in data and 'analysis' in data:
                    self.log_test("Cognitive Core - Analysis Creation", True, "No foreign key errors")
                else:
                    self.log_test("Cognitive Core - Analysis Creation", False, f"Missing fields: {data.keys()}", critical=True)
            else:
                error_msg = f"Status: {response.status_code}"
                try:
                    error_data = response.json()
                    error_msg += f", Error: {error_data}"
                except:
                    error_msg += f", Response: {response.text[:200]}"
                self.log_test("Cognitive Core - Analysis Creation", False, error_msg, critical=True)
        except Exception as e:
            self.log_test("Cognitive Core - Analysis Creation", False, str(e), critical=True)
    
    def test_documents_intelligence(self):
        """Test Documents & Intelligence"""
        print(f"\n{Colors.BLUE}{'='*80}{Colors.END}")
        print(f"{Colors.BLUE}PHASE 3: Documents & Intelligence{Colors.END}")
        print(f"{Colors.BLUE}{'='*80}{Colors.END}")
        
        if not self.token:
            self.log_test("Documents Tests", False, "No auth token available", critical=True)
            return False
        
        headers = {'Authorization': f'Bearer {self.token}', 'Content-Type': 'application/json'}
        
        # Test 1: Document creation (was failing before)
        self.log_info("Testing document creation (was failing with FK errors)...")
        doc_data = {
            "title": "Supabase Migration Test Document",
            "document_type": "SOP",
            "content": "# Test Document\n\nTesting document creation after Supabase migration.",
            "tags": ["test", "supabase"]
        }
        
        try:
            response = requests.post(
                f"{BASE_URL}/documents",
                json=doc_data,
                headers=headers,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'id' in data and 'user_id' in data:
                    self.log_test("Document Creation", True, f"Document ID: {data.get('id')}")
                else:
                    self.log_test("Document Creation", False, "Missing required fields", critical=True)
            else:
                error_msg = f"Status: {response.status_code}"
                try:
                    error_data = response.json()
                    error_msg += f", Error: {error_data}"
                except:
                    error_msg += f", Response: {response.text[:200]}"
                self.log_test("Document Creation", False, error_msg, critical=True)
        except Exception as e:
            self.log_test("Document Creation", False, str(e), critical=True)
        
        # Test 2: Chat history (needed context_type column)
        self.log_info("Testing chat history retrieval (needed context_type column)...")
        try:
            response = requests.get(
                f"{BASE_URL}/chat/history",
                headers=headers,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_test("Chat History (context_type column)", True, f"Retrieved {len(data)} messages")
                else:
                    self.log_test("Chat History (context_type column)", False, f"Unexpected type: {type(data)}", critical=True)
            else:
                error_msg = f"Status: {response.status_code}"
                try:
                    error_data = response.json()
                    error_msg += f", Error: {error_data}"
                except:
                    error_msg += f", Response: {response.text[:200]}"
                self.log_test("Chat History (context_type column)", False, error_msg, critical=True)
        except Exception as e:
            self.log_test("Chat History (context_type column)", False, str(e), critical=True)
        
        # Test 3: Business profile retrieval (needed target_country column)
        self.log_info("Testing business profile retrieval (needed target_country column)...")
        try:
            response = requests.get(
                f"{BASE_URL}/business-profile",
                headers=headers,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'target_country' in data or data.get('target_country') is None:
                    self.log_test("Business Profile (target_country column)", True, "No schema cache errors")
                else:
                    self.log_test("Business Profile (target_country column)", False, "target_country field missing", critical=True)
            else:
                error_msg = f"Status: {response.status_code}"
                try:
                    error_data = response.json()
                    error_msg += f", Error: {error_data}"
                except:
                    error_msg += f", Response: {response.text[:200]}"
                self.log_test("Business Profile (target_country column)", False, error_msg, critical=True)
        except Exception as e:
            self.log_test("Business Profile (target_country column)", False, str(e), critical=True)
        
        # Test 4: Analysis retrieval (needed analysis_type column)
        self.log_info("Testing analysis retrieval (needed analysis_type column)...")
        try:
            response = requests.get(
                f"{BASE_URL}/analyses",
                headers=headers,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_test("Analysis Retrieval (analysis_type column)", True, f"Retrieved {len(data)} analyses")
                else:
                    self.log_test("Analysis Retrieval (analysis_type column)", False, f"Unexpected type: {type(data)}", critical=True)
            else:
                error_msg = f"Status: {response.status_code}"
                try:
                    error_data = response.json()
                    error_msg += f", Error: {error_data}"
                except:
                    error_msg += f", Response: {response.text[:200]}"
                self.log_test("Analysis Retrieval (analysis_type column)", False, error_msg, critical=True)
        except Exception as e:
            self.log_test("Analysis Retrieval (analysis_type column)", False, str(e), critical=True)
    
    def test_outlook_integration(self):
        """Test Outlook Integration"""
        print(f"\n{Colors.BLUE}{'='*80}{Colors.END}")
        print(f"{Colors.BLUE}PHASE 4: Outlook Integration{Colors.END}")
        print(f"{Colors.BLUE}{'='*80}{Colors.END}")
        
        if not self.token:
            self.log_test("Outlook Tests", False, "No auth token available")
            return False
        
        headers = {'Authorization': f'Bearer {self.token}'}
        
        # Test Outlook status
        self.log_info("Testing Outlook connection status...")
        try:
            response = requests.get(
                f"{BASE_URL}/outlook/status",
                headers=headers,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                expected_fields = ['connected', 'emails_synced']
                missing = [f for f in expected_fields if f not in data]
                if not missing:
                    connected = data.get('connected', False)
                    emails_count = data.get('emails_synced', 0)
                    self.log_test("Outlook Status Endpoint", True, f"Connected: {connected}, Emails: {emails_count}")
                    
                    if not connected:
                        self.log_info("Outlook not connected - skipping email/calendar sync tests")
                else:
                    self.log_test("Outlook Status Endpoint", False, f"Missing fields: {missing}")
            else:
                self.log_test("Outlook Status Endpoint", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Outlook Status Endpoint", False, str(e))
    
    def test_system_stability(self):
        """Test System Stability"""
        print(f"\n{Colors.BLUE}{'='*80}{Colors.END}")
        print(f"{Colors.BLUE}PHASE 5: System Stability{Colors.END}")
        print(f"{Colors.BLUE}{'='*80}{Colors.END}")
        
        if not self.token:
            self.log_test("System Stability Tests", False, "No auth token available")
            return False
        
        headers = {'Authorization': f'Bearer {self.token}'}
        
        # Test critical endpoints for 500 errors
        critical_endpoints = [
            ("GET", "health", 200),
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
        
        self.log_info("Testing all critical endpoints for 500 errors...")
        all_passed = True
        
        for method, endpoint, expected_status in critical_endpoints:
            try:
                if method == "GET":
                    response = requests.get(f"{BASE_URL}/{endpoint}", headers=headers, timeout=30)
                
                if response.status_code == expected_status:
                    self.log_test(f"Stability - {endpoint}", True, "")
                else:
                    self.log_test(f"Stability - {endpoint}", False, f"Status: {response.status_code}")
                    all_passed = False
            except Exception as e:
                self.log_test(f"Stability - {endpoint}", False, str(e))
                all_passed = False
        
        if all_passed:
            self.log_test("System Stability - No 500 Errors", True, "All endpoints working")
        else:
            self.log_test("System Stability - No 500 Errors", False, "Some endpoints returned errors")
    
    def check_backend_logs(self):
        """Check backend logs for errors"""
        print(f"\n{Colors.BLUE}{'='*80}{Colors.END}")
        print(f"{Colors.BLUE}PHASE 6: Backend Log Analysis{Colors.END}")
        print(f"{Colors.BLUE}{'='*80}{Colors.END}")
        
        self.log_info("Checking backend logs for errors...")
        
        import subprocess
        try:
            result = subprocess.run(
                ['tail', '-n', '50', '/var/log/supervisor/backend.err.log'],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            logs = result.stdout
            
            # Check for foreign key errors
            if 'foreign key constraint' in logs.lower():
                self.log_test("Backend Logs - No FK Errors", False, "Foreign key constraint violations found", critical=True)
                self.log_warning("Found foreign key constraint violations in logs")
            else:
                self.log_test("Backend Logs - No FK Errors", True, "")
            
            # Check for schema cache errors
            if 'schema cache' in logs.lower() or 'PGRST204' in logs:
                self.log_test("Backend Logs - No Schema Cache Errors", False, "Schema cache errors found", critical=True)
                self.log_warning("Found schema cache errors (PGRST204) in logs")
            else:
                self.log_test("Backend Logs - No Schema Cache Errors", True, "")
            
            # Check for 500 errors
            if '500' in logs:
                self.log_warning("Found 500 errors in logs")
            
        except Exception as e:
            self.log_test("Backend Log Analysis", False, str(e))
    
    def generate_report(self):
        """Generate final report"""
        print(f"\n{Colors.BLUE}{'='*80}{Colors.END}")
        print(f"{Colors.BLUE}FINAL REPORT{Colors.END}")
        print(f"{Colors.BLUE}{'='*80}{Colors.END}")
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        
        print(f"\n📊 Test Results: {self.tests_passed}/{self.tests_run} passed ({success_rate:.1f}%)")
        
        if self.critical_failures:
            print(f"\n{Colors.RED}🔴 CRITICAL FAILURES:{Colors.END}")
            for failure in self.critical_failures:
                print(f"   {Colors.RED}• {failure}{Colors.END}")
        
        if self.warnings:
            print(f"\n{Colors.YELLOW}⚠️  WARNINGS:{Colors.END}")
            for warning in self.warnings:
                print(f"   {Colors.YELLOW}• {warning}{Colors.END}")
        
        # Determine migration status
        if success_rate >= 85 and not self.critical_failures:
            print(f"\n{Colors.GREEN}✅ MIGRATION STATUS: COMPLETE (85%+ success rate){Colors.END}")
        elif success_rate >= 70:
            print(f"\n{Colors.YELLOW}⚠️  MIGRATION STATUS: PARTIAL (70-85% success rate){Colors.END}")
        else:
            print(f"\n{Colors.RED}❌ MIGRATION STATUS: INCOMPLETE (<70% success rate){Colors.END}")
        
        return {
            "success_rate": success_rate,
            "tests_run": self.tests_run,
            "tests_passed": self.tests_passed,
            "critical_failures": self.critical_failures,
            "warnings": self.warnings,
            "timestamp": datetime.now().isoformat()
        }

def main():
    tester = SupabaseMigrationTester()
    
    print(f"{Colors.BLUE}{'='*80}{Colors.END}")
    print(f"{Colors.BLUE}FINAL COMPREHENSIVE SUPABASE MIGRATION VALIDATION{Colors.END}")
    print(f"{Colors.BLUE}{'='*80}{Colors.END}")
    print(f"\nBase URL: {BASE_URL}")
    print(f"Timestamp: {datetime.now().isoformat()}\n")
    
    # Run all test phases
    tester.test_health()
    
    if tester.test_supabase_auth():
        tester.test_cognitive_core()
        tester.test_documents_intelligence()
        tester.test_outlook_integration()
        tester.test_system_stability()
    else:
        print(f"\n{Colors.RED}❌ Authentication failed - cannot proceed with remaining tests{Colors.END}")
    
    tester.check_backend_logs()
    
    # Generate final report
    report = tester.generate_report()
    
    # Save report
    with open('/tmp/supabase_migration_report.json', 'w') as f:
        json.dump(report, f, indent=2)
    
    print(f"\n📄 Report saved to: /tmp/supabase_migration_report.json")
    
    return 0 if report['success_rate'] >= 85 and not report['critical_failures'] else 1

if __name__ == "__main__":
    exit(main())
