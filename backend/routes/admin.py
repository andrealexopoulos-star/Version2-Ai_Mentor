"""Admin routes — super_admin restricted. Prompt management + user management."""
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, field_validator, model_validator
from typing import Optional, Dict, Any
from datetime import datetime, timezone
from routes.deps import get_super_admin, get_admin_user, get_current_user_from_request, get_sb, logger, get_user_rate_limit_state, RATE_LIMIT_FEATURE_LABELS

router = APIRouter()


class AdminUserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    subscription_tier: Optional[str] = None
    is_master_account: Optional[bool] = None


class FeatureRateLimitUpdate(BaseModel):
    monthly_limit: Optional[int] = None
    burst_limit: Optional[int] = None
    burst_window_seconds: Optional[int] = None

    @field_validator("monthly_limit")
    @classmethod
    def validate_monthly_limit(cls, value):
        if value is None:
            return value
        if value != -1 and value < 0:
            raise ValueError("monthly_limit must be -1 (unlimited) or >= 0")
        if value > 100000:
            raise ValueError("monthly_limit exceeds max allowed value")
        return int(value)

    @field_validator("burst_limit")
    @classmethod
    def validate_burst_limit(cls, value):
        if value is None:
            return value
        if value != -1 and value < 0:
            raise ValueError("burst_limit must be -1 (unlimited) or >= 0")
        if value > 1000:
            raise ValueError("burst_limit exceeds max allowed value")
        return int(value)

    @field_validator("burst_window_seconds")
    @classmethod
    def validate_burst_window_seconds(cls, value):
        if value is None:
            return value
        if value < 10 or value > 3600:
            raise ValueError("burst_window_seconds must be between 10 and 3600")
        return int(value)

    @model_validator(mode="after")
    def validate_combination(self):
        if self.monthly_limit is not None and self.monthly_limit != -1 and self.burst_limit == -1:
            raise ValueError("burst_limit cannot be unlimited when monthly_limit is finite")
        return self


class UserRateLimitUpdate(BaseModel):
    overrides: Dict[str, FeatureRateLimitUpdate]

    @field_validator("overrides")
    @classmethod
    def validate_overrides(cls, overrides):
        if not overrides:
            raise ValueError("At least one override is required")
        unknown_features = set(overrides.keys()) - set(RATE_LIMIT_FEATURE_LABELS.keys())
        if unknown_features:
            raise ValueError(f"Unknown rate limit features: {', '.join(sorted(unknown_features))}")
        return overrides


def _assert_user_exists(state: Dict[str, Any], user_id: str):
    if not state.get("user") or not state["user"].get("id"):
        raise HTTPException(status_code=404, detail=f"User not found: {user_id}")


def _load_operator_profile(sb, user_id: str) -> Dict[str, Any]:
    op_result = sb.table("user_operator_profile").select("operator_profile").eq("user_id", user_id).maybe_single().execute()
    return (op_result.data or {}).get("operator_profile") or {}


def _save_operator_profile(sb, user_id: str, operator_profile: Dict[str, Any]):
    sb.table("user_operator_profile").upsert({
        "user_id": user_id,
        "operator_profile": operator_profile,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }, on_conflict="user_id").execute()


@router.post("/admin/backfill-calibration")
async def admin_backfill_calibration(admin: dict = Depends(get_super_admin)):
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
    result = sb.table("users").select("id, email, full_name, company_name, role, subscription_tier, is_master_account, created_at, updated_at").order("created_at", desc=True).limit(1000).execute()
    users = result.data or []
    # Enrich with last sign-in from auth
    try:
        for u in users:
            scs = sb.table("strategic_console_state").select("is_complete").eq("user_id", u["id"]).maybe_single().execute()
            u["calibrated"] = scs.data.get("is_complete", False) if scs.data else False
    except Exception:
        pass
    return {"users": users}


@router.get("/admin/stats")
async def admin_get_stats(admin: dict = Depends(get_super_admin)):
    sb = get_sb()
    calibrated = sb.table("strategic_console_state").select("user_id", count="exact").eq("is_complete", True).execute()
    integrations = sb.table("integration_accounts").select("id", count="exact").execute()
    return {
        "total_users": (sb.table("users").select("id", count="exact").execute()).count or 0,
        "calibrated_users": calibrated.count or 0,
        "total_integrations": integrations.count or 0,
        "total_analyses": (sb.table("analyses").select("id", count="exact").execute()).count or 0,
        "total_documents": (sb.table("documents").select("id", count="exact").execute()).count or 0,
        "total_snapshots": (sb.table("intelligence_snapshots").select("id", count="exact").execute()).count or 0,
    }


@router.get("/admin/rate-limits/defaults")
async def admin_rate_limit_defaults(admin: dict = Depends(get_super_admin)):
    from routes.deps import TIER_RATE_LIMIT_DEFAULTS
    return {"tiers": TIER_RATE_LIMIT_DEFAULTS, "feature_labels": RATE_LIMIT_FEATURE_LABELS}


@router.get("/admin/users/{user_id}/rate-limits")
async def admin_get_user_rate_limits(user_id: str, admin: dict = Depends(get_super_admin)):
    sb = get_sb()
    state = get_user_rate_limit_state(sb, user_id)
    _assert_user_exists(state, user_id)
    return {
        "user": state["user"],
        "tier": state["tier"],
        "admin_bypass": state["admin_bypass"],
        "feature_labels": RATE_LIMIT_FEATURE_LABELS,
        "defaults": state["defaults"],
        "overrides": state["overrides"],
        "effective": state["effective"],
        "monthly_usage": state["monthly_usage"],
    }


@router.put("/admin/users/{user_id}/rate-limits")
async def admin_update_user_rate_limits(user_id: str, payload: UserRateLimitUpdate, admin: dict = Depends(get_super_admin)):
    sb = get_sb()
    state = get_user_rate_limit_state(sb, user_id)
    _assert_user_exists(state, user_id)

    operator_profile = _load_operator_profile(sb, user_id)
    current_limits = operator_profile.get("rate_limits") or {}

    sanitized: Dict[str, Any] = {}
    for feature, config in payload.overrides.items():
        if feature not in RATE_LIMIT_FEATURE_LABELS:
            continue

        values = {k: v for k, v in config.model_dump().items() if v is not None}
        if not values:
            continue

        prior = dict(current_limits.get(feature) or state["effective"].get(feature) or {})
        merged = {**prior, **values}

        monthly_limit = merged.get("monthly_limit")
        burst_limit = merged.get("burst_limit")

        if monthly_limit != -1 and burst_limit == -1:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid override for {feature}: burst_limit cannot be unlimited when monthly_limit is finite",
            )

        if burst_limit and burst_limit > 0 and not merged.get("burst_window_seconds"):
            merged["burst_window_seconds"] = 300

        values = merged
        sanitized[feature] = values

    if not sanitized:
        raise HTTPException(status_code=400, detail="No valid rate limit overrides provided")

    current_limits.update(sanitized)
    operator_profile["rate_limits"] = current_limits

    _save_operator_profile(sb, user_id, operator_profile)

    return await admin_get_user_rate_limits(user_id, admin)


@router.delete("/admin/users/{user_id}/rate-limits")
async def admin_clear_user_rate_limits(user_id: str, admin: dict = Depends(get_super_admin)):
    sb = get_sb()
    state = get_user_rate_limit_state(sb, user_id)
    _assert_user_exists(state, user_id)

    operator_profile = _load_operator_profile(sb, user_id)
    if operator_profile.get("rate_limits"):
        operator_profile.pop("rate_limits", None)
        _save_operator_profile(sb, user_id, operator_profile)

    return await admin_get_user_rate_limits(user_id, admin)


@router.post("/admin/users/{user_id}/rate-limits/reset-month")
async def admin_reset_user_rate_limit_usage(user_id: str, admin: dict = Depends(get_super_admin)):
    sb = get_sb()
    state = get_user_rate_limit_state(sb, user_id)
    _assert_user_exists(state, user_id)

    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0).date().isoformat()
    sb.table("ai_usage_log").delete().eq("user_id", user_id).gte("date", month_start).execute()
    return {"status": "reset", "user_id": user_id, "month_start": month_start}


@router.get("/admin/rate-limits/users/{user_id}")
async def admin_get_user_rate_limits_alias(user_id: str, admin: dict = Depends(get_super_admin)):
    return await admin_get_user_rate_limits(user_id, admin)


@router.post("/admin/rate-limits/users/{user_id}")
async def admin_update_user_rate_limits_alias(user_id: str, payload: UserRateLimitUpdate, admin: dict = Depends(get_super_admin)):
    return await admin_update_user_rate_limits(user_id, payload, admin)


@router.delete("/admin/rate-limits/users/{user_id}")
async def admin_clear_user_rate_limits_alias(user_id: str, admin: dict = Depends(get_super_admin)):
    return await admin_clear_user_rate_limits(user_id, admin)


@router.post("/admin/rate-limits/users/{user_id}/reset-month")
async def admin_reset_user_rate_limit_usage_alias(user_id: str, admin: dict = Depends(get_super_admin)):
    return await admin_reset_user_rate_limit_usage(user_id, admin)


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


@router.post("/admin/users/{user_id}/suspend")
async def admin_suspend_user(user_id: str, admin: dict = Depends(get_super_admin)):
    """Suspend a user account. Sets role to 'suspended'. Reversible."""
    sb = get_sb()
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="Cannot suspend yourself")
    result = sb.table("users").update({"role": "suspended", "updated_at": datetime.now(timezone.utc).isoformat()}).eq("id", user_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")
    return {"status": "suspended", "user_id": user_id}


@router.post("/admin/users/{user_id}/unsuspend")
async def admin_unsuspend_user(user_id: str, admin: dict = Depends(get_super_admin)):
    """Unsuspend a user account. Restores role to 'user'."""
    sb = get_sb()
    result = sb.table("users").update({"role": "user", "updated_at": datetime.now(timezone.utc).isoformat()}).eq("id", user_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")
    return {"status": "active", "user_id": user_id}


@router.post("/admin/users/{user_id}/impersonate")
async def admin_impersonate_user(user_id: str, admin: dict = Depends(get_super_admin)):
    """Get full user context for impersonation. Returns everything needed to render their view."""
    sb = get_sb()
    user = sb.table("users").select("*").eq("id", user_id).maybe_single().execute()
    if not user.data:
        raise HTTPException(status_code=404, detail="User not found")
    bp = sb.table("business_profiles").select("*").eq("user_id", user_id).maybe_single().execute()
    scs = sb.table("strategic_console_state").select("*").eq("user_id", user_id).maybe_single().execute()
    snaps = sb.table("intelligence_snapshots").select("snapshot_type, executive_memo, generated_at").eq("user_id", user_id).order("generated_at", desc=True).limit(5).execute()
    integ = sb.table("integration_accounts").select("provider, category, connected_at").eq("user_id", user_id).execute()
    signals = sb.table("observation_events").select("id", count="exact").eq("user_id", user_id).execute()
    return {
        "user": {k: v for k, v in user.data.items() if k != "password_hash"},
        "business_profile": bp.data,
        "console_state": scs.data,
        "snapshots": snaps.data or [],
        "integrations": integ.data or [],
        "signal_count": signals.count or 0,
    }




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



@router.get("/admin/prompts/audit-log")
async def get_prompt_audit_log(admin: dict = Depends(get_super_admin)):
    """Get prompt change audit trail from prompt_audit_logs table."""
    sb = get_sb()
    try:
        result = sb.table("prompt_audit_logs").select("*").order("timestamp", desc=True).limit(50).execute()
        logs = result.data if result.data else []
        for log in logs:
            log.pop("id", None)
        return {"logs": logs, "total": len(logs)}
    except Exception as e:
        logger.warning(f"Audit log fetch failed: {e}")
        return {"logs": [], "total": 0}

