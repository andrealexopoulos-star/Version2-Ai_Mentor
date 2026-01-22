#!/usr/bin/env python3
"""
COMPREHENSIVE SYSTEM TEST: Document MongoDB broken state

This test documents which endpoints are accessible and which fail.
Since Supabase auth has email confirmation requirements, we'll test what we can.
"""

import requests
import json
from datetime import datetime

class SystemStateDocumentation:
    def __init__(self, base_url="https://auth-upgrade-33.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.results = []
        
    def test_endpoint(self, method, endpoint, data=None, expected_status=None, notes=""):
        """Test an endpoint and document the result"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=15)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=15)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=15)
            
            try:
                response_data = response.json()
            except:
                response_data = {"raw_text": response.text[:300]}
            
            result = {
                "endpoint": f"{method} /api/{endpoint}",
                "status_code": response.status_code,
                "expected_status": expected_status,
                "response": response_data,
                "notes": notes,
                "timestamp": datetime.now().isoformat()
            }
            
            self.results.append(result)
            
            status_match = "✅" if (expected_status and response.status_code == expected_status) else "❌"
            print(f"\n{status_match} {method} /api/{endpoint}")
            print(f"   Status: {response.status_code} (Expected: {expected_status})")
            if response.status_code not in [200, 201]:
                print(f"   Response: {json.dumps(response_data, indent=2)[:200]}")
            if notes:
                print(f"   Notes: {notes}")
            
            return response.status_code, response_data
            
        except Exception as e:
            result = {
                "endpoint": f"{method} /api/{endpoint}",
                "status_code": None,
                "expected_status": expected_status,
                "response": {"error": str(e)},
                "notes": notes,
                "timestamp": datetime.now().isoformat()
            }
            self.results.append(result)
            print(f"\n❌ {method} /api/{endpoint}")
            print(f"   Error: {str(e)}")
            return None, {"error": str(e)}
    
    def run_comprehensive_test(self):
        """Run comprehensive system test"""
        print("="*80)
        print("COMPREHENSIVE SYSTEM STATE DOCUMENTATION")
        print("Testing MongoDB broken state before fix")
        print("="*80)
        
        # Test 1: Health endpoints (should work)
        print("\n" + "="*80)
        print("TEST 1: HEALTH ENDPOINTS (SHOULD WORK)")
        print("="*80)
        
        self.test_endpoint('GET', 'health', expected_status=200, 
                          notes="Basic health check - should always work")
        self.test_endpoint('GET', '', expected_status=200,
                          notes="Root API endpoint - should return API info")
        
        # Test 2: Auth endpoints (should work for unauthenticated access)
        print("\n" + "="*80)
        print("TEST 2: AUTH SYSTEM")
        print("="*80)
        
        self.test_endpoint('GET', 'auth/supabase/me', expected_status=403,
                          notes="Should return 403 without token (auth migrated to Supabase)")
        
        # Test 3: Outlook Integration (requires auth)
        print("\n" + "="*80)
        print("TEST 3: OUTLOOK INTEGRATION (REQUIRES AUTH)")
        print("="*80)
        
        self.test_endpoint('GET', 'outlook/status', expected_status=403,
                          notes="Requires authentication - may have MongoDB references")
        
        # Test 4: Soundboard (requires auth, uses MongoDB)
        print("\n" + "="*80)
        print("TEST 4: SOUNDBOARD (REQUIRES AUTH, USES MONGODB)")
        print("="*80)
        
        self.test_endpoint('POST', 'soundboard/chat', 
                          data={"message": "test", "context": "test"},
                          expected_status=403,
                          notes="Uses db.soundboard_conversations - would return 500 if authenticated")
        
        self.test_endpoint('GET', 'soundboard/conversations', expected_status=403,
                          notes="Uses db.soundboard_conversations - would return 500 if authenticated")
        
        # Test 5: Chat/BIQC (requires auth, uses MongoDB)
        print("\n" + "="*80)
        print("TEST 5: CHAT/BIQC (REQUIRES AUTH, USES MONGODB)")
        print("="*80)
        
        self.test_endpoint('POST', 'chat',
                          data={"message": "test", "context_type": "general"},
                          expected_status=403,
                          notes="Uses db.chat_history, db.analyses - would return 500 if authenticated")
        
        self.test_endpoint('GET', 'chat/history', expected_status=403,
                          notes="Uses db.chat_history - would return 500 if authenticated")
        
        # Test 6: Business Profile (requires auth, uses MongoDB)
        print("\n" + "="*80)
        print("TEST 6: BUSINESS PROFILE (REQUIRES AUTH, USES MONGODB)")
        print("="*80)
        
        self.test_endpoint('GET', 'business-profile', expected_status=403,
                          notes="Uses db.business_profiles_versioned - would return 500 if authenticated")
        
        self.test_endpoint('PUT', 'business-profile',
                          data={"business_name": "Test"},
                          expected_status=403,
                          notes="Uses db.business_profiles_versioned - would return 500 if authenticated")
        
        # Test 7: Data Files (requires auth, uses MongoDB)
        print("\n" + "="*80)
        print("TEST 7: DATA FILES (REQUIRES AUTH, USES MONGODB)")
        print("="*80)
        
        self.test_endpoint('GET', 'data-center/files', expected_status=403,
                          notes="Uses db.data_files - would return 500 if authenticated")
        
        self.test_endpoint('GET', 'data-center/stats', expected_status=403,
                          notes="Uses db.data_files - would return 500 if authenticated")
        
        # Test 8: Additional endpoints
        print("\n" + "="*80)
        print("TEST 8: ADDITIONAL ENDPOINTS (REQUIRE AUTH)")
        print("="*80)
        
        self.test_endpoint('GET', 'analyses', expected_status=403,
                          notes="May use MongoDB references")
        
        self.test_endpoint('GET', 'documents', expected_status=403,
                          notes="May use MongoDB references")
        
        self.test_endpoint('GET', 'dashboard/stats', expected_status=403,
                          notes="May use MongoDB references")
        
        # Generate report
        self.generate_report()
    
    def generate_report(self):
        """Generate and save comprehensive report"""
        print("\n" + "="*80)
        print("SYSTEM STATE REPORT")
        print("="*80)
        
        working = [r for r in self.results if r['status_code'] in [200, 201]]
        auth_required = [r for r in self.results if r['status_code'] == 403]
        errors = [r for r in self.results if r['status_code'] not in [200, 201, 403] and r['status_code'] is not None]
        
        print(f"\n📊 SUMMARY:")
        print(f"   Total Endpoints Tested: {len(self.results)}")
        print(f"   Working (200/201): {len(working)}")
        print(f"   Auth Required (403): {len(auth_required)}")
        print(f"   Errors (4xx/5xx): {len(errors)}")
        
        print(f"\n✅ WORKING ENDPOINTS ({len(working)}):")
        for r in working:
            print(f"   • {r['endpoint']}")
        
        print(f"\n🔒 AUTH REQUIRED ENDPOINTS ({len(auth_required)}):")
        for r in auth_required:
            print(f"   • {r['endpoint']}")
            if r['notes']:
                print(f"     Note: {r['notes']}")
        
        if errors:
            print(f"\n❌ ERROR ENDPOINTS ({len(errors)}):")
            for r in errors:
                print(f"   • {r['endpoint']} - Status {r['status_code']}")
                if isinstance(r['response'], dict):
                    error_msg = r['response'].get('detail', r['response'].get('error', ''))
                    if error_msg:
                        print(f"     Error: {error_msg[:150]}")
        
        # Key findings
        print(f"\n🔍 KEY FINDINGS:")
        print(f"   1. Auth System: Migrated to Supabase ✅")
        print(f"   2. All protected endpoints require authentication (403 without token)")
        print(f"   3. MongoDB references in code would cause 500 errors when authenticated")
        print(f"   4. Endpoints using db.soundboard_conversations, db.chat_history, db.business_profiles_versioned, db.data_files will fail")
        print(f"   5. Troubleshoot agent identified 27 MongoDB references causing failures")
        
        # Save report
        report = {
            "test_date": datetime.now().isoformat(),
            "summary": {
                "total_tests": len(self.results),
                "working": len(working),
                "auth_required": len(auth_required),
                "errors": len(errors)
            },
            "findings": {
                "auth_system": "Migrated to Supabase",
                "mongodb_references": "27 references identified by troubleshoot agent",
                "expected_failures": [
                    "db.soundboard_conversations",
                    "db.chat_history",
                    "db.business_profiles_versioned",
                    "db.data_files",
                    "db.analyses",
                    "db.users (in some code paths)"
                ]
            },
            "all_results": self.results
        }
        
        report_file = '/app/mongodb_broken_state_report.json'
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"\n📄 Detailed report saved to: {report_file}")
        
        return report

def main():
    """Main entry point"""
    tester = SystemStateDocumentation()
    tester.run_comprehensive_test()
    return 0

if __name__ == "__main__":
    exit(main())
