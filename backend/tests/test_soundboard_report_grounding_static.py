from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
SOUNDBOARD_PATH = REPO_ROOT / "backend" / "routes" / "soundboard.py"
EDGE_QUERY_PATH = REPO_ROOT / "supabase" / "functions" / "query-integrations-data" / "index.ts"


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_soundboard_has_report_grade_request_detector():
    content = _read(SOUNDBOARD_PATH)
    assert "def _is_report_grade_request" in content
    assert '"board report"' in content
    assert '"board pack"' in content
    assert '"last 12 months"' in content


def test_soundboard_requires_window_depth_for_report_readiness():
    content = _read(SOUNDBOARD_PATH)
    assert "def _report_window_meets_target" in content
    assert "grounded_report_ready = (" in content
    assert "_report_window_meets_target(coverage_window, min_days=330)" in content
    assert "not bool((coverage_window or {}).get(\"missing_periods\"))" in content


def test_soundboard_has_honest_report_grounding_block_copy():
    content = _read(SOUNDBOARD_PATH)
    assert "I can't truthfully generate a board report from live connector evidence yet." in content
    assert "defensible 12-month board pack" in content


def test_soundboard_returns_report_grounding_flags():
    content = _read(SOUNDBOARD_PATH)
    assert '"grounded_report_ready": grounded_report_ready' in content
    assert '"report_grade_request": report_grade_request' in content


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
