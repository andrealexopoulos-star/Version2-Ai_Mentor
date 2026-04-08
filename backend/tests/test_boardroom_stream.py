from pathlib import Path
import sys
from unittest.mock import MagicMock, patch
import pytest

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

try:
    import boardroom_conversations as brc
except Exception:  # pragma: no cover
    brc = None

try:
    from routes import boardroom as boardroom_routes
except Exception:  # pragma: no cover
    boardroom_routes = None


ROOT = Path(__file__).resolve().parents[2]
ROUTE_PATH = ROOT / "backend" / "routes" / "boardroom.py"


def _source() -> str:
    return ROUTE_PATH.read_text(encoding="utf-8")


def test_stream_endpoints_exist_in_source():
    src = _source()
    assert '@router.post("/boardroom/diagnosis/stream")' in src
    assert '@router.post("/war-room/respond/stream")' in src
    assert "async def stream_boardroom_diagnosis(" in src
    assert "async def stream_war_room_respond(" in src


def test_stream_event_contract_literals_present():
    src = _source()
    assert "async def _sse_event(" in src
    assert '"start"' in src
    assert '"delta"' in src
    assert '"complete"' in src
    assert '"error"' in src
    assert '"truth_gate"' in src


def test_streaming_response_contract_is_event_stream():
    src = _source()
    assert "StreamingResponse(" in src
    assert 'media_type="text/event-stream"' in src
    assert '"Cache-Control": "no-cache"' in src
    assert '"X-Accel-Buffering": "no"' in src


def test_stream_preserves_rate_limiting_calls():
    src = _source()
    assert 'check_rate_limit(user_id, "boardroom_diagnosis", sb)' in src
    assert 'check_rate_limit(user_id, "war_room_ask", sb)' in src


def test_stream_uses_expected_edge_functions():
    src = _source()
    assert "/functions/v1/boardroom-diagnosis" in src
    assert "/functions/v1/strategic-console-ai" in src


def test_stream_rejects_invalid_input_contracts():
    src = _source()
    assert 'raise HTTPException(status_code=400, detail="Invalid focus_area")' in src
    assert 'raise HTTPException(status_code=400, detail="question is required")' in src


def test_stream_requires_authentication_contracts():
    src = _source()
    auth_line = 'raise HTTPException(status_code=401, detail="Authentication required")'
    assert src.count(auth_line) >= 4


def test_stream_uses_chunking_and_delay():
    src = _source()
    assert "chunk_size = 40" in src
    assert "await asyncio.sleep(0.025)" in src


def test_import_style_contract():
    src = _source()
    assert "from fastapi.responses import StreamingResponse" in src
    assert "import json" in src


def test_module_exports_if_importable():
    if boardroom_routes is None:
        pytest.skip("boardroom route module import unavailable in sandbox")
    assert hasattr(boardroom_routes, "stream_boardroom_diagnosis")
    assert hasattr(boardroom_routes, "stream_war_room_respond")
    assert brc is None or hasattr(brc, "create_conversation")
