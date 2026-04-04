from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
SOUNDBOARD_PATH = REPO_ROOT / "backend" / "routes" / "soundboard.py"
EDGE_QUERY_PATH = REPO_ROOT / "supabase" / "functions" / "query-integrations-data" / "index.ts"


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_soundboard_has_report_grade_request_detector():
    content = _read(SOUNDBOARD_PATH)
    assert "def _is_report_grade_request" in content
    assert "board report|board pack" in content
    assert "(last|past)\\s+(12|twelve)" in content


def test_soundboard_requires_window_depth_for_report_readiness():
    content = _read(SOUNDBOARD_PATH)
    assert "def _report_window_meets_target" in content
    assert "grounded_report_ready = (" in content
    assert "_report_window_meets_target(coverage_window, min_days=330)" in content
    assert "not bool((coverage_window or {}).get(\"missing_periods\"))" in content


def test_soundboard_has_honest_report_grounding_block_copy():
    content = _read(SOUNDBOARD_PATH)
    assert "Provisional 12-month report (best available data):" in content
    assert "strongest report possible from current data" in content


def test_soundboard_returns_report_grounding_flags():
    content = _read(SOUNDBOARD_PATH)
    assert '"grounded_report_ready": grounded_report_ready' in content
    assert '"report_grade_request": report_grade_request' in content
    assert 'def _build_retrieval_contract(' in content
    assert '"retrieval_contract": retrieval_contract' in content
    assert '"retrieval_mode"' in content
    assert '"answer_grade"' in content
    assert '"email_retrieval"' in content
    assert '"calendar_retrieval"' in content
    assert '"custom_retrieval"' in content
    assert 'FORENSIC_REPORT_MODE_VERSION' in content
    assert 'def _build_forensic_report_payload(' in content
    assert '"forensic_report": forensic_report' in content


def test_unified_intelligence_exposes_domain_retrieval_depth():
    ui_path = REPO_ROOT / "backend" / "routes" / "unified_intelligence.py"
    content = _read(ui_path)
    assert "def _fetch_supabase_paged(" in content
    assert "'email': {\"start\": None, \"end\": None}," in content
    assert "'calendar': {\"start\": None, \"end\": None}," in content
    assert "'custom': {\"start\": None, \"end\": None}," in content
    assert "outlook_calendar_events" in content
    assert "get_tickets" in content


def test_edge_query_defers_executive_report_requests():
    content = _read(EDGE_QUERY_PATH)
    assert "type: 'executive_report'" in content
    assert "status: 'defer_to_soundboard'" in content
    assert "Report-grade requests require the full BIQc Soundboard runtime" in content
    assert content.index("classification.type === 'executive_report'") < content.index("const missingSource = classification.sources.find")


def test_edge_query_uses_openai_compatible_model():
    content = _read(EDGE_QUERY_PATH)
    assert 'https://api.openai.com/v1/chat/completions' in content
    assert 'model: "gpt-4o-mini"' in content


def test_soundboard_stream_contract_emits_extended_events():
    content = _read(SOUNDBOARD_PATH)
    assert 'else "synthetic"' in content
    assert 'stream_mode": "live_openai"' in content
    assert '"tool_start"' in content
    assert '"tool_result"' in content
    assert '_sse_event("error"' in content


def test_soundboard_conversation_detail_preserves_forensic_artifacts():
    content = _read(SOUNDBOARD_PATH)
    assert "role, content, timestamp, evidence_pack, boardroom_trace, metadata" in content
