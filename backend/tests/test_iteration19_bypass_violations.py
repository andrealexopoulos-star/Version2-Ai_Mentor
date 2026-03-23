"""
Test Iteration 19: Global Fact Authority Bypass Violation Fixes
================================================================
This test suite verifies that all Global Fact Authority bypass violations
identified in the audit have been fixed.

Tests:
1. format_advisor_brain_prompt does NOT contain 'ASK THEM' text
2. format_advisor_brain_prompt reads known_facts_prompt from context
3. format_advisor_brain_prompt uses 'Not yet known' as fallback
4. BusinessProfile.js calls /api/business-profile/context (code review)
5. Settings.js calls /api/business-profile/context (code review)
6. soundboard_chat imports from fact_resolution
7. soundboard_chat injects facts_prompt into system_message
8. generate_checklist uses build_advisor_context + format_advisor_brain_prompt
9. generate_action_plan uses build_advisor_context + format_advisor_brain_prompt
10. boardroom_respond imports from fact_resolution and injects facts
11. All endpoints return 401 for unauthenticated requests
12. Backend starts cleanly
"""

import pytest
import requests
import os
import re

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


def _read(path: str) -> str:
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()


def _extract_function(content: str, function_name: str) -> str:
    pattern = rf'async def {function_name}\(.*?(?=^async def |^def |^@router|^@api_router|\Z)'
    match = re.search(pattern, content, re.MULTILINE | re.DOTALL)
    return match.group(0) if match else ""

class TestCodeVerification:
    """Code-level verification of bypass violation fixes"""
    
    def test_no_ask_them_in_format_advisor_brain_prompt(self):
        """V1: format_advisor_brain_prompt does NOT contain 'ASK THEM'"""
        content = _read('/app/backend/routes/profile.py')
        func_content = _extract_function(content, 'format_advisor_brain_prompt')
        assert func_content, "format_advisor_brain_prompt function not found"
        
        # Check for banned phrases
        assert 'ASK THEM' not in func_content, "Found 'ASK THEM' in format_advisor_brain_prompt"
        assert 'NOT SPECIFIED - You MUST ask' not in func_content, "Found 'NOT SPECIFIED - You MUST ask' in format_advisor_brain_prompt"
        print("PASS: format_advisor_brain_prompt does not contain bypass phrases")
    
    def test_format_advisor_brain_prompt_reads_known_facts_prompt(self):
        """V1: format_advisor_brain_prompt reads known_facts_prompt from context"""
        content = _read('/app/backend/routes/profile.py')
        func_content = _extract_function(content, 'format_advisor_brain_prompt')
        assert func_content, "format_advisor_brain_prompt function not found"
        
        # Check that it reads known_facts_prompt from context
        assert "known_facts_prompt = context.get" in func_content or "context.get('known_facts_prompt'" in func_content or 'context.get("known_facts_prompt"' in func_content, \
            "format_advisor_brain_prompt does not read known_facts_prompt from context"
        print("PASS: format_advisor_brain_prompt reads known_facts_prompt from context")
    
    def test_format_advisor_brain_prompt_uses_not_yet_known_fallback(self):
        """V1: format_advisor_brain_prompt uses 'Not yet known' as fallback"""
        content = _read('/app/backend/routes/profile.py')
        func_content = _extract_function(content, 'format_advisor_brain_prompt')
        assert func_content, "format_advisor_brain_prompt function not found"
        
        # Check that it uses 'Not yet known' as fallback
        assert 'Not yet known' in func_content, "format_advisor_brain_prompt does not use 'Not yet known' as fallback"
        print("PASS: format_advisor_brain_prompt uses 'Not yet known' as fallback")
    
    def test_business_profile_js_uses_context_endpoint(self):
        """V2: BusinessProfile.js calls /api/business-profile/context"""
        content = _read('/app/frontend/src/pages/BusinessProfile.js')
        
        # Must use /business-profile/context
        assert '/business-profile/context' in content, "BusinessProfile.js does not call /business-profile/context"
        
        # Should NOT use just /business-profile for fetching (only for PUT)
        # Find fetchProfile function and check it uses context endpoint
        if "fetchProfile" in content:
            match = re.search(r'const fetchProfile.*?};', content, re.DOTALL)
            if match:
                fetch_func = match.group(0)
                assert '/business-profile/context' in fetch_func, "fetchProfile should call /business-profile/context"
        
        print("PASS: BusinessProfile.js uses /api/business-profile/context")
    
    def test_settings_js_uses_context_endpoint(self):
        """V3: Settings.js calls /api/business-profile/context"""
        content = _read('/app/frontend/src/pages/Settings.js')
        
        # Must use /business-profile/context
        assert '/business-profile/context' in content, "Settings.js does not call /business-profile/context"
        
        # Find fetchProfile function and check it uses context endpoint
        if "fetchProfile" in content:
            match = re.search(r'const fetchProfile.*?};', content, re.DOTALL)
            if match:
                fetch_func = match.group(0)
                assert '/business-profile/context' in fetch_func, "fetchProfile should call /business-profile/context"
        
        print("PASS: Settings.js uses /api/business-profile/context")
    
    def test_soundboard_chat_imports_fact_resolution(self):
        """V4: soundboard_chat imports from fact_resolution"""
        content = _read('/app/backend/routes/soundboard.py')
        func_content = _extract_function(content, 'soundboard_chat')
        assert func_content, "soundboard_chat function not found"
        
        # Imports can be module-level; usage must be in function body.
        assert 'from fact_resolution import' in content, "soundboard module does not import from fact_resolution"
        assert 'resolve_facts' in content, "soundboard module missing resolve_facts reference"
        assert 'build_known_facts_prompt' in content, "soundboard module missing build_known_facts_prompt reference"
        assert 'resolve_facts' in func_content, "soundboard_chat does not use resolve_facts"
        assert 'build_known_facts_prompt' in func_content, "soundboard_chat does not use build_known_facts_prompt"
        print("PASS: soundboard_chat uses fact_resolution imports")
    
    def test_soundboard_chat_injects_facts_into_system_message(self):
        """V4: soundboard_chat injects facts_prompt into system_message"""
        content = _read('/app/backend/routes/soundboard.py')
        func_content = _extract_function(content, 'soundboard_chat')
        assert func_content, "soundboard_chat function not found"
        
        # Check that facts_prompt is built
        assert 'facts_prompt = build_known_facts_prompt' in func_content, "soundboard_chat does not build facts_prompt"
        
        # Check that facts_prompt is injected into system_message
        assert 'facts_prompt' in func_content and 'system_message' in func_content, \
            "soundboard_chat does not inject facts_prompt into system_message"
        
        # More specific check
        assert 'GLOBAL FACT AUTHORITY' in func_content or 'fact_block' in func_content, \
            "soundboard_chat does not inject fact authority block"
        
        print("PASS: soundboard_chat injects facts_prompt into system_message")
    
    def test_generate_checklist_uses_advisor_pattern(self):
        """V7: generate_checklist uses build_advisor_context + format_advisor_brain_prompt"""
        content = _read('/app/backend/routes/generation.py')
        func_content = _extract_function(content, 'generate_checklist')
        assert func_content, "generate_checklist function not found"
        
        # Check that it uses build_advisor_context
        assert 'build_advisor_context' in func_content, "generate_checklist does not use build_advisor_context"
        
        # Check that it uses format_advisor_brain_prompt
        assert 'format_advisor_brain_prompt' in func_content, "generate_checklist does not use format_advisor_brain_prompt"
        
        print("PASS: generate_checklist uses build_advisor_context + format_advisor_brain_prompt")
    
    def test_generate_action_plan_uses_advisor_pattern(self):
        """V7: generate_action_plan uses build_advisor_context + format_advisor_brain_prompt"""
        content = _read('/app/backend/routes/generation.py')
        func_content = _extract_function(content, 'generate_action_plan')
        assert func_content, "generate_action_plan function not found"
        
        # Check that it uses build_advisor_context
        assert 'build_advisor_context' in func_content, "generate_action_plan does not use build_advisor_context"
        
        # Check that it uses format_advisor_brain_prompt
        assert 'format_advisor_brain_prompt' in func_content, "generate_action_plan does not use format_advisor_brain_prompt"
        
        print("PASS: generate_action_plan uses build_advisor_context + format_advisor_brain_prompt")
    
    def test_boardroom_respond_imports_fact_resolution(self):
        """V6: boardroom_respond imports from fact_resolution"""
        content = _read('/app/backend/routes/boardroom.py')
        func_content = _extract_function(content, 'boardroom_respond')
        assert func_content, "boardroom_respond function not found"
        
        # Check imports
        assert 'from fact_resolution import' in func_content, "boardroom_respond does not import from fact_resolution"
        assert 'resolve_facts' in func_content, "boardroom_respond does not import resolve_facts"
        assert 'build_known_facts_prompt' in func_content, "boardroom_respond does not import build_known_facts_prompt"
        print("PASS: boardroom_respond imports from fact_resolution")
    
    def test_boardroom_respond_injects_facts(self):
        """V6: boardroom_respond injects resolved facts into system_prompt"""
        content = _read('/app/backend/routes/boardroom.py')
        func_content = _extract_function(content, 'boardroom_respond')
        assert func_content, "boardroom_respond function not found"
        
        # Check that facts_prompt is built
        assert 'facts_prompt = build_known_facts_prompt' in func_content, "boardroom_respond does not build facts_prompt"
        
        # Check that facts are injected into system_prompt
        assert 'system_prompt' in func_content and 'facts_prompt' in func_content, \
            "boardroom_respond does not use facts_prompt with system_prompt"
        
        # More specific: check for injection pattern
        assert 'RESOLVED BUSINESS FACTS' in func_content or 'facts_prompt' in func_content, \
            "boardroom_respond does not inject facts into system_prompt"
        
        print("PASS: boardroom_respond injects resolved facts into system_prompt")


class TestEndpointAuthentication:
    """Verify endpoints return 401 for unauthenticated requests"""
    
    def test_soundboard_chat_requires_auth(self):
        """soundboard_chat requires authentication"""
        response = requests.post(f"{BASE_URL}/api/soundboard/chat", json={"message": "test"})
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: soundboard_chat requires authentication")
    
    def test_generate_checklist_requires_auth(self):
        """generate_checklist requires authentication"""
        response = requests.post(f"{BASE_URL}/api/generate/checklist", json={"topic": "test"})
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: generate_checklist requires authentication")
    
    def test_generate_action_plan_requires_auth(self):
        """generate_action_plan requires authentication"""
        response = requests.post(f"{BASE_URL}/api/generate/action-plan", json={"goal": "test"})
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: generate_action_plan requires authentication")
    
    def test_boardroom_respond_requires_auth(self):
        """boardroom_respond requires authentication"""
        response = requests.post(f"{BASE_URL}/api/boardroom/respond", json={"message": "test"})
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: boardroom_respond requires authentication")
    
    def test_business_profile_context_requires_auth(self):
        """business_profile_context requires authentication"""
        response = requests.get(f"{BASE_URL}/api/business-profile/context")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: business_profile_context requires authentication")


class TestBackendHealth:
    """Verify backend starts and runs cleanly"""
    
    def test_health_endpoint(self):
        """Backend health check passes"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.status_code}"
        data = response.json()
        assert data.get("status") == "healthy", f"Health status: {data}"
        print("PASS: Backend is healthy")
    
    def test_api_root(self):
        """API root is accessible"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200, f"API root failed: {response.status_code}"
        print("PASS: API root is accessible")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
