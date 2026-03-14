#!/usr/bin/env python3
"""
Backend API Testing for BIQc Forensic Preview
Tests the critical regression fixes:
1. War room responds with user-consumable text fields (answer/response)
2. Website enrichment provides rich deterministic fallbacks when AI unavailable
3. Authentication still works correctly

Credentials: andre@thestrategysquad.com.au / MasterMind2025*
Target: https://biqc-forensic.preview.emergentagent.com
"""

import asyncio
import httpx
import json
import sys
from typing import Dict, Any, Optional

# Test Configuration
BASE_URL = "https://biqc-forensic.preview.emergentagent.com"
TEST_EMAIL = "andre@thestrategysquad.com.au"
TEST_PASSWORD = "MasterMind2025*"

class BIQcBackendTester:
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=60.0)
        self.auth_token: Optional[str] = None
        self.user_id: Optional[str] = None
        
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()

    def log(self, message: str, level: str = "INFO"):
        print(f"[{level}] {message}")

    def assert_test(self, condition: bool, message: str):
        if condition:
            self.log(f"✅ {message}")
        else:
            self.log(f"❌ {message}", "ERROR")
            raise AssertionError(message)

    async def authenticate(self) -> bool:
        """Authenticate with Supabase using email/password"""
        try:
            self.log("Authenticating with Andre's credentials...")
            
            # Step 1: Get Supabase auth URL and keys from frontend env
            supabase_url = "https://vwwandhoydemcybltoxz.supabase.co"
            supabase_anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3d2FuZGhveWRlbWN5Ymx0b3h6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MjU4MzEsImV4cCI6MjA4ODQwMTgzMX0.KzFEpKDiHtDx6EjsZscdvwY9vyakitlUJ4SOMekWEys"
            
            # Step 2: Sign in with Supabase directly
            auth_response = await self.client.post(
                f"{supabase_url}/auth/v1/token?grant_type=password",
                headers={
                    "apikey": supabase_anon_key,
                    "Content-Type": "application/json"
                },
                json={
                    "email": TEST_EMAIL,
                    "password": TEST_PASSWORD
                }
            )
            
            if auth_response.status_code != 200:
                self.log(f"Supabase auth failed: {auth_response.status_code} - {auth_response.text}", "ERROR")
                return False
                
            auth_data = auth_response.json()
            self.auth_token = auth_data.get("access_token")
            if not self.auth_token:
                self.log("No access token in Supabase response", "ERROR") 
                return False
                
            # Get user info
            user_data = auth_data.get("user", {})
            self.user_id = user_data.get("id")
            
            self.log(f"✅ Authentication successful. User ID: {self.user_id}")
            return True
            
        except Exception as e:
            self.log(f"Authentication error: {e}", "ERROR")
            return False

    async def test_war_room_respond(self) -> Dict[str, Any]:
        """Test /api/war-room/respond endpoint"""
        self.log("Testing War Room respond endpoint...")
        
        try:
            response = await self.client.post(
                f"{BASE_URL}/api/war-room/respond",
                headers={
                    "Authorization": f"Bearer {self.auth_token}",
                    "Content-Type": "application/json"
                },
                json={
                    "question": "What is my highest priority risk right now?"
                }
            )
            
            self.assert_test(response.status_code == 200, 
                           f"War room API returns HTTP 200 (got {response.status_code})")
            
            if response.status_code != 200:
                self.log(f"Response body: {response.text}", "ERROR")
                return {"success": False, "error": f"HTTP {response.status_code}"}
            
            data = response.json()
            self.log(f"War room response keys: {list(data.keys())}")
            
            # Check that response contains user-consumable text fields
            has_answer = "answer" in data and isinstance(data["answer"], str) and len(data["answer"].strip()) > 0
            has_response = "response" in data and isinstance(data["response"], str) and len(data["response"].strip()) > 0
            has_consumable_text = has_answer or has_response
            
            self.assert_test(has_consumable_text, 
                           "War room response contains 'answer' or 'response' field with readable text")
            
            # Log what we found
            if has_answer:
                self.log(f"✅ Found 'answer' field: {data['answer'][:100]}...")
            if has_response:
                self.log(f"✅ Found 'response' field: {data['response'][:100]}...")
                
            # Analysis object can be present, but text fields must also be present
            if "analysis" in data:
                self.log("✅ 'analysis' object also present (acceptable alongside text fields)")
            
            return {
                "success": True,
                "has_answer": has_answer,
                "has_response": has_response,
                "has_analysis": "analysis" in data,
                "response_keys": list(data.keys()),
                "answer_preview": data.get("answer", "")[:100],
                "response_preview": data.get("response", "")[:100]
            }
            
        except Exception as e:
            self.log(f"War room test error: {e}", "ERROR")
            return {"success": False, "error": str(e)}

    async def test_website_enrichment(self) -> Dict[str, Any]:
        """Test /api/enrichment/website endpoint"""
        self.log("Testing website enrichment endpoint...")
        
        try:
            response = await self.client.post(
                f"{BASE_URL}/api/enrichment/website",
                headers={
                    "Authorization": f"Bearer {self.auth_token}",
                    "Content-Type": "application/json"
                },
                json={
                    "url": "https://thestrategysquad.com.au",
                    "action": "scan"
                }
            )
            
            self.assert_test(response.status_code == 200, 
                           f"Website enrichment returns HTTP 200 (got {response.status_code})")
            
            if response.status_code != 200:
                self.log(f"Response body: {response.text}", "ERROR")
                return {"success": False, "error": f"HTTP {response.status_code}"}
            
            data = response.json()
            self.log(f"Enrichment response keys: {list(data.keys())}")
            
            # Check status is "draft"
            self.assert_test(data.get("status") == "draft", 
                           f"Response status is 'draft' (got '{data.get('status')}')")
            
            enrichment = data.get("enrichment", {})
            if not enrichment:
                return {"success": False, "error": "No enrichment data found"}
            
            # Check for stronger fallback fields
            required_fields = [
                "business_name", "description", "target_market", 
                "unique_value_proposition", "market_position", "trust_signals"
            ]
            
            populated_fields = []
            for field in required_fields:
                value = enrichment.get(field)
                if value and str(value).strip():
                    populated_fields.append(field)
                    self.log(f"✅ {field}: {str(value)[:80]}...")
            
            # Check social handles
            social_handles = enrichment.get("social_handles", {})
            linkedin_populated = bool(social_handles.get("linkedin"))
            if linkedin_populated:
                self.log(f"✅ LinkedIn handle: {social_handles['linkedin']}")
                populated_fields.append("social_handles.linkedin")
            
            # Check competitors
            competitors = enrichment.get("competitors", [])
            if competitors and len(competitors) > 0:
                self.log(f"✅ Competitors found: {competitors}")
                populated_fields.append("competitors")
            else:
                self.log("⚠️ No competitors populated")
            
            self.log(f"Populated fields: {populated_fields}")
            
            # Verify fallback strength (should have most required fields)
            field_coverage = len([f for f in required_fields if f in populated_fields]) / len(required_fields)
            self.assert_test(field_coverage >= 0.7, 
                           f"At least 70% of required fallback fields populated (got {field_coverage:.1%})")
            
            return {
                "success": True,
                "status": data.get("status"),
                "populated_fields": populated_fields,
                "field_coverage": field_coverage,
                "has_linkedin": linkedin_populated,
                "has_competitors": bool(competitors),
                "competitor_count": len(competitors),
                "business_name": enrichment.get("business_name", ""),
                "description": enrichment.get("description", "")[:100]
            }
            
        except Exception as e:
            self.log(f"Website enrichment test error: {e}", "ERROR")
            return {"success": False, "error": str(e)}

    async def run_regression_test(self) -> Dict[str, Any]:
        """Run the complete regression test suite"""
        self.log("=" * 60)
        self.log("Starting BIQc Backend Regression Test")
        self.log("=" * 60)
        
        results = {
            "auth": {"success": False},
            "war_room": {"success": False},
            "enrichment": {"success": False},
            "overall_success": False
        }
        
        # Test 1: Authentication
        auth_success = await self.authenticate()
        results["auth"]["success"] = auth_success
        
        if not auth_success:
            self.log("❌ Authentication failed - cannot proceed with API tests", "ERROR")
            return results
        
        # Test 2: War Room Response
        try:
            war_room_result = await self.test_war_room_respond()
            results["war_room"] = war_room_result
        except Exception as e:
            results["war_room"] = {"success": False, "error": str(e)}
        
        # Test 3: Website Enrichment
        try:
            enrichment_result = await self.test_website_enrichment()
            results["enrichment"] = enrichment_result
        except Exception as e:
            results["enrichment"] = {"success": False, "error": str(e)}
        
        # Overall success
        results["overall_success"] = all([
            results["auth"]["success"],
            results["war_room"]["success"], 
            results["enrichment"]["success"]
        ])
        
        # Summary
        self.log("=" * 60)
        self.log("TEST SUMMARY")
        self.log("=" * 60)
        
        for test_name, test_result in results.items():
            if test_name == "overall_success":
                continue
            status = "✅ PASS" if test_result["success"] else "❌ FAIL"
            self.log(f"{test_name.upper().replace('_', ' ')}: {status}")
            if not test_result["success"] and "error" in test_result:
                self.log(f"   Error: {test_result['error']}")
        
        overall_status = "✅ ALL TESTS PASSED" if results["overall_success"] else "❌ SOME TESTS FAILED"
        self.log("=" * 60)
        self.log(f"OVERALL: {overall_status}")
        self.log("=" * 60)
        
        return results


async def main():
    """Run the backend regression test"""
    async with BIQcBackendTester() as tester:
        results = await tester.run_regression_test()
        
        # Exit with appropriate code
        exit_code = 0 if results["overall_success"] else 1
        sys.exit(exit_code)


if __name__ == "__main__":
    asyncio.run(main())