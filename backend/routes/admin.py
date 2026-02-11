"""Admin routes — extracted from server.py. No logic changes."""
from fastapi import APIRouter, Depends, HTTPException, Request
from datetime import datetime, timezone
import logging

logger = logging.getLogger("server")
router = APIRouter()

# Dependencies injected by server.py via init()
_sb = None
_get_admin_user = None
_get_current_user_from_request = None
_get_user_by_id = None
_delete_user_documents_supabase = None
_delete_user_chats_supabase = None
_AdminUserUpdate = None


def init(supabase_admin, get_admin_user, get_current_user_from_request,
         get_user_by_id, delete_user_documents_supabase, delete_user_chats_supabase,
         AdminUserUpdate):
    global _sb, _get_admin_user, _get_current_user_from_request
    global _get_user_by_id, _delete_user_documents_supabase, _delete_user_chats_supabase
    global _AdminUserUpdate
    _sb = supabase_admin
    _get_admin_user = get_admin_user
    _get_current_user_from_request = get_current_user_from_request
    _get_user_by_id = get_user_by_id
    _delete_user_documents_supabase = delete_user_documents_supabase
    _delete_user_chats_supabase = delete_user_chats_supabase
    _AdminUserUpdate = AdminUserUpdate


@router.post("/admin/backfill-calibration")
async def admin_backfill_calibration(request: Request):
    try:
        current_user = await _get_current_user_from_request(request)
    except Exception:
        raise HTTPException(status_code=401, detail="Not authenticated")

    backfilled = 0
    skipped = 0
    errors = 0
    now_iso = datetime.now(timezone.utc).isoformat()

    try:
        cs_result = _sb.table("calibration_sessions").select("user_id").eq("completed", True).execute()
        session_users = [r["user_id"] for r in (cs_result.data or []) if r.get("user_id")]
    except Exception:
        session_users = []

    for uid in session_users:
        try:
            op_result = _sb.table("user_operator_profile").select(
                "persona_calibration_status"
            ).eq("user_id", uid).maybe_single().execute()

            if op_result and op_result.data and op_result.data.get("persona_calibration_status") == "complete":
                skipped += 1
                continue

            if op_result and op_result.data:
                _sb.table("user_operator_profile").update({
                    "persona_calibration_status": "complete",
                    "calibration_completed_at": now_iso
                }).eq("user_id", uid).execute()
            else:
                _sb.table("user_operator_profile").insert({
                    "user_id": uid,
                    "persona_calibration_status": "complete",
                    "calibration_completed_at": now_iso,
                    "operator_profile": {}
                }).execute()
            backfilled += 1
        except Exception as e:
            errors += 1
            logger.error(f"[backfill] Error for user {uid}: {e}")

    return {"source_users_found": len(session_users), "backfilled": backfilled, "already_correct": skipped, "errors": errors}


@router.get("/admin/users")
async def admin_get_users(admin: dict = Depends(lambda: None)):
    # Dependency is injected at include time — see server.py
    result = _sb.table("users").select("*").order("created_at", desc=True).limit(1000).execute()
    return result.data if result.data else []


@router.get("/admin/stats")
async def admin_get_stats(admin: dict = Depends(lambda: None)):
    user_result = _sb.table("users").select("id", count="exact").execute()
    analysis_result = _sb.table("analyses").select("id", count="exact").execute()
    document_result = _sb.table("documents").select("id", count="exact").execute()
    chat_result = _sb.table("chat_history").select("id", count="exact").execute()

    return {
        "total_users": user_result.count or 0,
        "total_analyses": analysis_result.count or 0,
        "total_documents": document_result.count or 0,
        "total_chats": chat_result.count or 0,
        "recent_users": (_sb.table("users").select("*").order("created_at", desc=True).limit(5).execute()).data or [],
        "recent_analyses": (_sb.table("analyses").select("*").order("created_at", desc=True).limit(5).execute()).data or [],
    }


@router.put("/admin/users/{user_id}")
async def admin_update_user(user_id: str, update: dict, admin: dict = Depends(lambda: None)):
    update_dict = {k: v for k, v in update.items() if v is not None}
    if not update_dict:
        raise HTTPException(status_code=400, detail="No updates provided")
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = _sb.table("users").update(update_dict).eq("id", user_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")
    return await _get_user_by_id(user_id)


@router.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: str, admin: dict = Depends(lambda: None)):
    result = _sb.table("users").delete().eq("id", user_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")
    _sb.table("analyses").delete().eq("user_id", user_id).execute()
    await _delete_user_documents_supabase(_sb, user_id)
    await _delete_user_chats_supabase(_sb, user_id)
    return {"message": "User and all associated data deleted"}
