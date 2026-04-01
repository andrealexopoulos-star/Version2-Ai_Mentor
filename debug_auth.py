#!/usr/bin/env python3
"""
Debug Authentication for Production BIQc Platform
"""

import requests
import json
import time
from datetime import datetime

BASE_URL = "https://biqc.ai"
API_BASE = f"{BASE_URL}/api"
TEST_EMAIL = "andre@thestrategysquad.com.au"
TEST_PASSWORD = "MasterMind2025*"

def debug_authentication():
    """Debug authentication response"""
    print(f"🔍 Debug Authentication")
    print(f"Target: {API_BASE}/auth/supabase/login")
    print(f"Email: {TEST_EMAIL}")
    print(f"Password: [MASKED]")
    print("-" * 60)
    
    session = requests.Session()
    
    try:
        auth_url = f"{API_BASE}/auth/supabase/login"
        auth_data = {
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        }
        
        print(f"POST {auth_url}")
        print(f"Payload: {json.dumps(auth_data, indent=2)}")
        print("-" * 60)
        
        start_time = time.time()
        response = session.post(auth_url, json=auth_data, timeout=30)
        response_time = time.time() - start_time
        
        print(f"Response Time: {response_time:.2f}s")
        print(f"Status Code: {response.status_code}")
        print(f"Headers: {dict(response.headers)}")
        print("-" * 60)
        
        # Try to parse response
        try:
            response_data = response.json()
            print(f"Response JSON:")
            print(json.dumps(response_data, indent=2))
        except json.JSONDecodeError:
            print(f"Response Text (non-JSON):")
            print(response.text)
            
    except Exception as e:
        print(f"Exception: {str(e)}")

if __name__ == "__main__":
    debug_authentication()