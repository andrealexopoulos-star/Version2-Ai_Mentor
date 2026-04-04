from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
ROUTING_HELPER_PATH = REPO_ROOT / "frontend" / "src" / "lib" / "soundboardQueryRouting.js"
MY_SOUNDBOARD_PATH = REPO_ROOT / "frontend" / "src" / "pages" / "MySoundBoard.js"
PANEL_PATH = REPO_ROOT / "frontend" / "src" / "components" / "SoundboardPanel.js"
FLOATING_PATH = REPO_ROOT / "frontend" / "src" / "components" / "FloatingSoundboard.js"


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_shared_routing_helper_exports_grounded_query_contract():
    content = _read(ROUTING_HELPER_PATH)
    assert "export function shouldUseGroundedDataQuery" in content
    assert "export function deriveSoundboardRequestScope" in content
    assert "isSoundboardDataQuery(message) && !isSoundboardReportQuery(message)" in content


def test_mysoundboard_uses_shared_grounded_query_helper():
    content = _read(MY_SOUNDBOARD_PATH)
    assert "deriveSoundboardRequestScope" in content
    assert "runAskBiqcTurn" in content


def test_soundboard_panel_uses_shared_grounded_query_helper_and_streaming():
    content = _read(PANEL_PATH)
    assert "deriveSoundboardRequestScope" in content
    assert "runAskBiqcTurn" in content
    assert "SOUND_BOARD_MODES" in content


def test_floating_soundboard_uses_shared_grounded_query_helper():
    content = _read(FLOATING_PATH)
    assert "shouldUseGroundedDataQuery" in content
    assert "if (shouldUseGroundedDataQuery(fullMessage))" in content


def test_panel_has_regenerate_and_edit_controls():
    panel = _read(PANEL_PATH)
    actions = _read(REPO_ROOT / "frontend" / "src" / "components" / "soundboard" / "AskBiqcMessageActions.js")
    assert "response_version" in panel
    assert "trace_root_id" in panel
    assert "Edit & resend" in actions
    assert "Regenerate" in actions


def test_soundboard_surfaces_render_retrieval_contract():
    panel = _read(PANEL_PATH)
    my_soundboard = _read(MY_SOUNDBOARD_PATH)
    runtime = _read(REPO_ROOT / "frontend" / "src" / "lib" / "soundboardRuntime.js")
    response_component = _read(REPO_ROOT / "frontend" / "src" / "components" / "soundboard" / "AskBiqcAssistantResponse.js")

    assert "retrieval_contract: m.retrieval_contract || m?.metadata?.retrieval_contract" in panel
    assert "retrieval_contract: m.retrieval_contract || m?.metadata?.retrieval_contract" in my_soundboard
    assert "retrieval_contract: responseData.retrieval_contract" in runtime
    assert "retrievalContract.retrieval_mode" in response_component
    assert "retrievalContract.answer_grade" in response_component
    assert "retrievalContract.email_retrieval" in response_component
    assert "retrievalContract.calendar_retrieval" in response_component
    assert "retrievalContract.custom_retrieval" in response_component
    assert "forensic_report: responseData.forensic_report" in runtime
    assert "forensicReport.citations" in response_component
    assert "ask-biqc-forensic-contradictions" in response_component
    assert "forensic_report_mode: Boolean(forensicReportMode)" in runtime
    assert "soundboard-deep-forensic-toggle" in my_soundboard
    assert "soundboard-panel-deep-forensic-toggle" in panel
