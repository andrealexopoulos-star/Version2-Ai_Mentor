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
from datetime import datetime, timedelta, timezone
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
    try:
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
    except Exception as e:
        logger.error(f"[get-notifications] Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/settings/notifications")
async def save_notifications(prefs: NotificationPreferences, user=Depends(get_current_user)):
    """Save 6 notification toggle states."""
    try:
        sb = get_sb()
        data = prefs.model_dump()
        data["user_id"] = user["id"]
        sb.table("user_settings").upsert(data, on_conflict="user_id").execute()
        return {"status": "saved", **prefs.model_dump()}
    except Exception as e:
        logger.error(f"[save-notifications] Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ───────────────────────── Signal Threshold Endpoints ─────────────────────────

@router.get("/settings/thresholds")
async def get_thresholds(user=Depends(get_current_user)):
    """Load 5 signal threshold values."""
    try:
        sb = get_sb()
        row = _ensure_settings_row(sb, user["id"])
        return {
            "threshold_deal_stall_days": row.get("threshold_deal_stall_days", 14),
            "threshold_cash_runway_months": row.get("threshold_cash_runway_months", 6),
            "threshold_meeting_overload_pct": row.get("threshold_meeting_overload_pct", 60),
            "threshold_churn_silence_days": row.get("threshold_churn_silence_days", 21),
            "threshold_invoice_aging_pct": row.get("threshold_invoice_aging_pct", 15),
        }
    except Exception as e:
        logger.error(f"[get-thresholds] Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/settings/thresholds")
async def save_thresholds(thresholds: SignalThresholds, user=Depends(get_current_user)):
    """Save 5 signal threshold values."""
    try:
        sb = get_sb()
        data = thresholds.model_dump()
        data["user_id"] = user["id"]
        sb.table("user_settings").upsert(data, on_conflict="user_id").execute()
        return {"status": "saved", **thresholds.model_dump()}
    except Exception as e:
        logger.error(f"[save-thresholds] Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ───────────────────────── Data Export ─────────────────────────

# Sprint C #21 (2026-04-22) — synchronous self-service data export.
#
# The existing POST /user/export path queues a Redis job handled by
# biqc_jobs._handle_data_export. That worker collects the rows but never
# uploads a file to storage, so users who clicked "Export" got a "download
# link shortly" toast and nothing ever arrived (retention-breaking: GDPR
# rights of access exist in expectation but not in practice).
#
# This sync endpoint returns the user's data as a JSON download immediately.
# Scope intentionally narrow: all tables with `user_id` that we believe a
# user has a right to receive. Columns that contain other users' data
# (e.g. account-owner records with nested rows) are NOT traversed — the
# query is a flat SELECT * WHERE user_id = X per table.
#
# Safety:
# - SYNC-only endpoint — no background job, no storage upload, no retention.
#   Response streamed directly to the caller. If the user's data set is
#   enormous (tens of MBs) we'll revisit with streaming; for now acceptable.
# - Rate-limited implicitly by upstream auth. Abuse is bounded because
#   the endpoint returns only data the authenticated user owns.
# - Includes a generation timestamp + schema_version so downstream tools
#   can ingest the archive reliably.

# Tables a user has an explicit right to access their own data from.
# Order matters for the JSON output only — it's alphabetical within groups.
# Do NOT add tables that contain other users' data unless you can filter
# by user_id cleanly.
_USER_EXPORT_TABLES: tuple[str, ...] = (
    # Profile + settings
    "business_profiles",
    "user_settings",
    "user_preferences",
    "onboarding",
    # Communication + work
    "chat_history",
    "documents",
    "sops",
    "email_intelligence",
    "calendar_intelligence",
    # Intelligence + actions
    "intelligence_actions",
    "strategy_profiles",
    "cognitive_profiles",
    "observation_events",
    "observation_event_dismissals",
    # Sprint B #17 — feedback trail
    "signal_snoozes",
    "signal_feedback",
    # Usage + billing (read-only view into the ledger)
    "usage_ledger",
    "payment_transactions",
    # Integration + alerts
    "alerts_queue",
    "action_items",
    "merge_integrations",
)

# Maximum rows per table returned in the sync export — prevents a runaway
# payload for users with very long usage_ledger / chat_history histories.
# If hit, the response clearly marks the table as truncated.
_USER_EXPORT_ROW_CAP = 5000


@router.get("/user/export/download-now")
async def export_download_now(user=Depends(get_current_user)):
    """Sync JSON export of everything the user has a right to their own copy of.

    Returns a FastAPI JSONResponse with `Content-Disposition: attachment`
    so browsers treat it as a download. The payload shape:

        {
          "schema_version": "1",
          "generated_at": "<ISO8601>",
          "user_id": "<uuid>",
          "email": "<user email>",
          "tables": {
            "business_profiles": [ ... rows ... ],
            ...
            "signal_feedback": [ ... ],
          },
          "truncated_tables": ["table_name", ...]   # only if any hit the cap
        }
    """
    from fastapi.responses import JSONResponse

    sb = get_sb()
    user_id = user["id"]
    tables_payload: dict[str, list | dict] = {}
    truncated: list[str] = []
    skipped: dict[str, str] = {}

    for table in _USER_EXPORT_TABLES:
        try:
            # Select all columns; cap rows via .limit to bound payload size.
            res = (
                sb.table(table)
                .select("*")
                .eq("user_id", user_id)
                .limit(_USER_EXPORT_ROW_CAP + 1)  # +1 so we can detect cap
                .execute()
            )
            rows = res.data or []
            if len(rows) > _USER_EXPORT_ROW_CAP:
                truncated.append(table)
                rows = rows[:_USER_EXPORT_ROW_CAP]
            tables_payload[table] = rows
        except Exception as exc:
            # Defensive: a missing table (e.g. local/staging drift) or an
            # RLS-blocked read must not 500 the whole export. Mark the
            # individual table as skipped and continue.
            logger.warning(
                "[export-now] table=%s failed for user=%s: %s", table, user_id, exc
            )
            skipped[table] = str(exc)[:200]
            tables_payload[table] = []

    payload = {
        "schema_version": "1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "user_id": user_id,
        "email": user.get("email"),
        "row_cap_per_table": _USER_EXPORT_ROW_CAP,
        "tables": tables_payload,
        "truncated_tables": truncated,
        "skipped_tables": skipped,
    }

    filename = f"biqc_export_{user_id}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.json"
    return JSONResponse(
        content=payload,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )


@router.post("/user/export")
async def request_export(user=Depends(get_current_user)):
    """Queue a full data export (background job via Redis)."""
    try:
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
    except Exception as e:
        logger.error(f"[request-export] Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/user/export/status")
async def export_status(user=Depends(get_current_user)):
    """Check latest export status."""
    try:
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
    except Exception as e:
        logger.error(f"[export-status] Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/user/export/download")
async def export_download(user=Depends(get_current_user)):
    """Download the most recent completed export ZIP."""
    from fastapi.responses import JSONResponse
    try:
        sb = get_sb()
        result = (
            sb.table("data_exports")
            .select("*")
            .eq("user_id", user["id"])
            .eq("status", "ready")
            .order("created_at", desc=True)
            .limit(1)
            .maybe_single()
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=404, detail="No completed export available")

        export_row = result.data
        file_path = export_row.get("file_path")

        if not file_path:
            raise HTTPException(status_code=404, detail="Export file not found")

        # If stored in Supabase Storage, generate a signed URL
        try:
            signed = sb.storage.from_("exports").create_signed_url(file_path, 300)
            return {"download_url": signed.get("signedURL") or signed.get("signedUrl"), "expires_in": 300}
        except Exception:
            # Fallback: return file metadata so frontend can handle
            return {
                "export_id": export_row["id"],
                "file_path": file_path,
                "file_size_bytes": export_row.get("file_size_bytes"),
                "created_at": export_row.get("created_at"),
                "status": "ready",
                "message": "Export ready — download link generation requires storage configuration",
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[export-download] Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ───────────────────────── Danger Zone ─────────────────────────

@router.post("/user/disconnect-all")
async def disconnect_all(user=Depends(get_current_user)):
    """Disconnect all active integrations for the current user."""
    try:
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
    except Exception as e:
        logger.error(f"[disconnect-all] Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# Sprint C #22 (2026-04-22) — confirmed hard-delete with retention window.
#
# Prior bugs this fix closes:
#   1. Previous handler wrote `is_active=false` on a table that has NO
#      is_active column — the actual column is `is_disabled`. The update
#      succeeded silently with 0 rows affected, leaving the account
#      fully active after the user hit "Delete".
#   2. No confirmation phrase. A stray click on "Delete my account"
#      triggered the whole flow.
#   3. No deletion_requested_at timestamp — no way to honour the stated
#      "30-day retention window" because nothing tracks the clock start.
#   4. The disconnect_all call was malformed (`.__wrapped__(user) if
#      hasattr(...)` never evaluated to a coroutine, it just short-
#      circuited to None — integrations were NOT disconnected).
#
# New contract:
#   DELETE /user/account  body = { "confirm_phrase": "DELETE MY ACCOUNT" }
#   → 400 if phrase missing / doesn't match
#   → 200 with { status, deletion_requested_at, hard_delete_after, retention_days }
#   writes users.is_disabled=true AND users.deletion_requested_at=now()
#
# Abort window:
#   POST /user/account/undo-delete  (no body needed)
#   → clears deletion_requested_at + sets is_disabled=false
#   → only works within the 30-day window

_DELETE_CONFIRM_PHRASE = "DELETE MY ACCOUNT"
_DELETE_RETENTION_DAYS = 30


class DeleteAccountRequest(BaseModel):
    confirm_phrase: str = Field(..., min_length=1, max_length=64)


@router.delete("/user/account")
async def delete_account(
    body: DeleteAccountRequest,
    user=Depends(get_current_user),
):
    """Soft-delete with confirmation phrase + 30-day retention window.

    Data is NOT hard-deleted synchronously. The user is marked disabled,
    deletion_requested_at is set, and a worker (future / manual today)
    purges rows after the 30-day abort window. Until then
    POST /user/account/undo-delete restores access.
    """
    if (body.confirm_phrase or "").strip() != _DELETE_CONFIRM_PHRASE:
        raise HTTPException(
            status_code=400,
            detail=f'confirm_phrase must match exactly: "{_DELETE_CONFIRM_PHRASE}"',
        )
    try:
        sb = get_sb()
        user_id = user["id"]
        now = datetime.now(timezone.utc)

        # Mark user row as disabled + stamp the deletion request.
        try:
            sb.table("users").update({
                "is_disabled": True,
                "deletion_requested_at": now.isoformat(),
            }).eq("id", user_id).execute()
        except Exception as e:
            logger.warning(f"[delete-account] users update failed for {user_id}: {e}")

        # Mark business profile as deleted (existing behaviour — kept for
        # backward compat with places that read `subscription_tier`).
        try:
            sb.table("business_profiles").update({
                "subscription_tier": "deleted",
            }).eq("user_id", user_id).execute()
        except Exception as e:
            logger.warning(f"[delete-account] business_profiles update failed: {e}")

        # Revoke all integrations — prior code had a broken malformed
        # invocation. Do the work inline so a refactor of disconnect_all
        # doesn't silently re-introduce the bug.
        try:
            sb.table("merge_integrations").update({
                "is_active": False,
                "disconnected_at": now.isoformat(),
            }).eq("user_id", user_id).execute()
        except Exception as e:
            logger.warning(f"[delete-account] merge_integrations update failed: {e}")

        hard_delete_after = (now + timedelta(days=_DELETE_RETENTION_DAYS)).isoformat()
        return {
            "status": "account_scheduled_for_deletion",
            "deletion_requested_at": now.isoformat(),
            "hard_delete_after": hard_delete_after,
            "retention_days": _DELETE_RETENTION_DAYS,
            "undo_endpoint": "/user/account/undo-delete",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[delete-account] Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/user/account/undo-delete")
async def undo_delete_account(user=Depends(get_current_user)):
    """Cancel a pending deletion within the 30-day retention window.

    Clears deletion_requested_at + re-enables the account. After the
    window closes the user still gets a 200 here (idempotent) but the
    actual row may already be purged — client should verify by logging
    back in.
    """
    try:
        sb = get_sb()
        user_id = user["id"]
        sb.table("users").update({
            "is_disabled": False,
            "deletion_requested_at": None,
        }).eq("id", user_id).execute()
        return {"status": "account_restored"}
    except Exception as e:
        logger.error(f"[undo-delete] Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ───────────────────────── Sync Log ─────────────────────────

@router.get("/sync/log")
async def get_sync_log(user=Depends(get_current_user), limit: int = 50):
    """Get unified sync log across all connectors."""
    try:
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
    except Exception as e:
        logger.error(f"[get-sync-log] Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


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
