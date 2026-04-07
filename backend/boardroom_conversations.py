"""Data access layer for BoardRoom/WarRoom conversation persistence."""
from typing import List, Dict, Optional, Any
from supabase import Client


def create_conversation(sb: Client, user_id: str, mode: str,
                        focus_area: Optional[str] = None,
                        title: Optional[str] = None) -> Optional[dict]:
    if mode not in ("boardroom", "war_room"):
        raise ValueError(f"Invalid mode: {mode}")
    if not user_id:
        raise ValueError("user_id is required")
    default_title = "New boardroom session" if mode == "boardroom" else "New war room session"
    payload = {
        "user_id": user_id,
        "mode": mode,
        "focus_area": focus_area,
        "title": title or default_title,
    }
    result = sb.table("boardroom_conversations").insert(payload).execute()
    return result.data[0] if result.data else None


def list_conversations(sb: Client, user_id: str, mode: str,
                       limit: int = 50, status: str = "active") -> List[dict]:
    if limit < 1 or limit > 200:
        limit = 50
    result = (
        sb.table("boardroom_conversations")
        .select("*")
        .eq("user_id", user_id)
        .eq("mode", mode)
        .eq("status", status)
        .order("updated_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data or []


def get_conversation(sb: Client, user_id: str, conv_id: str) -> Optional[dict]:
    result = (
        sb.table("boardroom_conversations")
        .select("*")
        .eq("id", conv_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    data = result.data or []
    return data[0] if data else None


def get_messages(sb: Client, conv_id: str) -> List[dict]:
    result = (
        sb.table("boardroom_messages")
        .select("*")
        .eq("conversation_id", conv_id)
        .order("created_at", desc=False)
        .execute()
    )
    return result.data or []


def append_message(sb: Client, conv_id: str, user_id: str, role: str, content: str,
                   focus_area: Optional[str] = None,
                   explainability: Optional[Dict[str, Any]] = None,
                   evidence_chain: Optional[List[Dict[str, Any]]] = None,
                   priority_compression: Optional[Dict[str, Any]] = None,
                   lineage: Optional[Dict[str, Any]] = None,
                   confidence_score: Optional[float] = None,
                   degraded: bool = False,
                   source_response: Optional[Dict[str, Any]] = None) -> Optional[dict]:
    if role not in ("user", "advisor", "system"):
        raise ValueError(f"Invalid role: {role}")
    payload = {
        "conversation_id": conv_id,
        "user_id": user_id,
        "role": role,
        "content": content or "",
        "focus_area": focus_area,
        "explainability": explainability or {},
        "evidence_chain": evidence_chain or [],
        "priority_compression": priority_compression or {},
        "lineage": lineage or {},
        "confidence_score": confidence_score,
        "degraded": bool(degraded),
        "source_response": source_response or {},
    }
    result = sb.table("boardroom_messages").insert(payload).execute()
    return result.data[0] if result.data else None


def update_conversation(sb: Client, user_id: str, conv_id: str,
                        updates: Dict[str, Any]) -> Optional[dict]:
    allowed_keys = {"title", "status", "metadata"}
    payload = {k: v for k, v in updates.items() if k in allowed_keys}
    if not payload:
        return None
    if "status" in payload and payload["status"] not in ("active", "archived"):
        raise ValueError("Invalid status")
    result = (
        sb.table("boardroom_conversations")
        .update(payload)
        .eq("id", conv_id)
        .eq("user_id", user_id)
        .execute()
    )
    data = result.data or []
    return data[0] if data else None
