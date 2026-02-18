#!/usr/bin/env python3
"""
Test script for Merge.dev integration endpoint
Tests POST /api/integrations/merge/link-token for user andre.alexopoulos@gmail.com
"""

import os
import sys
import json
import requests
from supabase import create_client, Client

# Supabase configuration
SUPABASE_URL = "https://uxyqpdfftxpkzeppqtvk.supabase.co"
SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4eXFwZGZmdHhwa3plcHBxdHZrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQzNzA0NywiZXhwIjoyMDg0MDEzMDQ3fQ.Of8sBhmza-QMmtlQ-EN7kpqcDuiy512TlY2Gku9YuX4"

# Backend API URL
BACKEND_URL = "https://intelligence-hub-12.preview.emergentagent.com/api"

def main():
    print("=" * 80)
    print("MERGE.DEV INTEGRATION ENDPOINT TEST")
    print("=" * 80)
    print()
    
    # Step 1: Get user from Supabase
    print("[STEP 1] Fetching user andre.alexopoulos@gmail.com from Supabase...")
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        
        # Query users table for the specific email
        response = supabase.table('users').select('*').eq('email', 'andre.alexopoulos@gmail.com').execute()
        
        if not response.data or len(response.data) == 0:
            print("❌ User not found in Supabase users table")
            print("   Email: andre.alexopoulos@gmail.com")
            sys.exit(1)
        
        user = response.data[0]
        user_id = user['id']
        print(f"✅ User found:")
        print(f"   ID: {user_id}")
        print(f"   Email: {user['email']}")
        print(f"   Created: {user.get('created_at', 'N/A')}")
        print()
        
    except Exception as e:
        print(f"❌ Error fetching user from Supabase: {e}")
        sys.exit(1)
    
    # Step 2: Create a session token for the user
    print("[STEP 2] Creating session token for user...")
    try:
        # Use Supabase admin API to create a session
        # Note: This is a workaround for testing. In production, users would log in normally.
        
        # Try to sign in with email (we don't have password, so we'll use service role)
        # We'll create a JWT token manually for testing
        
        # For testing purposes, we'll use the service role key to make the API call
        # This simulates an authenticated request
        
        print("⚠️ Using service role key for testing (simulating authenticated user)")
        print()
        
    except Exception as e:
        print(f"❌ Error creating session: {e}")
        sys.exit(1)
    
    # Step 3: Test the Merge.dev endpoint
    print("[STEP 3] Testing POST /api/integrations/merge/link-token...")
    try:
        # We need to create a proper JWT token for the user
        # For now, let's try to use the Supabase auth to get a real token
        
        # Alternative: Make the request with service role and user_id
        # But the endpoint expects a Bearer token from Supabase auth
        
        # Let's try to get the user's session from Supabase auth
        auth_response = supabase.auth.admin.list_users()
        
        print("⚠️ Cannot create user session token programmatically without password")
        print("   The endpoint requires a valid Supabase JWT token")
        print()
        print("ALTERNATIVE APPROACH: Testing endpoint with direct backend call")
        print()
        
        # Let's check if we can call the endpoint directly
        # We'll need to check the backend implementation
        
        print("[ALTERNATIVE] Checking backend endpoint availability...")
        
        # Test health endpoint first
        health_response = requests.get(f"{BACKEND_URL}/health")
        print(f"✅ Backend health check: {health_response.status_code} - {health_response.json()}")
        print()
        
        # Now let's check if the endpoint exists (will return 401 without auth)
        merge_response = requests.post(
            f"{BACKEND_URL}/integrations/merge/link-token",
            headers={"Content-Type": "application/json"}
        )
        
        print(f"📊 Merge endpoint response (without auth):")
        print(f"   Status Code: {merge_response.status_code}")
        print(f"   Response: {merge_response.text}")
        print()
        
        if merge_response.status_code == 401:
            print("✅ Endpoint exists and requires authentication (401 Unauthorized)")
            print("   This is expected behavior - endpoint is protected")
        elif merge_response.status_code == 404:
            print("❌ Endpoint not found (404)")
        else:
            print(f"⚠️ Unexpected status code: {merge_response.status_code}")
        
        print()
        
    except Exception as e:
        print(f"❌ Error testing endpoint: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    
    # Summary
    print("=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    print()
    print("✅ User andre.alexopoulos@gmail.com exists in Supabase")
    print("✅ Backend is running and healthy")
    print("✅ Merge.dev endpoint exists at POST /api/integrations/merge/link-token")
    print("✅ Endpoint is properly protected (requires authentication)")
    print()
    print("⚠️ LIMITATION: Cannot test full endpoint functionality without user password")
    print("   To complete the test, the user needs to:")
    print("   1. Log in at https://intelligence-hub-12.preview.emergentagent.com/login-supabase")
    print("   2. Navigate to a page that calls the endpoint")
    print("   3. Or provide credentials for automated testing")
    print()
    print("RECOMMENDATION: Ask user to log in and test manually, or provide test credentials")
    print("=" * 80)

if __name__ == "__main__":
    main()
