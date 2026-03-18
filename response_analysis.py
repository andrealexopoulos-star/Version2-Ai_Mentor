"""
BIQc Backend Response Content Analysis
Detailed inspection of soundboard API responses
"""
import asyncio
import httpx
import json
from datetime import datetime, timezone

BASE_URL = "https://truth-engine-19.preview.emergentagent.com/api"

async def analyze_soundboard_responses():
    """Analyze detailed soundboard response content"""
    print("🔍 SOUNDBOARD RESPONSE CONTENT ANALYSIS")
    print("=" * 50)
    
    # Create a test user
    timestamp = int(datetime.now().timestamp())
    test_email = f"analysis-test-{timestamp}@biqctest.io"
    test_password = "AnalysisTest123!"
    
    async with httpx.AsyncClient(timeout=90) as client:
        # Signup
        signup_response = await client.post(f"{BASE_URL}/auth/supabase/signup", json={
            "email": test_email,
            "password": test_password,
            "full_name": "Response Analyzer"
        })
        
        if signup_response.status_code != 200:
            print(f"❌ Failed to create test user: {signup_response.status_code}")
            return
            
        signup_data = signup_response.json()
        session_token = signup_data.get("access_token") or signup_data.get("session", {}).get("access_token")
        
        if not session_token:
            print("❌ No session token received")
            return
            
        headers = {"Authorization": f"Bearer {session_token}", "Content-Type": "application/json"}
        
        print(f"✅ Test user created with token")
        
        # Test soundboard chat with detailed response analysis
        print("\n📊 Analyzing soundboard chat response structure...")
        
        chat_data = {
            "message": "What can you tell me about my business performance?",
            "mode": "auto"
        }
        
        response = await client.post(f"{BASE_URL}/soundboard/chat", json=chat_data, headers=headers)
        
        print(f"Status Code: {response.status_code}")
        print(f"Response Headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            response_json = response.json()
            
            print("\n📋 Response Structure Analysis:")
            print(f"  ✅ Response Type: {type(response_json)}")
            print(f"  ✅ Top-level Keys: {list(response_json.keys())}")
            
            # Check specific fields mentioned in bug fixes
            important_fields = [
                "reply", "conversation_id", "model_used", "guardrail", 
                "coverage_pct", "intent", "suggested_actions"
            ]
            
            print(f"\n📝 Important Fields Check:")
            for field in important_fields:
                if field in response_json:
                    value = response_json[field]
                    if isinstance(value, str):
                        display_value = f"'{value[:100]}...'" if len(str(value)) > 100 else f"'{value}'"
                    else:
                        display_value = str(value)
                    print(f"  ✅ {field}: {display_value}")
                else:
                    print(f"  ❌ {field}: MISSING")
            
            # Check reply content
            reply_content = response_json.get("reply", "")
            if reply_content:
                print(f"\n💬 Reply Analysis:")
                print(f"  ✅ Reply Length: {len(reply_content)} characters")
                print(f"  ✅ Reply Preview: '{reply_content[:200]}...'")
                
                # Check for specific indicators of working system
                positive_indicators = [
                    "business", "data", "profile", "BIQc", "intelligence", 
                    "coverage", "calibration", "integration"
                ]
                found_indicators = [ind for ind in positive_indicators if ind.lower() in reply_content.lower()]
                print(f"  ✅ Business Context Indicators Found: {found_indicators}")
            
            # Model routing analysis  
            model_used = response_json.get("model_used")
            if model_used:
                print(f"\n🤖 Model Routing Analysis:")
                print(f"  ✅ Model Used: {model_used}")
                if "/" in model_used:
                    provider, model = model_used.split("/", 1)
                    print(f"  ✅ Provider: {provider}")
                    print(f"  ✅ Model: {model}")
            
            # Conversation handling
            conversation_id = response_json.get("conversation_id")
            if conversation_id:
                print(f"\n💾 Conversation Handling:")
                print(f"  ✅ Conversation ID: {conversation_id}")
                
                # Test conversation continuation
                continue_data = {
                    "message": "Can you provide more details?",
                    "conversation_id": conversation_id,
                    "mode": "auto"
                }
                
                continue_response = await client.post(f"{BASE_URL}/soundboard/chat", 
                    json=continue_data, headers=headers)
                
                if continue_response.status_code == 200:
                    continue_json = continue_response.json()
                    returned_conv_id = continue_json.get("conversation_id")
                    if returned_conv_id == conversation_id:
                        print(f"  ✅ Conversation continuity: WORKING (same ID returned)")
                    else:
                        print(f"  ⚠️ Conversation continuity: Different ID ({returned_conv_id})")
                else:
                    print(f"  ❌ Conversation continuation failed: {continue_response.status_code}")
            else:
                print(f"\n💾 Conversation Handling: ❌ No conversation_id returned")
            
            print(f"\n📊 Full Response JSON (truncated):")
            print(json.dumps(response_json, indent=2)[:1500] + "...")
            
        elif response.status_code == 503:
            print(f"\n⚠️ 503 Service Unavailable Response:")
            error_text = response.text
            print(f"Error: {error_text}")
            
            if "AI provider keys" in error_text or "not configured" in error_text:
                print("✅ This is the EXPECTED graceful fallback for missing AI provider keys in preview env")
            else:
                print("❌ Unexpected 503 error message")
        else:
            print(f"\n❌ Unexpected Response:")
            print(f"Status: {response.status_code}")
            print(f"Body: {response.text}")
        
        # Test conversations list endpoint
        print(f"\n📋 Testing conversations list endpoint...")
        conv_response = await client.get(f"{BASE_URL}/soundboard/conversations", headers=headers)
        
        if conv_response.status_code == 200:
            conv_data = conv_response.json()
            conversations = conv_data.get("conversations", [])
            print(f"✅ Conversations endpoint: Status 200")
            print(f"✅ Conversations count: {len(conversations)}")
            
            if conversations:
                first_conv = conversations[0]
                print(f"✅ First conversation structure: {list(first_conv.keys())}")
        else:
            print(f"❌ Conversations endpoint failed: {conv_response.status_code}")
        
        print("\n" + "=" * 50)
        print("🎯 RESPONSE ANALYSIS COMPLETE")
        print("=" * 50)

if __name__ == "__main__":
    asyncio.run(analyze_soundboard_responses())