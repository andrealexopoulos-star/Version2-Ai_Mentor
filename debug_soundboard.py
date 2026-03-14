#!/usr/bin/env python3
"""
Debug Soundboard 422 Error
"""

import requests
import json
import time

BASE_URL = "https://biqc.thestrategysquad.com"
API_BASE = f"{BASE_URL}/api"
TEST_EMAIL = "andre@thestrategysquad.com.au"
TEST_PASSWORD = "MasterMind2025*"

def debug_soundboard_422():
    print("🔍 Debug Soundboard 422 Error")
    
    session = requests.Session()
    
    # Authenticate first
    auth_url = f"{API_BASE}/auth/supabase/login"
    auth_data = {"email": TEST_EMAIL, "password": TEST_PASSWORD}
    auth_response = session.post(auth_url, json=auth_data, timeout=10)
    
    if auth_response.status_code == 200:
        data = auth_response.json()
        access_token = data.get('session', {}).get('access_token')
        if access_token:
            session.headers.update({'Authorization': f'Bearer {access_token}'})
            print("✅ Authenticated")
        else:
            print("❌ No access token")
            return
    else:
        print(f"❌ Auth failed: {auth_response.status_code}")
        return
    
    # Test soundboard with detailed error info
    chat_url = f"{API_BASE}/soundboard/chat"
    chat_data = {
        "question": "What are my top 3 revenue risks right now?",
        "conversation_id": "test-conversation-debug",
        "mode": "auto"
    }
    
    print(f"\nPOST {chat_url}")
    print(f"Headers: {dict(session.headers)}")
    print(f"Payload: {json.dumps(chat_data, indent=2)}")
    
    try:
        response = session.post(chat_url, json=chat_data, timeout=15)
        
        print(f"\nResponse:")
        print(f"Status: {response.status_code}")
        print(f"Headers: {dict(response.headers)}")
        
        try:
            response_data = response.json()
            print(f"JSON Response:")
            print(json.dumps(response_data, indent=2))
        except:
            print(f"Text Response:")
            print(response.text)
            
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    debug_soundboard_422()