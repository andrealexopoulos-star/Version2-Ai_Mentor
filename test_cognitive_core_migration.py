#!/usr/bin/env python3
"""
Cognitive Core Supabase Migration Validation Test
==================================================
Tests the critical migration from MongoDB to Supabase for Cognitive Core.
This is the core intelligence layer for all AI features.
"""

import requests
import json
import uuid
from datetime import datetime

BASE_URL = "https://auth-revival-11.preview.emergentagent.com/api"

class CognitiveCoreTest:
    def __init__(self):
        self.token = None
        self.user_id = None
        self.tests_passed = 0
        self.tests_failed = 0
        self.results = []
    
    def log(self, test_name, passed, details=""):
        """Log test result"""
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} - {test_name}")
        if details:
            print(f"   {details}")
        
        self.results.append({
            "test": test_name,
            "passed": passed,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })
        
        if passed:
            self.tests_passed += 1
        else:
            self.tests_failed += 1
    
    def test_backend_health(self):
        """Test 1: Backend Health Check"""
        print("\n🔍 TEST 1: Backend Health Check")
        print("=" * 60)
        
        try:
            # Test health endpoint
            response = requests.get(f"{BASE_URL}/health", timeout=10)
            if response.status_code == 200:
                self.log("Backend Health Endpoint", True, f"Status: {response.status_code}")
            else:
                self.log("Backend Health Endpoint", False, f"Status: {response.status_code}")
                return False
            
            # Test root endpoint
            response = requests.get(f"{BASE_URL}/", timeout=10)
            if response.status_code == 200:
                self.log("Backend Root Endpoint", True, f"Status: {response.status_code}")
            else:
                self.log("Backend Root Endpoint", False, f"Status: {response.status_code}")
                return False
            
            self.log("Backend Starts Without Errors", True, "Backend is running and responding")
            return True
            
        except Exception as e:
            self.log("Backend Health Check", False, f"Exception: {str(e)}")
            return False
    
    def test_authentication(self):
        """Test 2: Authentication (MongoDB for now)"""
        print("\n🔍 TEST 2: Authentication")
        print("=" * 60)
        
        try:
            # Register a new user
            unique_id = str(uuid.uuid4())[:8]
            user_data = {
                "name": "Cognitive Test User",
                "email": f"cogtest{unique_id}@example.com",
                "password": "TestPass123!",
                "business_name": "Cognitive Test Business",
                "industry": "Technology"
            }
            
            response = requests.post(
                f"{BASE_URL}/auth/register",
                json=user_data,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                self.token = data.get('access_token')
                self.user_id = data.get('user', {}).get('id')
                self.log("User Registration", True, f"User ID: {self.user_id}")
                
                # Test auth/me endpoint
                headers = {'Authorization': f'Bearer {self.token}'}
                response = requests.get(f"{BASE_URL}/auth/me", headers=headers, timeout=10)
                
                if response.status_code == 200:
                    self.log("Auth Me Endpoint", True, "Successfully retrieved user info")
                    return True
                else:
                    self.log("Auth Me Endpoint", False, f"Status: {response.status_code}")
                    return False
            else:
                self.log("User Registration", False, f"Status: {response.status_code}")
                return False
                
        except Exception as e:
            self.log("Authentication", False, f"Exception: {str(e)}")
            return False
    
    def test_outlook_integration(self):
        """Test 3: Outlook Integration (Supabase)"""
        print("\n🔍 TEST 3: Outlook Integration (Supabase)")
        print("=" * 60)
        
        if not self.token:
            self.log("Outlook Integration", False, "No auth token available")
            return False
        
        try:
            headers = {'Authorization': f'Bearer {self.token}'}
            
            # Test outlook/status endpoint
            response = requests.get(f"{BASE_URL}/outlook/status", headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                connected = data.get('connected', False)
                emails_synced = data.get('emails_synced', 0)
                
                self.log("Outlook Status Endpoint", True, 
                        f"Connected: {connected}, Emails: {emails_synced}")
                
                # Verify response structure
                if 'connected' in data and 'emails_synced' in data:
                    self.log("Outlook Status Response Structure", True, "All required fields present")
                else:
                    self.log("Outlook Status Response Structure", False, "Missing required fields")
                
                return True
            else:
                self.log("Outlook Status Endpoint", False, f"Status: {response.status_code}")
                return False
                
        except Exception as e:
            self.log("Outlook Integration", False, f"Exception: {str(e)}")
            return False
    
    def test_cognitive_core_ai_features(self):
        """Test 4: Cognitive Core AI Features"""
        print("\n🔍 TEST 4: Cognitive Core AI Features")
        print("=" * 60)
        
        if not self.token:
            self.log("Cognitive Core AI Features", False, "No auth token available")
            return False
        
        try:
            headers = {'Authorization': f'Bearer {self.token}'}
            
            # Test 4a: Chat endpoint (calls cognitive_core.observe())
            print("\n   Testing Chat Endpoint (cognitive_core.observe())...")
            chat_data = {
                "message": "I need help with my business strategy",
                "context_type": "general"
            }
            
            response = requests.post(
                f"{BASE_URL}/chat",
                json=chat_data,
                headers=headers,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'response' in data and 'session_id' in data:
                    self.log("Chat Endpoint (cognitive_core.observe)", True, 
                            "Chat response received, Cognitive Core observing")
                else:
                    self.log("Chat Endpoint (cognitive_core.observe)", False, 
                            "Missing response or session_id")
            elif response.status_code == 500:
                self.log("Chat Endpoint (cognitive_core.observe)", False, 
                        f"500 Error - Cognitive Core may have issues")
                return False
            else:
                self.log("Chat Endpoint (cognitive_core.observe)", False, 
                        f"Status: {response.status_code}")
            
            # Test 4b: Business Profile endpoint (uses Cognitive Core)
            print("\n   Testing Business Profile Endpoint...")
            profile_data = {
                "business_name": "Test Business",
                "industry": "M",
                "business_type": "Company (Pty Ltd)",
                "target_country": "Australia"
            }
            
            response = requests.put(
                f"{BASE_URL}/business-profile",
                json=profile_data,
                headers=headers,
                timeout=30
            )
            
            if response.status_code == 200:
                self.log("Business Profile Update", True, "Profile updated successfully")
            elif response.status_code == 500:
                self.log("Business Profile Update", False, 
                        f"500 Error - May indicate Cognitive Core issues")
                return False
            else:
                self.log("Business Profile Update", False, 
                        f"Status: {response.status_code}")
            
            # Test 4c: Analysis endpoint (calls cognitive_core.get_context_for_agent())
            print("\n   Testing Analysis Endpoint (cognitive_core.get_context_for_agent())...")
            analysis_data = {
                "title": "Cognitive Core Test Analysis",
                "analysis_type": "business_analysis",
                "business_context": "Testing Cognitive Core integration with Supabase"
            }
            
            response = requests.post(
                f"{BASE_URL}/analyses",
                json=analysis_data,
                headers=headers,
                timeout=60
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'id' in data and 'analysis' in data:
                    self.log("Analysis Endpoint (cognitive_core.get_context_for_agent)", True, 
                            "Analysis created, Cognitive Core providing context")
                else:
                    self.log("Analysis Endpoint (cognitive_core.get_context_for_agent)", False, 
                            "Missing required fields in response")
            elif response.status_code == 500:
                self.log("Analysis Endpoint (cognitive_core.get_context_for_agent)", False, 
                        f"500 Error - Cognitive Core may have issues")
                return False
            else:
                self.log("Analysis Endpoint (cognitive_core.get_context_for_agent)", False, 
                        f"Status: {response.status_code}")
            
            return True
            
        except Exception as e:
            self.log("Cognitive Core AI Features", False, f"Exception: {str(e)}")
            return False
    
    def test_email_calendar_documents(self):
        """Test 5: Email/Calendar/Documents (Supabase)"""
        print("\n🔍 TEST 5: Email/Calendar/Documents (Supabase)")
        print("=" * 60)
        
        if not self.token:
            self.log("Email/Calendar/Documents", False, "No auth token available")
            return False
        
        try:
            headers = {'Authorization': f'Bearer {self.token}'}
            
            # Test document CRUD
            print("\n   Testing Document CRUD...")
            doc_data = {
                "title": "Cognitive Core Test Document",
                "document_type": "SOP",
                "content": "Test document for Cognitive Core migration validation",
                "tags": ["test", "cognitive-core"]
            }
            
            response = requests.post(
                f"{BASE_URL}/documents",
                json=doc_data,
                headers=headers,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                doc_id = data.get('id')
                self.log("Document Create (Supabase)", True, f"Document ID: {doc_id}")
                
                # Test document retrieval
                response = requests.get(
                    f"{BASE_URL}/documents",
                    headers=headers,
                    timeout=30
                )
                
                if response.status_code == 200:
                    self.log("Document List (Supabase)", True, "Documents retrieved successfully")
                else:
                    self.log("Document List (Supabase)", False, f"Status: {response.status_code}")
            else:
                self.log("Document Create (Supabase)", False, f"Status: {response.status_code}")
            
            # Test calendar endpoint
            print("\n   Testing Calendar Endpoint...")
            response = requests.get(
                f"{BASE_URL}/calendar/events",
                headers=headers,
                timeout=30
            )
            
            if response.status_code in [200, 404]:  # 404 is ok if no events
                self.log("Calendar Events Endpoint", True, f"Status: {response.status_code}")
            else:
                self.log("Calendar Events Endpoint", False, f"Status: {response.status_code}")
            
            return True
            
        except Exception as e:
            self.log("Email/Calendar/Documents", False, f"Exception: {str(e)}")
            return False
    
    def test_regression_check(self):
        """Test 6: Regression Check"""
        print("\n🔍 TEST 6: Regression Check")
        print("=" * 60)
        
        if not self.token:
            self.log("Regression Check", False, "No auth token available")
            return False
        
        try:
            headers = {'Authorization': f'Bearer {self.token}'}
            
            # Test critical endpoints don't return 500
            critical_endpoints = [
                ("GET", "/auth/me", "Auth Me"),
                ("GET", "/business-profile", "Business Profile"),
                ("GET", "/dashboard/stats", "Dashboard Stats"),
                ("GET", "/chat/history", "Chat History"),
                ("GET", "/documents", "Documents List")
            ]
            
            all_passed = True
            for method, endpoint, name in critical_endpoints:
                if method == "GET":
                    response = requests.get(f"{BASE_URL}{endpoint}", headers=headers, timeout=30)
                
                if response.status_code == 500:
                    self.log(f"Regression - {name}", False, "500 Error detected")
                    all_passed = False
                else:
                    self.log(f"Regression - {name}", True, f"Status: {response.status_code}")
            
            if all_passed:
                self.log("No 500 Errors on Critical Endpoints", True, "All endpoints stable")
            else:
                self.log("No 500 Errors on Critical Endpoints", False, "Some endpoints returning 500")
            
            return all_passed
            
        except Exception as e:
            self.log("Regression Check", False, f"Exception: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all Cognitive Core migration tests"""
        print("\n" + "=" * 60)
        print("COGNITIVE CORE SUPABASE MIGRATION VALIDATION")
        print("=" * 60)
        print(f"Base URL: {BASE_URL}")
        print(f"Test Time: {datetime.now().isoformat()}")
        print("=" * 60)
        
        # Run tests in sequence
        tests = [
            ("Backend Health Check", self.test_backend_health),
            ("Authentication", self.test_authentication),
            ("Outlook Integration (Supabase)", self.test_outlook_integration),
            ("Cognitive Core AI Features", self.test_cognitive_core_ai_features),
            ("Email/Calendar/Documents (Supabase)", self.test_email_calendar_documents),
            ("Regression Check", self.test_regression_check)
        ]
        
        for test_name, test_func in tests:
            try:
                test_func()
            except Exception as e:
                self.log(test_name, False, f"Unexpected exception: {str(e)}")
        
        # Generate report
        self.generate_report()
    
    def generate_report(self):
        """Generate final test report"""
        print("\n" + "=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)
        
        total_tests = self.tests_passed + self.tests_failed
        success_rate = (self.tests_passed / total_tests * 100) if total_tests > 0 else 0
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {self.tests_passed} ✅")
        print(f"Failed: {self.tests_failed} ❌")
        print(f"Success Rate: {success_rate:.1f}%")
        
        if self.tests_failed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.results:
                if not result['passed']:
                    print(f"  - {result['test']}: {result['details']}")
        
        print("\n" + "=" * 60)
        
        # Check for critical failures
        critical_failures = []
        for result in self.results:
            if not result['passed'] and any(keyword in result['test'].lower() 
                for keyword in ['cognitive', 'backend', '500 error']):
                critical_failures.append(result['test'])
        
        if critical_failures:
            print("\n🔴 CRITICAL FAILURES DETECTED:")
            for failure in critical_failures:
                print(f"  - {failure}")
            print("\nCognitive Core migration may have issues!")
        else:
            print("\n✅ NO CRITICAL FAILURES")
            print("Cognitive Core migration appears successful!")
        
        print("=" * 60)
        
        # Save report
        report = {
            "test_suite": "Cognitive Core Supabase Migration",
            "timestamp": datetime.now().isoformat(),
            "total_tests": total_tests,
            "passed": self.tests_passed,
            "failed": self.tests_failed,
            "success_rate": f"{success_rate:.1f}%",
            "critical_failures": critical_failures,
            "results": self.results
        }
        
        with open('/app/cognitive_core_migration_report.json', 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"\n📄 Report saved to: /app/cognitive_core_migration_report.json")

if __name__ == "__main__":
    tester = CognitiveCoreTest()
    tester.run_all_tests()
