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
    assert "shouldUseGroundedDataQuery" in content
    assert "deriveSoundboardRequestScope" in content
    assert "if (shouldUseGroundedDataQuery(fullMessage))" in content


def test_soundboard_panel_uses_shared_grounded_query_helper_and_streaming():
    content = _read(PANEL_PATH)
    assert "shouldUseGroundedDataQuery" in content
    assert "deriveSoundboardRequestScope" in content
    assert "const streamSoundboardChat = async" in content
    assert "/api/soundboard/chat/stream" in content
    assert "SOUND_BOARD_MODES" in content


def test_floating_soundboard_uses_shared_grounded_query_helper():
    content = _read(FLOATING_PATH)
    assert "shouldUseGroundedDataQuery" in content
    assert "if (shouldUseGroundedDataQuery(fullMessage))" in content


def test_panel_has_regenerate_and_edit_controls():
    content = _read(PANEL_PATH)
    assert "Edit & resend" in content
    assert "Regenerate" in content
    assert "response_version" in content
    assert "trace_root_id" in content
