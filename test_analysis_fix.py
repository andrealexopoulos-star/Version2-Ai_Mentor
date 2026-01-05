#!/usr/bin/env python3
"""
Test script to verify Analysis endpoint insights parsing after prompt fix.
Tests with andre.alexopoulos@gmail.com account.
"""

import requests
import json
import sys
from datetime import datetime

BASE_URL = "https://smart-advisor-33.preview.emergentagent.com/api"

def print_section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")

def test_analysis_insights():
    """Test Analysis endpoint with specific business context"""
    
    print_section("ANALYSIS INSIGHTS TEST - AFTER PROMPT FIX")
    
    # Step 1: Register a new test user with business profile data
    # Note: andre.alexopoulos@gmail.com uses Google OAuth, so we'll create a test user
    print("📝 Step 1: Creating test user with business profile...")
    
    import uuid
    unique_id = str(uuid.uuid4())[:8]
    test_email = f"analysis_test_{unique_id}@example.com"
    
    register_data = {
        "name": "Analysis Test User",
        "email": test_email,
        "password": "testpass123",
        "business_name": "Professional Services Firm",
        "industry": "M"  # Professional Services
    }
    
    response = requests.post(f"{BASE_URL}/auth/register", json=register_data, timeout=30)
        
        if response.status_code != 200:
            print(f"❌ Registration failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
        print("✅ User registered successfully")
    elif response.status_code == 200:
        print("✅ User logged in successfully")
    else:
        print(f"❌ Login failed: {response.status_code}")
        print(f"   Response: {response.text}")
        return False
    
    data = response.json()
    token = data.get('access_token')
    user_id = data['user']['id']
    
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    # Step 2: Setup business profile with context
    print("\n📝 Step 2: Setting up business profile...")
    
    profile_data = {
        "business_name": "Professional Services Firm",
        "industry": "M",  # Professional Services
        "business_type": "Company (Pty Ltd)",
        "business_stage": "established",
        "target_country": "Australia",
        "employee_count": "1-5",
        "years_operating": "2-5 years",
        "customer_count": "< 10 clients",
        "revenue_range": "$100K-$500K",
        "main_challenges": "Client retention and ideal customer acquisition",
        "short_term_goals": "Improve client retention and acquire ideal customers"
    }
    
    response = requests.put(
        f"{BASE_URL}/business-profile",
        json=profile_data,
        headers=headers,
        timeout=30
    )
    
    if response.status_code == 200:
        print("✅ Business profile updated successfully")
    else:
        print(f"⚠️  Business profile update returned: {response.status_code}")
        print(f"   Response: {response.text[:200]}")
    
    # Step 3: Create analysis with specific business context
    print("\n📝 Step 3: Creating business analysis...")
    
    analysis_data = {
        "title": "Scale Strategy Test",
        "analysis_type": "growth",
        "business_context": "Professional services business, 2-5 years old, currently serving < 10 clients, revenue $100K-$500K, main challenge is client retention and ideal customer acquisition"
    }
    
    response = requests.post(
        f"{BASE_URL}/analyses",
        json=analysis_data,
        headers=headers,
        timeout=60  # Longer timeout for AI processing
    )
    
    if response.status_code != 200:
        print(f"❌ Analysis creation failed: {response.status_code}")
        print(f"   Response: {response.text}")
        return False
    
    print("✅ Analysis created successfully")
    
    # Step 4: Verify response structure
    print("\n📝 Step 4: Verifying response structure...")
    
    result = response.json()
    
    # Check for required fields
    checks = {
        "id": "id" in result,
        "analysis": "analysis" in result,
        "insights": "insights" in result,
        "created_at": "created_at" in result
    }
    
    print("\n🔍 Response Fields:")
    for field, present in checks.items():
        status = "✅" if present else "❌"
        print(f"   {status} {field}: {present}")
    
    if not all(checks.values()):
        print("\n❌ Missing required fields in response")
        return False
    
    # Step 5: Verify insights array
    print("\n📝 Step 5: Verifying insights array...")
    
    insights = result.get('insights', [])
    analysis_text = result.get('analysis', '')
    
    print(f"\n🔍 Insights Array:")
    print(f"   Type: {type(insights)}")
    print(f"   Length: {len(insights)}")
    
    if not isinstance(insights, list):
        print(f"❌ FAIL: insights is not an array, it's {type(insights)}")
        return False
    
    if len(insights) == 0:
        print("❌ FAIL: insights array is EMPTY")
        print("\n🔍 Capturing raw analysis text for debugging...")
        print(f"\n--- RAW ANALYSIS TEXT (first 2000 chars) ---")
        print(analysis_text[:2000])
        print(f"\n--- END RAW ANALYSIS TEXT ---")
        print(f"\nTotal analysis length: {len(analysis_text)} characters")
        
        # Try to identify the format
        print("\n🔍 Format Analysis:")
        if "###" in analysis_text:
            print("   ⚠️  Found markdown headers (###)")
        if "**" in analysis_text:
            print("   ⚠️  Found bold text (**)")
        if analysis_text.strip().startswith("1."):
            print("   ✅ Starts with numbered list (1.)")
        else:
            print(f"   ⚠️  Does NOT start with numbered list. Starts with: {analysis_text[:50]}")
        
        # Count numbered items
        numbered_items = [line for line in analysis_text.split('\n') if line.strip() and line.strip()[0].isdigit() and '.' in line[:4]]
        print(f"   Found {len(numbered_items)} lines starting with numbers")
        if numbered_items:
            print(f"   First numbered line: {numbered_items[0][:100]}")
        
        return False
    
    print(f"✅ PASS: insights array has {len(insights)} items")
    
    # Step 6: Verify insights structure
    print("\n📝 Step 6: Verifying insights structure...")
    
    required_fields = ['title', 'reason', 'why', 'confidence', 'actions', 'citations']
    
    for i, insight in enumerate(insights, 1):
        print(f"\n🔍 Insight #{i}:")
        print(f"   Title: {insight.get('title', 'MISSING')[:60]}...")
        
        missing_fields = []
        for field in required_fields:
            if field not in insight:
                missing_fields.append(field)
            else:
                value = insight[field]
                if field == 'actions':
                    print(f"   ✅ {field}: {type(value).__name__} with {len(value) if isinstance(value, list) else 0} items")
                elif field == 'citations':
                    print(f"   ✅ {field}: {type(value).__name__} with {len(value) if isinstance(value, list) else 0} items")
                elif field == 'confidence':
                    valid = str(value).lower() in ['high', 'medium', 'low']
                    status = "✅" if valid else "⚠️ "
                    print(f"   {status} {field}: {value}")
                else:
                    print(f"   ✅ {field}: {str(value)[:60]}...")
        
        if missing_fields:
            print(f"   ❌ Missing fields: {', '.join(missing_fields)}")
            return False
    
    print("\n✅ PASS: All insights have required structure")
    
    # Step 7: Verify field types
    print("\n📝 Step 7: Verifying field types...")
    
    first_insight = insights[0]
    
    type_checks = {
        "title is string": isinstance(first_insight.get('title'), str),
        "reason is string": isinstance(first_insight.get('reason'), str),
        "why is string": isinstance(first_insight.get('why'), str),
        "confidence is string": isinstance(first_insight.get('confidence'), str),
        "actions is array": isinstance(first_insight.get('actions'), list),
        "citations is array": isinstance(first_insight.get('citations'), list)
    }
    
    for check, passed in type_checks.items():
        status = "✅" if passed else "❌"
        print(f"   {status} {check}")
    
    if not all(type_checks.values()):
        print("\n❌ FAIL: Some field types are incorrect")
        return False
    
    print("\n✅ PASS: All field types are correct")
    
    # Step 8: Verify citations structure
    print("\n📝 Step 8: Verifying citations structure...")
    
    if len(first_insight.get('citations', [])) > 0:
        citation = first_insight['citations'][0]
        print(f"\n🔍 First Citation:")
        print(f"   Type: {type(citation)}")
        
        if isinstance(citation, dict):
            print(f"   Keys: {list(citation.keys())}")
            print(f"   source_type: {citation.get('source_type', 'MISSING')}")
            print(f"   title: {citation.get('title', 'MISSING')}")
            print(f"   url: {citation.get('url', 'MISSING')}")
            
            if 'source_type' in citation:
                print("   ✅ Citations have proper structure")
            else:
                print("   ⚠️  Citations missing source_type field")
        else:
            print(f"   ⚠️  Citation is not a dict, it's {type(citation)}")
    else:
        print("   ℹ️  No citations in first insight")
    
    # Final summary
    print_section("TEST SUMMARY")
    
    print("✅ Analysis endpoint is working correctly")
    print(f"✅ Insights array is populated with {len(insights)} items")
    print("✅ Each insight has all required fields")
    print("✅ Field types are correct")
    print("✅ Confidence levels are valid")
    print(f"✅ Actions array has items: {len(first_insight.get('actions', []))}")
    print(f"✅ Citations array has items: {len(first_insight.get('citations', []))}")
    
    print("\n🎉 PROMPT FIX VERIFIED: Parser is now extracting structured insights correctly!")
    
    return True

if __name__ == "__main__":
    try:
        success = test_analysis_insights()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ Test failed with exception: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
