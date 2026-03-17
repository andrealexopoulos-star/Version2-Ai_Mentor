#!/usr/bin/env python3
"""
Backend Canonical Cognition Hardening Verification Test
Tests specific behaviors after hardening changes per review request.
"""

import requests
import json
import time
from datetime import datetime

# Test configuration
BASE_URL = "https://kpi-intelligence-1.preview.emergentagent.com/api"
CREDENTIALS = {
    "email": "andre@thestrategysquad.com.au", 
    "password": "MasterMind2025*"
}

def print_test_header(test_name):
    print(f"\n{'='*60}")
    print(f"TEST: {test_name}")
    print(f"{'='*60}")

def print_result(test_num, description, status, details):
    status_icon = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
    print(f"{test_num}. {status_icon} {status}: {description}")
    if details:
        print(f"   Details: {details}")

def test_auth_login():
    """Test 1: POST /api/auth/supabase/login returns 200"""
    print_test_header("1. Authentication Login Test")
    
    try:
        url = f"{BASE_URL}/auth/supabase/login"
        response = requests.post(url, json=CREDENTIALS, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            access_token = data.get('session', {}).get('access_token', '')
            user_id = data.get('user', {}).get('id', '')
            
            print_result(1, "POST /api/auth/supabase/login", "PASS", 
                        f"HTTP {response.status_code}, token length: {len(access_token)}, user_id: {user_id}")
            return access_token
        else:
            print_result(1, "POST /api/auth/supabase/login", "FAIL", 
                        f"HTTP {response.status_code}, response: {response.text[:200]}")
            return None
            
    except requests.exceptions.RequestException as e:
        print_result(1, "POST /api/auth/supabase/login", "FAIL", f"Request failed: {str(e)}")
        return None

def test_intelligence_pressure(auth_token):
    """Test 2: GET /api/intelligence/pressure now FAILS FAST with 503"""
    print_test_header("2. Intelligence Pressure Endpoint Test") 
    
    if not auth_token:
        print_result(2, "GET /api/intelligence/pressure", "SKIP", "No auth token available")
        return
    
    try:
        url = f"{BASE_URL}/intelligence/pressure"
        headers = {"Authorization": f"Bearer {auth_token}"}
        start_time = time.time()
        response = requests.get(url, headers=headers, timeout=30)
        duration = time.time() - start_time
        
        if response.status_code == 503:
            try:
                data = response.json()
                message = data.get('detail', 'No detail available')
                print_result(2, "GET /api/intelligence/pressure", "PASS", 
                            f"HTTP 503 (FAILS FAST in {duration:.2f}s), message: {message}")
            except:
                print_result(2, "GET /api/intelligence/pressure", "PASS", 
                            f"HTTP 503 (FAILS FAST in {duration:.2f}s), response: {response.text[:100]}")
        else:
            print_result(2, "GET /api/intelligence/pressure", "FAIL", 
                        f"Expected HTTP 503, got {response.status_code}, response: {response.text[:200]}")
                        
    except requests.exceptions.RequestException as e:
        print_result(2, "GET /api/intelligence/pressure", "FAIL", f"Request failed: {str(e)}")

def test_intelligence_watchtower(auth_token):
    """Test 3: GET /api/intelligence/watchtower now FAILS FAST with 503"""
    print_test_header("3. Intelligence Watchtower Endpoint Test")
    
    if not auth_token:
        print_result(3, "GET /api/intelligence/watchtower", "SKIP", "No auth token available")
        return
    
    try:
        url = f"{BASE_URL}/intelligence/watchtower"
        headers = {"Authorization": f"Bearer {auth_token}"}
        start_time = time.time()
        response = requests.get(url, headers=headers, timeout=30)
        duration = time.time() - start_time
        
        if response.status_code == 503:
            try:
                data = response.json()
                message = data.get('detail', 'No detail available')
                print_result(3, "GET /api/intelligence/watchtower", "PASS", 
                            f"HTTP 503 (FAILS FAST in {duration:.2f}s), message: {message}")
            except:
                print_result(3, "GET /api/intelligence/watchtower", "PASS", 
                            f"HTTP 503 (FAILS FAST in {duration:.2f}s), response: {response.text[:100]}")
        else:
            print_result(3, "GET /api/intelligence/watchtower", "FAIL", 
                        f"Expected HTTP 503, got {response.status_code}, response: {response.text[:200]}")
                        
    except requests.exceptions.RequestException as e:
        print_result(3, "GET /api/intelligence/watchtower", "FAIL", f"Request failed: {str(e)}")

def test_brain_priorities(auth_token):
    """Test 4: GET /api/brain/priorities returns 200 only if business_core is active; otherwise 503"""
    print_test_header("4. Brain Priorities Endpoint Test")
    
    if not auth_token:
        print_result(4, "GET /api/brain/priorities", "SKIP", "No auth token available")
        return
    
    try:
        url = f"{BASE_URL}/brain/priorities"
        headers = {"Authorization": f"Bearer {auth_token}"}
        start_time = time.time()
        response = requests.get(url, headers=headers, timeout=30)
        duration = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            business_core_ready = data.get('business_core_ready', False)
            concerns_count = len(data.get('concerns', []))
            print_result(4, "GET /api/brain/priorities", "RECORD", 
                        f"HTTP 200 (duration: {duration:.2f}s), business_core_ready: {business_core_ready}, concerns: {concerns_count}")
        elif response.status_code == 503:
            try:
                data = response.json()
                message = data.get('detail', 'No detail available')
                print_result(4, "GET /api/brain/priorities", "RECORD", 
                            f"HTTP 503 (FAILS FAST in {duration:.2f}s), message: {message}")
            except:
                print_result(4, "GET /api/brain/priorities", "RECORD", 
                            f"HTTP 503 (FAILS FAST in {duration:.2f}s), response: {response.text[:100]}")
        else:
            print_result(4, "GET /api/brain/priorities", "RECORD", 
                        f"HTTP {response.status_code} (duration: {duration:.2f}s), response: {response.text[:200]}")
                        
    except requests.exceptions.RequestException as e:
        print_result(4, "GET /api/brain/priorities", "FAIL", f"Request failed: {str(e)}")

def test_brain_initial_calibration(auth_token):
    """Test 5: GET /api/brain/initial-calibration now FAILS FAST with 503 if canonical RPC is broken"""
    print_test_header("5. Brain Initial Calibration Endpoint Test")
    
    if not auth_token:
        print_result(5, "GET /api/brain/initial-calibration", "SKIP", "No auth token available")
        return
    
    try:
        url = f"{BASE_URL}/brain/initial-calibration"
        headers = {"Authorization": f"Bearer {auth_token}"}
        start_time = time.time()
        response = requests.get(url, headers=headers, timeout=30)
        duration = time.time() - start_time
        
        if response.status_code == 503:
            try:
                data = response.json()
                detail_string = data.get('detail', 'No detail available')
                print_result(5, "GET /api/brain/initial-calibration", "PASS", 
                            f"HTTP 503 (FAILS FAST in {duration:.2f}s), detail: {detail_string}")
            except:
                print_result(5, "GET /api/brain/initial-calibration", "PASS", 
                            f"HTTP 503 (FAILS FAST in {duration:.2f}s), response: {response.text[:100]}")
        elif response.status_code == 200:
            data = response.json()
            status = data.get('status', 'unknown')
            print_result(5, "GET /api/brain/initial-calibration", "RECORD", 
                        f"HTTP 200 (duration: {duration:.2f}s), status: {status}, full response keys: {list(data.keys())}")
        else:
            print_result(5, "GET /api/brain/initial-calibration", "RECORD", 
                        f"HTTP {response.status_code} (duration: {duration:.2f}s), response: {response.text[:200]}")
                        
    except requests.exceptions.RequestException as e:
        print_result(5, "GET /api/brain/initial-calibration", "FAIL", f"Request failed: {str(e)}")

def test_cognition_platform_audit(auth_token):
    """Test 6: Confirm /api/services/cognition-platform-audit still returns 200 authenticated"""
    print_test_header("6. Cognition Platform Audit Endpoint Test")
    
    if not auth_token:
        print_result(6, "GET /api/services/cognition-platform-audit", "SKIP", "No auth token available")
        return
    
    try:
        url = f"{BASE_URL}/services/cognition-platform-audit"
        headers = {"Authorization": f"Bearer {auth_token}"}
        start_time = time.time()
        response = requests.get(url, headers=headers, timeout=30)
        duration = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            platform_readiness = data.get('platform_readiness_score', 'unknown')
            edge_functions = data.get('edge_functions', {})
            print_result(6, "GET /api/services/cognition-platform-audit", "PASS", 
                        f"HTTP 200 (duration: {duration:.2f}s), platform_readiness: {platform_readiness}, edge_functions count: {len(edge_functions)}")
        else:
            print_result(6, "GET /api/services/cognition-platform-audit", "FAIL", 
                        f"Expected HTTP 200, got {response.status_code}, response: {response.text[:200]}")
                        
    except requests.exceptions.RequestException as e:
        print_result(6, "GET /api/services/cognition-platform-audit", "FAIL", f"Request failed: {str(e)}")

def main():
    print(f"Backend Canonical Cognition Hardening Verification")
    print(f"Testing against: {BASE_URL}")
    print(f"Test started at: {datetime.now().isoformat()}")
    print(f"Credentials: {CREDENTIALS['email']} / [PROTECTED]")
    
    # Test 1: Authentication
    access_token = test_auth_login()
    
    # Test 2-6: Hardening verification tests
    test_intelligence_pressure(access_token)
    test_intelligence_watchtower(access_token)
    test_brain_priorities(access_token)
    test_brain_initial_calibration(access_token)
    test_cognition_platform_audit(access_token)
    
    print(f"\n{'='*60}")
    print(f"CANONICAL COGNITION HARDENING VERIFICATION COMPLETE")
    print(f"Test completed at: {datetime.now().isoformat()}")
    print(f"{'='*60}")

if __name__ == "__main__":
    main()