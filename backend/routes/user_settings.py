"""
User Settings API — notification toggles, signal thresholds, data export, danger zone.

Backs the full Settings page from mockups:
- Account section (name, email, company, timezone) → handled by profile.py
- Notifications section (6 toggles) → this file
- Signals section (5 threshold selects) → this file
- Plan & billing section → handled by billing.py
- Danger zone (disconnect all, export, delete) → this file
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from routes.deps import get_current_user, get_sb

logger = logging.getLogger(__name__)
router = APIRouter()


# ───────────────────────── Models ─────────────────────────

class NotificationPreferences(BaseModel):
    notify_morning_brief: bool = True
    notify_critical_alerts: bool = True
    notify_high_alerts: bool = True
    notify_weekly_report: bool = True
    notify_nudges: bool = True
    notify_marketing: bool = False


class SignalThresholds(BaseModel):
    threshold_deal_stall_days: int = Field(default=14, ge=1, le=90)
    threshold_cash_runway_months: int = Field(default=6, ge=1, le=36)
    threshold_meeting_overload_pct: int = Field(default=60, ge=10, le=100)
    threshold_churn_silence_days: int = Field(default=21, ge=1, le=180)
    threshold_invoice_aging_pct: int = Field(default=15, ge=1, le=100)


# ───────────────────────── Helpers ─────────────────────────

def _ensure_settings_row(sb, user_id: str) -> Dict[str, Any]:
    """Get or auto-create user_settings row with defaults."""
    result = sb.table("user_settings").select("*").eq("user_id", user_id).maybe_single().execute()
    if result.data:
        return result.data
    # Auto-create with defaults
    insert_result = sb.table("user_settings").insert({"user_id": user_id}).execute()
    return insert_result.data[0] if insert_result.data else {"user_id": user_id}


# ───────────────────────── Notification Endpoints ─────────────────────────

@router.get("/settings/notifications")
async def get_notifications(user=Depends(get_current_user)):
    """Load 6 notification toggle states."""
    sb = get_sb()
    row = _ensure_settings_row(sb, user["id"])
    return {
        "notify_morning_brief": row.get("notify_morning_brief", True),
        "notify_critical_alerts": row.get("notify_critical_alerts", True),
        "notify_high_alerts": row.get("notify_high_alerts", True),
        "notify_weekly_report": row.get("notify_weekly_report", True),
        "notify_nudges": row.get("notify_nudges", True),
        "notify_marketing": row.get("notify_marketing", False),
    }


@router.put("/settings/notifications")
async def save_notifications(prefs: NotificationPreferences, user=Depends(get_current_user)):
    """Save 6 notification toggle states."""
    sb = get_sb()
    data = prefs.model_dump()
    data["user_id"] = user["id"]
    sb.table("user_settings").upsert(data, on_conflict="user_id").execute()
    return {"status": "saved", **prefs.model_dump()}


# ───────────────────────── Signal Threshold Endpoints ─────────────────────────

@router.get("/settings/thresholds")
async def get_thresholds(user=Depends(get_current_user)):
    """Load 5 signal threshold values."""
    sb = get_sb()
    row = _ensure_settings_row(sb, user["id"])
    return {
        "threshold_deal_stall_days": row.get("threshold_deal_stall_days", 14),
        "threshold_cash_runway_months": row.get("threshold_cash_runway_months", 6),
        "threshold_meeting_overload_pct": row.get("threshold_meeting_overload_pct", 60),
        "threshold_churn_silence_days": row.get("threshold_churn_silence_days", 21),
        "threshold_invoice_aging_pct": row.get("threshold_invoice_aging_pct", 15),
    }


@router.put("/settings/thresholds")
async def save_thresholds(thresholds: SignalThresholds, user=Depends(get_current_user)):
    """Save 5 signal threshold values."""
    sb = get_sb()
    data = thresholds.model_dump()
    data["user_id"] = user["id"]
    sb.table("user_settings").upsert(data, on_conflict="user_id").execute()
    return {"status": "saved", **thresholds.model_dump()}


# ───────────────────────── Data Export ─────────────────────────

@router.post("/user/export")
async def request_export(user=Depends(get_current_user)):
    """Queue a full data export (background job via Redis)."""
    sb = get_sb()
    user_id = user["id"]

    # Check for existing pending export
    existing = (
        sb.table("data_exports")
        .select("id, status")
        .eq("user_id", user_id)
        .in_("status", ["queued", "processing"])
        .maybe_single()
        .execute()
    )
    if existing.data:
        return {"status": "already_queued", "export_id": existing.data["id"]}

    result = sb.table("data_exports").insert({
        "user_id": user_id,
        "status": "queued",
    }).execute()
    export_id = result.data[0]["id"]

    # Enqueue Redis job if available
    try:
        from biqc_jobs import biqc_jobs
        if biqc_jobs:
            await biqc_jobs.enqueue({
                "type": "data-export",
                "user_id": user_id,
                "export_id": export_id,
            })
    except Exception as e:
        logger.warning(f"Redis unavailable for export job, will process on next worker cycle: {e}")

    return {"status": "queued", "export_id": export_id}


@router.get("/user/export/status")
async def export_status(user=Depends(get_current_user)):
    """Check latest export status."""
    sb = get_sb()
    result = (
        sb.table("data_exports")
        .select("*")
        .eq("user_id", user["id"])
        .order("created_at", desc=True)
        .limit(1)
        .maybe_single()
        .execute()
    )
    if not result.data:
        return {"status": "none"}
    return result.data


# ───────────────────────── Danger Zone ─────────────────────────

@router.post("/user/disconnect-all")
async def disconnect_all(user=Depends(get_current_user)):
    """Disconnect all active integrations for the current user."""
    sb = get_sb()
    user_id = user["id"]
    disconnected = []

    # Token/connection tables to clear
    tables = [
        "outlook_oauth_tokens",
        "gmail_connections",
        "imap_connections",
        "icloud_connections",
        "email_connections",
        "integration_accounts",
    ]

    for table in tables:
        try:
            sb.table(table).delete().eq("user_id", user_id).execute()
            disconnected.append(table)
        except Exception as e:
            # Table may not exist or may have no rows — not an error
            logger.debug(f"disconnect-all: {table} — {e}")

    return {"status": "disconnected", "cleared": disconnected}


@router.delete("/user/account")
async def delete_account(user=Depends(get_current_user)):
    """
    Soft-delete user account.
    Marks user as inactive. Does NOT hard-delete data — a scheduled job
    can clean PII after 30 days per data retention policy.
    """
    sb = get_sb()
    user_id = user["id"]

    # Mark business profile as deleted
    try:
        sb.table("business_profiles").update({
            "subscription_tier": "deleted",
        }).eq("user_id", user_id).execute()
    except Exception as e:
        logger.warning(f"Failed to mark business_profiles: {e}")

    # Mark user row as inactive
    try:
        sb.table("users").update({
            "is_active": False,
        }).eq("id", user_id).execute()
    except Exception as e:
        logger.warning(f"Failed to mark users: {e}")

    # Disconnect all integrations
    try:
        await disconnect_all.__wrapped__(user) if hasattr(disconnect_all, '__wrapped__') else None
    except Exception:
        pass

    return {"status": "account_scheduled_for_deletion", "retention_days": 30}


# ───────────────────────── Sync Log ─────────────────────────

@router.get("/sync/log")
async def get_sync_log(user=Depends(get_current_user), limit: int = 50):
    """Get unified sync log across all connectors."""
    sb = get_sb()
    if limit > 200:
        limit = 200
    result = (
        sb.table("sync_log")
        .select("*")
        .eq("user_id", user["id"])
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return {"logs": result.data or []}


# ───────────────────────── Feature Flags ─────────────────────────

@router.get("/feature-flags")
async def get_feature_flags(user=Depends(get_current_user)):
    """Get active feature flags from database with env var fallback."""
    sb = get_sb()
    try:
        result = sb.table("active_feature_flags").select("*").execute()
        flags = {row["flag_key"]: row["flag_value"] for row in (result.data or [])}
    except Exception:
        # Fallback to env vars if view/table doesn't exist yet
        import os
        flags = {
            "merge_webhook": os.environ.get("FEATURE_MERGE_WEBHOOK_ENABLED", "false"),
            "soundboard_v3": os.environ.get("SOUNDBOARD_V3_ENABLED", "true"),
            "warroom_streaming_v2": os.environ.get("WARROOM_STREAMING_V2_ENABLED", "true"),
            "enrichment_worker": os.environ.get("ENRICHMENT_WORKER_ENABLED", "true"),
        }
    return {"flags": flags}
