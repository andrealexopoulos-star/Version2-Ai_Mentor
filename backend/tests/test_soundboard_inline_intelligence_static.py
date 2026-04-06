from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
SOUNDBOARD_PATH = REPO_ROOT / "backend" / "routes" / "soundboard.py"
PANEL_PATH = REPO_ROOT / "frontend" / "src" / "components" / "SoundboardPanel.js"
RUNTIME_PATH = REPO_ROOT / "frontend" / "src" / "lib" / "soundboardRuntime.js"


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_backend_exposes_inline_data_requirement_helpers():
    content = _read(SOUNDBOARD_PATH)
    assert "def _assess_data_requirements(" in content
    assert "def _compute_data_coverage_pct(" in content
    assert '"id": "revenue_range"' in content
    assert '"id": "target_market"' in content
    assert '"id": "crm_connect"' in content
    assert '"id": "accounting_connect"' in content


def test_backend_has_resume_after_update_endpoint_and_contract():
    content = _read(SOUNDBOARD_PATH)
    assert "class ResumeConversationRequest(BaseModel):" in content
    assert '@router.post("/soundboard/resume-after-update")' in content
    assert '"status": "saved"' in content
    assert '"resume_message": resume_message' in content


def test_backend_never_blocks_low_coverage_replies():
    content = _read(SOUNDBOARD_PATH)
    assert "[GUARDRAIL_INLINE_CONTINUE]" in content
    assert 'guardrail_status = "DEGRADED"' in content
    assert '"data_requirements": data_requirements' in content
    assert '"data_coverage_pct": data_coverage_pct' in content


def test_frontend_renders_inline_requirements_and_resume_flow():
    panel = _read(PANEL_PATH)
    assert "function InlineDataRequirements(" in panel
    assert "function InlineFieldCapture(" in panel
    assert "function InlineIntegrationConnect(" in panel
    assert "function ConversationResumeCard(" in panel
    assert "/api/soundboard/resume-after-update" in panel
    assert "handleInlineResume" in panel
    assert "role: 'assistant_status'" in panel
    assert "role: 'resume_confirmation'" in panel
    assert "SHARPEN THIS RESPONSE" in panel
    assert "data_requirements: m.data_requirements || m?.metadata?.data_requirements || []" in panel


def test_frontend_panel_removes_legacy_blocking_gate():
    panel = _read(PANEL_PATH)
    assert "import DataCoverageGate" not in panel
    assert "getAskBiqcCoverageGate" not in panel
    assert "AskBiqcAssistantResponse" not in panel


def test_runtime_maps_inline_requirement_metadata():
    runtime = _read(RUNTIME_PATH)
    assert "data_requirements: responseData.data_requirements || []" in runtime
    assert "data_coverage_pct: responseData.data_coverage_pct" in runtime
