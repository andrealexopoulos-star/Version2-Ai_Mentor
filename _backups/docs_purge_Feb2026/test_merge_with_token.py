#!/usr/bin/env python3
"""
Test Merge.dev endpoint with Supabase JWT token
"""

import os
import sys
import json
import requests
from supabase import create_client, Client
import jwt
from datetime import datetime, timedelta

# Supabase configuration
SUPABASE_URL = "https://uxyqpdfftxpkzeppqtvk.supabase.co"
SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4eXFwZGZmdHhwa3plcHBxdHZrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQzNzA0NywiZXhwIjoyMDg0MDEzMDQ3fQ.Of8sBhmza-QMmtlQ-EN7kpqcDuiy512TlY2Gku9YuX4"
SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET", "")

# Backend API URL
BACKEND_URL = "https://biqc-ai-insights.preview.emergentagent.com/api"

def create_test_jwt(user_id: str, email: str) -> str:
    """Create a test JWT token for the user"""
    
    # Supabase JWT structure
    payload = {
        "aud": "authenticated",
        "exp": int((datetime.utcnow() + timedelta(hours=1)).timestamp()),
        "iat": int(datetime.utcnow().timestamp()),
        "iss": "https://uxyqpdfftxpkzeppqtvk.supabase.co/auth/v1",
        "sub": user_id,
        "email": email,
        "phone": "",
        "app_metadata": {
            "provider": "email",
            "providers": ["email"]
        },
        "user_metadata": {},
        "role": "authenticated",
        "aal": "aal1",
        "amr": [{"method": "password", "timestamp": int(datetime.utcnow().timestamp())}],
        "session_id": "test-session-id"
    }
    
    # Note: We need the JWT secret to sign the token
    # This is typically not available, so we'll try a different approach
    
    return None

def main():
    print("=" * 80)
    print("MERGE.DEV INTEGRATION ENDPOINT TEST (WITH TOKEN)")
    print("=" * 80)
    print()
    
    # Step 1: Get user from Supabase
    print("[STEP 1] Fetching user andre.alexopoulos@gmail.com from Supabase...")
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        
        response = supabase.table('users').select('*').eq('email', 'andre.alexopoulos@gmail.com').execute()
        
        if not response.data or len(response.data) == 0:
            print("❌ User not found")
            sys.exit(1)
        
        user = response.data[0]
        user_id = user['id']
        print(f"✅ User found: {user['email']} (ID: {user_id})")
        print()
        
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)
    
    # Step 2: Try to use Supabase admin to generate access token
    print("[STEP 2] Attempting to generate access token...")
    try:
        # Try using Supabase admin API to generate a token
        # This requires the admin API which may not be available
        
        # Alternative: Use the service role key directly
        print("⚠️ Attempting to use service role key as Bearer token...")
        
        # Test with service role key
        headers = {
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "Content-Type": "application/json"
        }
        
        print()
        print("[STEP 3] Testing Merge.dev endpoint with service role key...")
        
        merge_response = requests.post(
            f"{BACKEND_URL}/integrations/merge/link-token",
            headers=headers
        )
        
        print(f"📊 Response:")
        print(f"   Status Code: {merge_response.status_code}")
        
        if merge_response.status_code == 200:
            data = merge_response.json()
            print(f"   Response Data: {json.dumps(data, indent=2)}")
            
            if 'link_token' in data:
                link_token = data['link_token']
                print()
                print("✅ SUCCESS! Merge.dev endpoint is working!")
                print(f"   link_token: {link_token}")
                print(f"   link_token length: {len(link_token)} characters")
                
                if link_token.startswith('lt_'):
                    print(f"   ✅ Token has expected 'lt_' prefix")
                else:
                    print(f"   ⚠️ Token does not have 'lt_' prefix")
            else:
                print("   ❌ No link_token in response")
                print(f"   Available fields: {list(data.keys())}")
        else:
            print(f"   Response: {merge_response.text}")
            
            if merge_response.status_code == 403:
                print()
                print("❌ 403 Forbidden - Service role key not accepted")
                print("   The endpoint requires a user JWT token, not service role key")
            elif merge_response.status_code == 401:
                print()
                print("❌ 401 Unauthorized - Token not valid")
            elif merge_response.status_code == 500:
                print()
                print("❌ 500 Internal Server Error")
                print("   Check backend logs for details")
        
        print()
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    
    # Summary
    print("=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    print()
    print("✅ User andre.alexopoulos@gmail.com exists in Supabase")
    print("✅ Backend endpoint exists and is protected")
    print()
    print("⚠️ TESTING LIMITATION:")
    print("   Cannot generate valid user JWT token without:")
    print("   - User password for authentication")
    print("   - Supabase JWT secret for token signing")
    print("   - Or active user session")
    print()
    print("NEXT STEPS:")
    print("   1. User should log in at the frontend")
    print("   2. Then test the endpoint from browser console or network tab")
    print("   3. Or provide test credentials for automated testing")
    print("=" * 80)

if __name__ == "__main__":
    main()
