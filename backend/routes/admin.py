"""Admin routes — super_admin restricted. Prompt management + user management."""
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from routes.deps import get_super_admin, get_admin_user, get_current_user_from_request, get_sb, logger

router = APIRouter()


class AdminUserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    subscription_tier: Optional[str] = None
    is_master_account: Optional[bool] = None


@router.post("/admin/backfill-calibration")
async def admin_backfill_calibration(request: Request):
    try:
        await get_current_user_from_request(request)
    except Exception:
        raise HTTPException(status_code=401, detail="Not authenticated")

    sb = get_sb()
    backfilled = skipped = errors = 0
    now_iso = datetime.now(timezone.utc).isoformat()

    try:
        cs_result = sb.table("calibration_sessions").select("user_id").eq("completed", True).execute()
        session_users = [r["user_id"] for r in (cs_result.data or []) if r.get("user_id")]
    except Exception:
        session_users = []

    for uid in session_users:
        try:
            op_result = sb.table("user_operator_profile").select(
                "persona_calibration_status"
            ).eq("user_id", uid).maybe_single().execute()

            if op_result and op_result.data and op_result.data.get("persona_calibration_status") == "complete":
                skipped += 1
                continue

            if op_result and op_result.data:
                sb.table("user_operator_profile").update({
                    "persona_calibration_status": "complete", "calibration_completed_at": now_iso
                }).eq("user_id", uid).execute()
            else:
                sb.table("user_operator_profile").insert({
                    "user_id": uid, "persona_calibration_status": "complete",
                    "calibration_completed_at": now_iso, "operator_profile": {}
                }).execute()
            backfilled += 1
        except Exception as e:
            errors += 1
            logger.error(f"[backfill] Error for user {uid}: {e}")

    return {"source_users_found": len(session_users), "backfilled": backfilled, "already_correct": skipped, "errors": errors}


@router.get("/admin/users")
async def admin_get_users(admin: dict = Depends(get_super_admin)):
    sb = get_sb()
    result = sb.table("users").select("*").order("created_at", desc=True).limit(1000).execute()
    return result.data if result.data else []


@router.get("/admin/stats")
async def admin_get_stats(admin: dict = Depends(get_super_admin)):
    sb = get_sb()
    return {
        "total_users": (sb.table("users").select("id", count="exact").execute()).count or 0,
        "total_analyses": (sb.table("analyses").select("id", count="exact").execute()).count or 0,
        "total_documents": (sb.table("documents").select("id", count="exact").execute()).count or 0,
        "total_chats": (sb.table("chat_history").select("id", count="exact").execute()).count or 0,
        "recent_users": (sb.table("users").select("*").order("created_at", desc=True).limit(5).execute()).data or [],
        "recent_analyses": (sb.table("analyses").select("*").order("created_at", desc=True).limit(5).execute()).data or [],
    }


@router.put("/admin/users/{user_id}")
async def admin_update_user(user_id: str, update: AdminUserUpdate, admin: dict = Depends(get_super_admin)):
    sb = get_sb()
    update_dict = {k: v for k, v in update.model_dump().items() if v is not None}
    if not update_dict:
        raise HTTPException(status_code=400, detail="No updates provided")
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = sb.table("users").update(update_dict).eq("id", user_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")
    from auth_supabase import get_user_by_id
    return await get_user_by_id(user_id)


@router.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: str, admin: dict = Depends(get_super_admin)):
    sb = get_sb()
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    result = sb.table("users").delete().eq("id", user_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")
    sb.table("analyses").delete().eq("user_id", user_id).execute()
    from supabase_document_helpers import delete_user_documents_supabase
    from supabase_intelligence_helpers import delete_user_chats_supabase
    await delete_user_documents_supabase(sb, user_id)
    await delete_user_chats_supabase(sb, user_id)
    return {"message": "User and all associated data deleted"}


# ─── Prompt Registry Management ───

@router.post("/admin/prompts/invalidate")
async def invalidate_prompt_cache(
    request: dict = None,
    admin: dict = Depends(get_super_admin)
):
    """
    Hot-swap AI personalities by invalidating the prompt cache.
    After invalidation, next request fetches fresh prompts from system_prompts table.
    
    Body (optional):
      {"prompt_key": "mysoundboard_v1"}  → invalidate specific prompt
      {} or no body                      → invalidate ALL prompts
    """
    from prompt_registry import invalidate_cache
    
    prompt_key = None
    if request and isinstance(request, dict):
        prompt_key = request.get("prompt_key")
    
    invalidate_cache(prompt_key)
    
    if prompt_key:
        logger.info(f"[admin] Prompt cache invalidated for: {prompt_key}")
        return {"status": "invalidated", "prompt_key": prompt_key}
    else:
        logger.info("[admin] Full prompt cache invalidated")
        return {"status": "invalidated", "scope": "all"}


@router.get("/admin/prompts")
async def list_prompts(admin: dict = Depends(get_super_admin)):
    """List all active prompts from the system_prompts table."""
    sb = get_sb()
    result = sb.table("system_prompts").select(
        "prompt_key, version, agent_identity, is_active, updated_at"
    ).order("agent_identity").execute()
    return {"prompts": result.data or []}


@router.get("/admin/prompts/{prompt_key}")
async def get_prompt_detail(prompt_key: str, admin: dict = Depends(get_super_admin)):
    """Get full prompt content by key."""
    sb = get_sb()
    result = sb.table("system_prompts").select("*").eq("prompt_key", prompt_key).maybe_single().execute()
    if not result or not result.data:
        raise HTTPException(status_code=404, detail=f"Prompt '{prompt_key}' not found")
    row = result.data
    row.pop("id", None)
    return {"prompt": row}


class PromptUpdateRequest(BaseModel):
    content: str
    version: Optional[int] = None


@router.put("/admin/prompts/{prompt_key}")
async def update_prompt(prompt_key: str, payload: PromptUpdateRequest, admin: dict = Depends(get_super_admin)):
    """Update a prompt and invalidate the cache. Creates audit log entry."""
    sb = get_sb()

    # Fetch current version for audit trail
    current = sb.table("system_prompts").select("content, version").eq("prompt_key", prompt_key).maybe_single().execute()
    if not current or not current.data:
        raise HTTPException(status_code=404, detail=f"Prompt '{prompt_key}' not found")

    old_content = current.data.get("content", "")
    old_version = current.data.get("version", "1.0")
    new_version = payload.version or old_version

    update_data = {
        "content": payload.content,
        "version": new_version,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    sb.table("system_prompts").update(update_data).eq("prompt_key", prompt_key).execute()

    # Create audit log entry
    try:
        sb.table("prompt_audit_logs").insert({
            "prompt_key": prompt_key,
            "action": "update",
            "old_version": old_version,
            "new_version": new_version,
            "old_content_preview": old_content[:200],
            "new_content_preview": payload.content[:200],
            "changed_by": admin.get("id"),
            "changed_by_email": admin.get("email"),
            "changed_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
    except Exception as e:
        logger.warning(f"[admin] Audit log write failed (non-fatal): {e}")

    # Invalidate cache
    from prompt_registry import invalidate_cache
    invalidate_cache(prompt_key)

    logger.info(f"[admin] Prompt '{prompt_key}' updated by {admin.get('email')} (v{old_version} → v{new_version})")
    return {"status": "updated", "prompt_key": prompt_key, "version": new_version}


@router.post("/admin/prompts/{prompt_key}/test")
async def test_prompt_connection(prompt_key: str, admin: dict = Depends(get_super_admin)):
    """Test that a prompt is correctly loaded in the prompt_registry cache."""
    from prompt_registry import get_prompt, _cache

    # Check cache status
    cached = prompt_key in _cache

    # Fetch from DB
    content = await get_prompt(prompt_key)
    loaded = content is not None
    length = len(content) if content else 0
    preview = content[:150] + "..." if content and len(content) > 150 else content

    return {
        "prompt_key": prompt_key,
        "loaded": loaded,
        "cached": cached,
        "content_length": length,
        "preview": preview,
    }

