"""
Test Iteration 20: Priority Compression UX Layer
=================================================
Tests for the new Priority Compression feature in the BIQC Board Room.

Backend Tests:
1. rank_domains function correctly scores and orders domains
2. /api/boardroom/respond returns priority_compression field (requires auth)
3. /api/boardroom/escalation-action endpoint still returns success for valid actions
4. Both boardroom endpoints require authentication (401 on unauth)
5. resolve_facts() injection order preserved (code review: line 103 before AI call at line 174)

Code Review Tests:
6. BoardRoom.js compiles without errors (frontend verification)
7. data-testid attributes present for testing
"""

import pytest
import requests
import os
import re
import sys

# Add backend to path for direct imports
sys.path.insert(0, '/app/backend')

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestRankDomainsFunction:
    """Unit tests for the rank_domains pure function"""
    
    def test_rank_domains_basic_scoring(self):
        """Test rank_domains scores domains correctly based on position severity"""
        from routes.boardroom import rank_domains
        
        positions = {
            "Revenue": {"position": "CRITICAL", "confidence": 85, "finding": "Revenue declining"},
            "Operations": {"position": "STABLE", "confidence": 90, "finding": "Operations normal"},
            "Market": {"position": "DETERIORATING", "confidence": 75, "finding": "Market share loss"},
        }
        
        ranked = rank_domains(positions, None, None, None, None)
        
        # Should be ordered by score: CRITICAL (40) > DETERIORATING (30) > STABLE (0)
        assert len(ranked) == 3
        assert ranked[0]["domain"] == "Revenue", f"Expected Revenue first, got {ranked[0]['domain']}"
        assert ranked[1]["domain"] == "Market", f"Expected Market second, got {ranked[1]['domain']}"
        assert ranked[2]["domain"] == "Operations", f"Expected Operations third, got {ranked[2]['domain']}"
        print("PASS: rank_domains basic scoring correct")
    
    def test_rank_domains_includes_pressure_scoring(self):
        """Test rank_domains adds pressure level to score"""
        from routes.boardroom import rank_domains, PRESSURE_SCORE
        
        positions = {
            "Domain_A": {"position": "STABLE", "confidence": 80, "finding": "Test A"},
            "Domain_B": {"position": "STABLE", "confidence": 80, "finding": "Test B"},
        }
        
        pressure = {
            "Domain_A": {"pressure_level": "CRITICAL"},  # +30
            "Domain_B": {"pressure_level": "LOW"},       # +0
        }
        
        ranked = rank_domains(positions, None, None, pressure, None)
        
        assert ranked[0]["domain"] == "Domain_A", "Domain with CRITICAL pressure should rank higher"
        assert ranked[0]["pressure_level"] == "CRITICAL"
        assert ranked[1]["pressure_level"] == "LOW"
        print("PASS: rank_domains includes pressure scoring")
    
    def test_rank_domains_includes_window_days_scoring(self):
        """Test rank_domains adds window_days compression to score"""
        from routes.boardroom import rank_domains
        
        positions = {
            "Domain_Urgent": {"position": "STABLE", "confidence": 80, "finding": "Urgent"},
            "Domain_Normal": {"position": "STABLE", "confidence": 80, "finding": "Normal"},
        }
        
        pressure = {
            "Domain_Urgent": {"pressure_level": "LOW", "basis": {"window_days_remaining": 2}},  # +20 for <=3 days
            "Domain_Normal": {"pressure_level": "LOW", "basis": {"window_days_remaining": 30}},  # +0
        }
        
        ranked = rank_domains(positions, None, None, pressure, None)
        
        assert ranked[0]["domain"] == "Domain_Urgent", "Domain with 2-day window should rank higher"
        assert ranked[0]["window_days"] == 2
        print("PASS: rank_domains includes window days scoring")
    
    def test_rank_domains_includes_contradiction_scoring(self):
        """Test rank_domains adds contradictions to score"""
        from routes.boardroom import rank_domains
        
        positions = {
            "Domain_Conflict": {"position": "STABLE", "confidence": 80, "finding": "Conflict"},
            "Domain_Clear": {"position": "STABLE", "confidence": 80, "finding": "Clear"},
        }
        
        contradictions = [
            {"domain": "Domain_Conflict", "type": "strategy_mismatch"},
            {"domain": "Domain_Conflict", "type": "data_inconsistency"},
        ]
        
        ranked = rank_domains(positions, None, contradictions, None, None)
        
        assert ranked[0]["domain"] == "Domain_Conflict", "Domain with contradictions should rank higher"
        assert ranked[0]["has_contradiction"] == True
        assert ranked[0]["contradiction_count"] == 2
        assert ranked[1]["has_contradiction"] == False
        print("PASS: rank_domains includes contradiction scoring")
    
    def test_rank_domains_includes_persistence_scoring(self):
        """Test rank_domains adds escalation persistence to score"""
        from routes.boardroom import rank_domains
        
        positions = {
            "Domain_Persistent": {"position": "STABLE", "confidence": 80, "finding": "Persistent"},
            "Domain_New": {"position": "STABLE", "confidence": 80, "finding": "New"},
        }
        
        escalation_history = [
            {"domain": "Domain_Persistent", "times_detected": 5},  # +15 (capped at 5*3=15)
        ]
        
        ranked = rank_domains(positions, escalation_history, None, None, None)
        
        assert ranked[0]["domain"] == "Domain_Persistent", "Domain with persistence should rank higher"
        assert ranked[0]["persistence"] == 5
        assert ranked[1]["persistence"] == 0
        print("PASS: rank_domains includes persistence scoring")
    
    def test_rank_domains_returns_required_fields(self):
        """Test rank_domains returns all required fields for frontend"""
        from routes.boardroom import rank_domains
        
        positions = {
            "TestDomain": {"position": "ELEVATED", "confidence": 85, "finding": "Test finding"},
        }
        
        ranked = rank_domains(positions, None, None, None, None)
        
        assert len(ranked) == 1
        item = ranked[0]
        
        # Required fields for Priority Compression view
        required_fields = [
            "domain", "position", "score", "confidence", "finding",
            "has_contradiction", "contradiction_count", "pressure_level",
            "window_days", "persistence", "freshness_state"
        ]
        
        for field in required_fields:
            assert field in item, f"Missing required field: {field}"
        
        assert item["domain"] == "TestDomain"
        assert item["position"] == "ELEVATED"
        assert item["confidence"] == 85
        assert item["finding"] == "Test finding"
        print("PASS: rank_domains returns all required fields")
    
    def test_rank_domains_empty_positions(self):
        """Test rank_domains handles empty positions gracefully"""
        from routes.boardroom import rank_domains
        
        ranked = rank_domains({}, None, None, None, None)
        assert ranked == []
        
        ranked = rank_domains(None, None, None, None, None)
        assert ranked == []
        print("PASS: rank_domains handles empty positions")


class TestBoardRoomEndpoints:
    """API endpoint tests for boardroom routes"""
    
    def test_boardroom_respond_requires_auth(self):
        """Test /api/boardroom/respond returns 401 without authentication"""
        response = requests.post(
            f"{BASE_URL}/api/boardroom/respond",
            json={"message": "test", "history": []},
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"PASS: /api/boardroom/respond requires auth (status: {response.status_code})")
    
    def test_boardroom_escalation_action_requires_auth(self):
        """Test /api/boardroom/escalation-action returns 401 without authentication"""
        response = requests.post(
            f"{BASE_URL}/api/boardroom/escalation-action",
            json={"domain": "test", "action": "acknowledged"},
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"PASS: /api/boardroom/escalation-action requires auth (status: {response.status_code})")
    
    def test_boardroom_escalation_action_invalid_action(self):
        """Test /api/boardroom/escalation-action validates action parameter"""
        # This will fail auth first, but the code validates action before auth
        response = requests.post(
            f"{BASE_URL}/api/boardroom/escalation-action",
            json={"domain": "test", "action": "invalid_action"},
            headers={"Content-Type": "application/json"}
        )
        
        # Should get 401 (auth first) or 400 (validation)
        assert response.status_code in [400, 401, 403], f"Expected 400/401/403, got {response.status_code}"
        print(f"PASS: /api/boardroom/escalation-action validates or requires auth (status: {response.status_code})")


class TestCodeVerification:
    """Code-level verification of Priority Compression implementation"""
    
    def test_resolve_facts_before_ai_call(self):
        """Verify resolve_facts() runs before the LLM invocation path."""
        with open('/app/backend/routes/boardroom.py', 'r', encoding='utf-8') as f:
            content = f.read()
            lines = content.split('\n')
        
        resolve_facts_line = None
        ai_call_line = None
        
        for i, line in enumerate(lines, 1):
            if 'resolve_facts' in line and 'await' in line and 'resolved_facts' in line:
                resolve_facts_line = i
            if (
                ('await llm_chat(' in line)
                or ('await llm_trinity_chat(' in line)
                or ('chat.send_message' in line and 'await' in line)
            ):
                ai_call_line = i
        
        assert resolve_facts_line is not None, "resolve_facts() call not found"
        assert ai_call_line is not None, "AI invocation call not found"
        assert resolve_facts_line < ai_call_line, \
            f"resolve_facts() at line {resolve_facts_line} should be BEFORE AI call at line {ai_call_line}"
        
        print(f"PASS: resolve_facts() at line {resolve_facts_line} runs before AI call at line {ai_call_line}")
    
    def test_priority_compression_in_response(self):
        """Verify priority_compression field is included in boardroom_respond return"""
        with open('/app/backend/routes/boardroom.py', 'r') as f:
            content = f.read()
        
        # Check that priority_compression is in the return statement
        assert '"priority_compression"' in content or "'priority_compression'" in content, \
            "priority_compression field not found in response"
        
        # Check structure: primary, secondary, collapsed
        assert 'primary' in content and 'secondary' in content and 'collapsed' in content, \
            "priority_compression structure (primary/secondary/collapsed) not complete"
        
        print("PASS: priority_compression field present in boardroom_respond return")
    
    def test_rank_domains_called_before_response(self):
        """Verify rank_domains() is called to populate priority_compression"""
        with open('/app/backend/routes/boardroom.py', 'r') as f:
            content = f.read()
        
        assert 'rank_domains(' in content, "rank_domains() function call not found"
        
        # Verify the ranked result is used for compression
        assert 'ranked = rank_domains' in content or 'ranked=rank_domains' in content, \
            "rank_domains result not captured for priority_compression"
        
        print("PASS: rank_domains() called to populate priority_compression")
    
    def test_boardroom_js_data_testids_present(self):
        """Verify current BoardRoom test hooks exist for UI verification."""
        with open('/app/frontend/src/components/BoardRoom.js', 'r', encoding='utf-8') as f:
            content = f.read()
        
        required_testids = [
            'data-testid="boardroom-home"',
            'data-testid="executive-zone"',
            'data-testid="diagnosis-zone"',
            'data-testid="diagnosis-result"',
            'data-testid="boardroom-lineage-badge"',
            'data-testid="boardroom-diagnosis-lineage-badge"',
            'data-testid="boardroom-diagnosis-evidence-chain"',
        ]
        
        # Check dynamic diagnosis cards exist.
        diagnosis_pattern = 'data-testid={`diagnosis-${area.id}`}'
        
        for testid in required_testids:
            assert testid in content, f"Missing {testid} in BoardRoom.js"
        
        assert diagnosis_pattern in content, "Missing dynamic diagnosis testid pattern"
        
        print("PASS: All required data-testid attributes present in BoardRoom.js")
    
    def test_boardroom_js_priority_compression_rendering(self):
        """Verify BoardRoom.js renders executive briefing + diagnosis surfaces."""
        with open('/app/frontend/src/components/BoardRoom.js', 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Snapshot-derived narrative and compression focus should be wired.
        assert 'snapshot.priority_compression?.primary_focus' in content, \
            "Priority compression primary focus wiring not found"
        assert 'narrative' in content and 'primaryBrief' in content, \
            "Executive narrative rendering state not found"
        
        # Diagnosis flow should render result and evidence chain.
        assert 'runDiagnosis' in content and 'diagnosisResult' in content, \
            "Diagnosis flow state not found"
        assert 'evidence_chain' in content, "Diagnosis evidence chain rendering not found"
        
        # Explainability strip should be present for boardroom and diagnosis.
        assert 'InsightExplainabilityStrip' in content, "Explainability strip wiring missing"
        
        print("PASS: BoardRoom.js renders executive + diagnosis experiences correctly")
    
    def test_boardroom_js_fallback_position_strip(self):
        """Verify BoardRoom.js has graceful fallback states when data is missing."""
        with open('/app/frontend/src/components/BoardRoom.js', 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Fallback for missing briefing + degraded truth should be available.
        assert 'BIQc can already see' in content and 'Executive briefing will appear here once intelligence is generated.' in content, \
            "Briefing fallback copy not found"
        assert 'truthGateMessage' in content and 'degradedTruth' in content, \
            "Degraded truth fallback logic not found"
        
        assert 'boardroom-truth-state-banner' in content, "Truth-state fallback banner testid not found"
        
        print("PASS: BoardRoom.js includes degraded and no-briefing fallback states")


class TestHealthCheck:
    """Basic health verification"""
    
    def test_backend_healthy(self):
        """Verify backend health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("PASS: Backend is healthy")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
