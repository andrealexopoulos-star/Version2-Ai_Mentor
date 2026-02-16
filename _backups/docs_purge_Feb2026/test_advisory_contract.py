#!/usr/bin/env python3
"""
Backend Test Script for MyAdvisor Advisory Intelligence Contract
Tests the code paths and data flow without requiring authentication
"""

import sys
import os

# Add backend to path
sys.path.insert(0, '/app/backend')

def test_imports():
    """Test that all imports work correctly"""
    print("🧪 TEST 1: Verifying imports...")
    try:
        import server
        from server import ChatRequest, get_system_prompt
        print("✅ All imports successful")
        return True
    except Exception as e:
        print(f"❌ Import failed: {e}")
        return False

def test_chat_request_model():
    """Test that ChatRequest model accepts metadata fields"""
    print("\n🧪 TEST 2: Verifying ChatRequest model...")
    try:
        from server import ChatRequest
        from pydantic import ValidationError
        
        # Test regular message
        regular_msg = ChatRequest(
            message="Test message",
            context_type="general"
        )
        print("✅ Regular message model works")
        
        # Test proactive message with metadata
        proactive_msg = ChatRequest(
            message="Proactive insight",
            context_type="proactive",
            trigger_source="Business Diagnosis",
            focus_area="Cash Flow",
            confidence_level="HIGH"
        )
        print("✅ Proactive message model with metadata works")
        
        # Verify metadata fields are accessible
        assert proactive_msg.trigger_source == "Business Diagnosis"
        assert proactive_msg.focus_area == "Cash Flow"
        assert proactive_msg.confidence_level == "HIGH"
        print("✅ Metadata fields are accessible")
        
        return True
    except Exception as e:
        print(f"❌ ChatRequest model test failed: {e}")
        return False

def test_get_system_prompt_signature():
    """Test that get_system_prompt accepts metadata parameter"""
    print("\n🧪 TEST 3: Verifying get_system_prompt function signature...")
    try:
        from server import get_system_prompt
        import inspect
        
        sig = inspect.signature(get_system_prompt)
        params = list(sig.parameters.keys())
        
        print(f"   Function parameters: {params}")
        
        # Verify metadata parameter exists
        assert 'metadata' in params, "metadata parameter missing"
        print("✅ metadata parameter exists")
        
        # Verify it's optional (has default value)
        assert sig.parameters['metadata'].default is not inspect.Parameter.empty, "metadata should be optional"
        print("✅ metadata parameter is optional")
        
        return True
    except Exception as e:
        print(f"❌ get_system_prompt signature test failed: {e}")
        return False

def test_system_prompt_generation():
    """Test system prompt generation for different context types"""
    print("\n🧪 TEST 4: Testing system prompt generation...")
    try:
        from server import get_system_prompt
        
        # Test general context (no metadata)
        general_prompt = get_system_prompt(
            context_type="general",
            user_data={"name": "Test User", "business_name": "Test Business"}
        )
        assert "MyAdvisor" in general_prompt
        assert "OUTPUT SHAPE" in general_prompt
        print("✅ General context prompt generated")
        
        # Test proactive context WITH metadata
        proactive_prompt = get_system_prompt(
            context_type="proactive",
            user_data={"name": "Test User", "business_name": "Test Business"},
            metadata={
                "trigger_source": "Business Diagnosis",
                "focus_area": "Cash Flow",
                "confidence_level": "HIGH"
            }
        )
        assert "PROACTIVE MESSAGE CONTRACT" in proactive_prompt
        assert "Business Diagnosis" in proactive_prompt
        assert "Cash Flow" in proactive_prompt
        assert "HIGH" in proactive_prompt
        print("✅ Proactive context prompt with metadata generated")
        
        # Test proactive context WITHOUT metadata (fail-safe)
        proactive_prompt_no_meta = get_system_prompt(
            context_type="proactive",
            user_data={"name": "Test User", "business_name": "Test Business"},
            metadata=None
        )
        assert "PROACTIVE MESSAGE CONTRACT" in proactive_prompt_no_meta
        # Should show 'Unknown' for missing metadata
        assert "Unknown" in proactive_prompt_no_meta
        print("✅ Proactive context prompt without metadata (fail-safe behavior)")
        
        return True
    except Exception as e:
        print(f"❌ System prompt generation test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_get_ai_response_signature():
    """Test that get_ai_response accepts metadata parameter"""
    print("\n🧪 TEST 5: Verifying get_ai_response function signature...")
    try:
        from server import get_ai_response
        import inspect
        
        sig = inspect.signature(get_ai_response)
        params = list(sig.parameters.keys())
        
        print(f"   Function parameters: {params}")
        
        # Verify metadata parameter exists
        assert 'metadata' in params, "metadata parameter missing"
        print("✅ metadata parameter exists in get_ai_response")
        
        # Verify it's optional (has default value)
        assert sig.parameters['metadata'].default is not inspect.Parameter.empty, "metadata should be optional"
        print("✅ metadata parameter is optional in get_ai_response")
        
        return True
    except Exception as e:
        print(f"❌ get_ai_response signature test failed: {e}")
        return False

def main():
    """Run all tests"""
    print("="*60)
    print("BIQC - MyAdvisor Advisory Intelligence Contract")
    print("Backend Unit Tests")
    print("="*60)
    
    tests = [
        test_imports,
        test_chat_request_model,
        test_get_system_prompt_signature,
        test_system_prompt_generation,
        test_get_ai_response_signature,
    ]
    
    results = []
    for test in tests:
        results.append(test())
    
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    passed = sum(results)
    total = len(results)
    print(f"Passed: {passed}/{total}")
    
    if passed == total:
        print("\n✅ ALL TESTS PASSED - Implementation is correct")
        print("\nNext step: Perform integration testing with curl")
        return 0
    else:
        print(f"\n❌ SOME TESTS FAILED - Review the errors above")
        return 1

if __name__ == "__main__":
    sys.exit(main())
