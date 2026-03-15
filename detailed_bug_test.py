"""
BIQc Backend Detailed Bug Fix Verification
Testing specific fixes mentioned in the review request
"""
import asyncio
import httpx
import json
from datetime import datetime, timezone

BASE_URL = "https://advisor-engine.preview.emergentagent.com/api"

async def detailed_bug_fix_tests():
    """Test specific bug fixes mentioned in review request"""
    print("🔬 DETAILED BUG FIX VERIFICATION")
    print("=" * 50)
    
    # Create a test user first
    timestamp = int(datetime.now().timestamp())
    test_email = f"bugfix-test-{timestamp}@biqctest.io"
    test_password = "BugFixTest123!"
    session_token = None
    
    async with httpx.AsyncClient(timeout=60) as client:
        # Signup
        signup_response = await client.post(f"{BASE_URL}/auth/supabase/signup", json={
            "email": test_email,
            "password": test_password,
            "full_name": "Bug Fix Tester"
        })
        
        if signup_response.status_code == 200:
            signup_data = signup_response.json()
            session_token = signup_data.get("access_token") or signup_data.get("session", {}).get("access_token")
            print(f"✅ Test user created: {test_email}")
        else:
            print(f"❌ Failed to create test user: {signup_response.status_code}")
            return
        
        if not session_token:
            print("❌ No session token received")
            return
            
        headers = {"Authorization": f"Bearer {session_token}", "Content-Type": "application/json"}
        
        # Test 1: Missing mode field support (SoundboardChatRequest)
        print("\n🔍 Testing missing mode field support...")
        test_cases = [
            {"message": "Test without mode field"},  # No mode field
            {"message": "Test with mode field", "mode": "auto"},  # With mode field
            {"message": "Test with thinking mode", "mode": "thinking"},  # Thinking mode
            {"message": "Test with null mode", "mode": None},  # Null mode
        ]
        
        for i, test_case in enumerate(test_cases, 1):
            try:
                response = await client.post(f"{BASE_URL}/soundboard/chat", json=test_case, headers=headers)
                if response.status_code in [200, 503]:  # 503 acceptable for missing keys
                    print(f"✅ Test case {i}: Status {response.status_code} (no crash)")
                else:
                    print(f"⚠️ Test case {i}: Status {response.status_code}")
                    if response.status_code == 500:
                        error_text = response.text
                        if "mode" in error_text.lower() or "nameerror" in error_text.lower():
                            print(f"❌ Mode-related crash detected: {error_text[:200]}")
                        else:
                            print(f"⚠️ Different 500 error: {error_text[:100]}")
            except Exception as e:
                print(f"❌ Test case {i} exception: {str(e)}")
        
        # Test 2: Provider/model fallback logic
        print("\n🔍 Testing provider/model fallback logic...")
        fallback_modes = ["auto", "thinking", "pro", "fast"]
        
        for mode in fallback_modes:
            try:
                response = await client.post(f"{BASE_URL}/soundboard/chat", 
                    json={"message": f"Test {mode} mode fallback", "mode": mode}, 
                    headers=headers
                )
                
                if response.status_code == 200:
                    response_data = response.json()
                    model_used = response_data.get("model_used", "unknown")
                    print(f"✅ {mode} mode: Status 200, Model: {model_used}")
                elif response.status_code == 503:
                    error_text = response.text
                    if "provider keys" in error_text.lower() or "not configured" in error_text.lower():
                        print(f"✅ {mode} mode: Graceful 503 fallback - {error_text[:100]}")
                    else:
                        print(f"⚠️ {mode} mode: Unexpected 503 - {error_text[:100]}")
                else:
                    print(f"⚠️ {mode} mode: Status {response.status_code}")
            except Exception as e:
                print(f"❌ {mode} mode exception: {str(e)}")
        
        # Test 3: Conversation ID vs session_id fix
        print("\n🔍 Testing conversation updates use conversation_id...")
        
        # Create a conversation first
        chat_response = await client.post(f"{BASE_URL}/soundboard/chat", 
            json={"message": "Create test conversation"}, 
            headers=headers
        )
        
        if chat_response.status_code in [200, 503]:
            if chat_response.status_code == 200:
                conv_data = chat_response.json()
                conversation_id = conv_data.get("conversation_id")
                
                if conversation_id:
                    print(f"✅ Conversation created with ID: {conversation_id}")
                    
                    # Continue conversation using conversation_id
                    continue_response = await client.post(f"{BASE_URL}/soundboard/chat", 
                        json={"message": "Continue this conversation", "conversation_id": conversation_id}, 
                        headers=headers
                    )
                    
                    if continue_response.status_code == 200:
                        print("✅ Conversation continuation successful using conversation_id")
                    else:
                        print(f"⚠️ Conversation continuation failed: {continue_response.status_code}")
                else:
                    print("⚠️ No conversation_id returned")
            else:
                print("⚠️ Initial chat returned 503 - cannot test conversation persistence")
        
        # Test 4: Check for os import (should not cause NameError)
        print("\n🔍 Testing os import availability...")
        
        # Multiple rapid requests to stress test for NameError
        for i in range(3):
            try:
                response = await client.post(f"{BASE_URL}/soundboard/chat", 
                    json={"message": f"Stress test {i+1} for os import"}, 
                    headers=headers
                )
                
                if response.status_code == 500:
                    error_text = response.text
                    if "nameerror" in error_text.lower() and "os" in error_text.lower():
                        print(f"❌ NameError for 'os' detected: {error_text[:200]}")
                        break
                    else:
                        print(f"⚠️ Different 500 error: {error_text[:100]}")
                else:
                    print(f"✅ Stress test {i+1}: Status {response.status_code} (no NameError)")
            except Exception as e:
                print(f"⚠️ Stress test {i+1} exception: {str(e)}")
        
        print("\n" + "=" * 50)
        print("🎯 BUG FIX VERIFICATION COMPLETE")
        print("=" * 50)

if __name__ == "__main__":
    asyncio.run(detailed_bug_fix_tests())