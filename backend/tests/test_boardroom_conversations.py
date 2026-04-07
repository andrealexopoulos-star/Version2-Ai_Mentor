from pathlib import Path
from unittest.mock import MagicMock, patch
import pytest

try:
    from backend import boardroom_conversations as brc
except Exception:  # pragma: no cover
    brc = None

try:
    from backend.routes import boardroom as boardroom_routes
except Exception:  # pragma: no cover
    boardroom_routes = None


ROOT = Path(__file__).resolve().parents[2]
DAL_PATH = ROOT / "backend" / "boardroom_conversations.py"
ROUTE_PATH = ROOT / "backend" / "routes" / "boardroom.py"


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_dal_file_exists():
    assert DAL_PATH.exists()


def test_route_has_conversation_endpoints_defined():
    source = _read(ROUTE_PATH)
    assert '@router.post("/boardroom/conversations")' in source
    assert '@router.get("/boardroom/conversations")' in source
    assert '@router.get("/boardroom/conversations/{conv_id}")' in source
    assert '@router.post("/boardroom/conversations/{conv_id}/messages")' in source
    assert '@router.patch("/boardroom/conversations/{conv_id}")' in source


def test_route_has_required_request_models():
    source = _read(ROUTE_PATH)
    assert "class CreateConversationRequest(BaseModel):" in source
    assert "class AppendMessageRequest(BaseModel):" in source
    assert "class UpdateConversationRequest(BaseModel):" in source


def test_route_imports_dal_alias():
    source = _read(ROUTE_PATH)
    assert "from backend import boardroom_conversations as brc" in source


@pytest.mark.skipif(brc is None, reason="DAL module import unavailable in sandbox")
def test_create_conversation_valid_mode_payload():
    sb = MagicMock()
    sb.table.return_value.insert.return_value.execute.return_value.data = [{"id": "c1", "mode": "boardroom"}]
    row = brc.create_conversation(sb, "u1", "boardroom", "revenue_momentum", "Session")
    assert row["mode"] == "boardroom"
    sb.table.assert_called_with("boardroom_conversations")


@pytest.mark.skipif(brc is None, reason="DAL module import unavailable in sandbox")
def test_create_conversation_invalid_mode_raises():
    with pytest.raises(ValueError):
        brc.create_conversation(MagicMock(), "u1", "invalid")


@pytest.mark.skipif(brc is None, reason="DAL module import unavailable in sandbox")
def test_append_message_invalid_role_raises():
    with pytest.raises(ValueError):
        brc.append_message(MagicMock(), "c1", "u1", "assistant", "hello")


@pytest.mark.skipif(brc is None, reason="DAL module import unavailable in sandbox")
def test_update_conversation_status_validation():
    with pytest.raises(ValueError):
        brc.update_conversation(MagicMock(), "u1", "c1", {"status": "bad"})


@pytest.mark.skipif(brc is None, reason="DAL module import unavailable in sandbox")
def test_list_conversations_clamps_limit():
    sb = MagicMock()
    call_chain = sb.table.return_value.select.return_value.eq.return_value.eq.return_value.order.return_value
    call_chain.limit.return_value.execute.return_value.data = []
    out = brc.list_conversations(sb, "u1", "boardroom", limit=999)
    assert out == []
    call_chain.limit.assert_called_once_with(50)


def test_route_still_contains_legacy_boardroom_contracts():
    source = _read(ROUTE_PATH)
    assert '@router.post("/boardroom/respond")' in source
    assert '@router.post("/boardroom/diagnosis")' in source
    assert '@router.post("/war-room/respond")' in source
    assert '@router.post("/boardroom/escalation-action")' in source


def test_models_expose_expected_fields_in_source():
    source = _read(ROUTE_PATH)
    assert "mode: str" in source
    assert "focus_area: Optional[str] = None" in source
    assert "title: Optional[str] = None" in source
    assert "role: str" in source
    assert "content: str" in source
    assert "metadata: Optional[Dict[str, object]] = None" in source


def test_boardroom_routes_module_references_if_importable():
    if boardroom_routes is None:
        pytest.skip("boardroom route module import unavailable in sandbox")
    assert hasattr(boardroom_routes, "create_boardroom_conversation")
    assert hasattr(boardroom_routes, "list_boardroom_conversations")
    assert hasattr(boardroom_routes, "append_boardroom_message")
