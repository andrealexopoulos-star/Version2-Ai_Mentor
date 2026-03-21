"""
Tutorial Progress Routes — Cross-device tutorial persistence.
Stores per-user, per-page tutorial completion in Supabase.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone

from routes.deps import get_current_user, get_sb, logger

router = APIRouter()


def normalize_page_key(key: str) -> str:
    raw = (key or "").strip()
    if not raw:
        return raw
    if raw.startswith("/"):
        raw = raw.split("?", 1)[0].split("#", 1)[0]
        if len(raw) > 1 and raw.endswith("/"):
            raw = raw[:-1]
    return raw


class MarkTutorialRequest(BaseModel):
    page_key: str


class TutorialPrefsRequest(BaseModel):
    tutorials_disabled: bool


@router.get("/tutorials/status")
async def get_tutorial_status(current_user: dict = Depends(get_current_user)):
    """
    Returns the set of page_keys this user has completed.
    Also returns tutorials_disabled flag.
    """
    user_id = current_user["id"]
    try:
        result = get_sb().table("tutorial_progress") \
            .select("page_key, completed_at") \
            .eq("user_id", user_id) \
            .execute()
        completed = {
            normalize_page_key(row["page_key"]): row["completed_at"]
            for row in (result.data or [])
            if row.get("page_key")
        }

        # Fetch disabled flag from users table
        user_row = get_sb().table("users") \
            .select("tutorials_disabled") \
            .eq("id", user_id) \
            .maybe_single() \
            .execute()
        disabled = (user_row.data or {}).get("tutorials_disabled", False)

        return {"completed": completed, "tutorials_disabled": bool(disabled)}
    except Exception as e:
        logger.warning(f"[tutorials/status] {e}")
        return {"completed": {}, "tutorials_disabled": False}


@router.post("/tutorials/mark")
async def mark_tutorial_complete(
    req: MarkTutorialRequest,
    current_user: dict = Depends(get_current_user),
):
    """Mark a tutorial page_key as completed for this user."""
    user_id = current_user["id"]
    page_key = normalize_page_key(req.page_key)
    if not page_key:
        raise HTTPException(status_code=400, detail="page_key is required")
    try:
        get_sb().table("tutorial_progress").upsert({
            "user_id": user_id,
            "page_key": page_key,
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }, on_conflict="user_id,page_key").execute()
        return {"ok": True}
    except Exception as e:
        logger.warning(f"[tutorials/mark] {e}")
        return {"ok": False, "error": str(e)}


@router.post("/tutorials/reset")
async def reset_tutorials(current_user: dict = Depends(get_current_user)):
    """Delete all tutorial_progress records for this user (reset to unseen)."""
    user_id = current_user["id"]
    try:
        get_sb().table("tutorial_progress") \
            .delete() \
            .eq("user_id", user_id) \
            .execute()
        return {"ok": True}
    except Exception as e:
        logger.warning(f"[tutorials/reset] {e}")
        raise HTTPException(status_code=500, detail="Reset failed")


@router.post("/tutorials/preferences")
async def set_tutorial_preferences(
    req: TutorialPrefsRequest,
    current_user: dict = Depends(get_current_user),
):
    """Enable or disable all tutorials for this user."""
    user_id = current_user["id"]
    try:
        get_sb().table("users") \
            .update({"tutorials_disabled": req.tutorials_disabled, "updated_at": datetime.now(timezone.utc).isoformat()}) \
            .eq("id", user_id) \
            .execute()
        return {"ok": True}
    except Exception as e:
        logger.warning(f"[tutorials/preferences] {e}")
        raise HTTPException(status_code=500, detail="Preference update failed")
