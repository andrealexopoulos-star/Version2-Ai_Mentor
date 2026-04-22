"""BIQc Super Admin + Support Console — Backend Routes.

All actions audit-logged. All routes require super_admin role + feature flag.
"""
import logging
import os
from datetime import datetime, timezone
import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Optional

logger = logging.getLogger(__name__)
router = APIRouter()

from routes.auth import get_current_user
from tier_resolver import resolve_tier
from intelligence_spine import _get_cached_flag


def _require_super_admin(current_user: dict):
    if resolve_tier(current_user) != 'super_admin':
        raise HTTPException(status_code=403, detail="Super admin access required")
    if not _get_cached_flag('super_admin_enabled'):
        raise HTTPException(status_code=403, detail="Super admin feature not enabled")


def _get_service_client():
    try:
        from routes.deps import get_sb
        return get_sb()
    except Exception:
        from supabase_client import init_supabase
        sb = init_supabase()
        if not sb:
            raise HTTPException(status_code=503, detail="Database is unavailable")
        return sb


# ═══ SUPER ADMIN TEST PAGE ═══

@router.get("/super-admin/verify")
async def verify_super_admin(current_user: dict = Depends(get_current_user)):
    """Verify super admin status and feature flags."""
    _require_super_admin(current_user)
    tier = resolve_tier(current_user)
    flags = {}
    for flag in ['super_admin_enabled', 'support_page_enabled', 'legal_menu_enabled',
                 'rag_chat_enabled', 'memory_layer_enabled', 'marketing_benchmarks_enabled',
                 'marketing_automation_enabled', 'observability_full_enabled', 'guardrails_enabled']:
        flags[flag] = _get_cached_flag(flag)

    return {
        'email': current_user.get('email', ''),
        'user_id': current_user.get('id', ''),
        'role': tier,
        'is_super_admin': tier == 'super_admin',
        'feature_flags': flags,
        'verified': tier == 'super_admin',
    }


# ═══ SUPPORT CONSOLE — USER LIST ═══

@router.get("/support/users")
async def list_all_users(current_user: dict = Depends(get_current_user)):
    """List all users with business profiles. Super admin only."""
    _require_super_admin(current_user)
    if not _get_cached_flag('support_page_enabled'):
        raise HTTPException(status_code=403, detail="Support page not enabled")
    try:
        sb = _get_service_client()
        result = sb.rpc('admin_list_users', {}).execute()
        return {'users': result.data if isinstance(result.data, list) else []}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ═══ DISABLE / ENABLE ═══

class ToggleUserRequest(BaseModel):
    user_id: str
    disable: bool


@router.post("/support/toggle-user")
async def toggle_user(req: ToggleUserRequest, current_user: dict = Depends(get_current_user)):
    """Disable or enable a user account. Audit logged."""
    _require_super_admin(current_user)
    try:
        sb = _get_service_client()
        result = sb.rpc('admin_toggle_user', {
            'p_admin_id': current_user['id'],
            'p_target_id': req.user_id,
            'p_disable': req.disable,
        }).execute()
        return result.data if result.data else {'status': 'ok'}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ═══ RESET PASSWORD ═══

class ResetPasswordRequest(BaseModel):
    user_id: str
    email: str


@router.post("/support/reset-password")
async def reset_password(req: ResetPasswordRequest, current_user: dict = Depends(get_current_user)):
    """Trigger password reset email via Supabase Auth. Audit logged."""
    _require_super_admin(current_user)
    try:
        sb = _get_service_client()
        target = sb.table('users').select('id, email').eq('id', req.user_id).single().execute()
        target_user = target.data or {}
        if not target_user:
            raise HTTPException(status_code=404, detail="User not found")

        target_email = (target_user.get('email') or '').strip().lower()
        requested_email = (req.email or '').strip().lower()
        if not target_email or requested_email != target_email:
            raise HTTPException(status_code=400, detail="User/email mismatch")

        # Supabase admin API for password reset
        sb.auth.admin.generate_link({'type': 'recovery', 'email': target_email})
        # Audit log
        sb.table('admin_actions').insert({
            'admin_user_id': current_user['id'],
            'target_user_id': req.user_id,
            'action_type': 'reset_password',
            'new_value': {'email': target_email},
        }).execute()
        return {'status': 'reset_sent', 'email': target_email}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ═══ UPDATE SUBSCRIPTION ═══

class UpdateSubRequest(BaseModel):
    user_id: str
    tier: str


@router.post("/support/update-subscription")
async def update_subscription(req: UpdateSubRequest, current_user: dict = Depends(get_current_user)):
    """Change user subscription tier. Audit logged."""
    _require_super_admin(current_user)
    if req.tier not in ['free', 'starter', 'professional', 'enterprise', 'super_admin']:
        raise HTTPException(status_code=400, detail="Invalid tier")
    try:
        sb = _get_service_client()
        result = sb.rpc('admin_update_subscription', {
            'p_admin_id': current_user['id'],
            'p_target_id': req.user_id,
            'p_tier': req.tier,
        }).execute()
        return result.data if result.data else {'status': 'ok'}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ═══ IMPERSONATE ═══

class ImpersonateRequest(BaseModel):
    user_id: str


@router.post("/support/impersonate")
async def impersonate_user(req: ImpersonateRequest, current_user: dict = Depends(get_current_user)):
    """Create impersonation session. Audit logged with admin + target + timestamp."""
    _require_super_admin(current_user)
    try:
        sb = _get_service_client()
        # Get target user details
        target = sb.table('users').select('id, email, full_name, role').eq('id', req.user_id).single().execute()
        if not target.data:
            raise HTTPException(status_code=404, detail="User not found")
        # Audit log
        sb.table('admin_actions').insert({
            'admin_user_id': current_user['id'],
            'target_user_id': req.user_id,
            'action_type': 'impersonate_start',
            'new_value': {'target_email': target.data.get('email'), 'admin_email': current_user.get('email')},
        }).execute()
        return {
            'status': 'impersonation_active',
            'target': target.data,
            'admin_id': current_user['id'],
            'warning': 'You are now viewing as this user. All actions are logged.',
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ═══ ADMIN ACTIONS LOG ═══

@router.get("/support/audit-log")
async def get_admin_audit_log(current_user: dict = Depends(get_current_user)):
    """Get admin action audit trail."""
    _require_super_admin(current_user)
    try:
        sb = _get_service_client()
        result = sb.table('admin_actions').select('*').order('created_at', desc=True).limit(50).execute()
        return {'actions': result.data or []}
    except Exception:
        return {'actions': []}



# ═══ ENTERPRISE CONTACT REQUEST ═══

class EnterpriseContactRequest(BaseModel):
    name: str
    business_name: Optional[str] = ''
    email: str
    phone: Optional[str] = ''
    callback_date: str
    callback_time: str
    description: str
    feature_requested: Optional[str] = ''
    user_id: Optional[str] = None
    current_tier: Optional[str] = 'free'


async def _notify_admin_enterprise_contact(req: EnterpriseContactRequest, submitter: dict) -> None:
    """Send admin alert via Resend (httpx). Never raises; failures are logged only."""
    try:
        from core.config import BIQC_ADMIN_NOTIFICATION_EMAIL, RESEND_API_KEY, RESEND_FROM_EMAIL
        if not RESEND_API_KEY:
            logger.debug("RESEND_API_KEY not set; skipping enterprise contact admin email")
            return
        if not RESEND_FROM_EMAIL:
            logger.warning("RESEND_FROM_EMAIL not set; skipping enterprise contact admin email")
            return
        is_waitlist = str(req.current_tier or "").strip().lower() == "waitlist"
        feat = (req.feature_requested or "").strip()
        if is_waitlist:
            subject = f"New Waitlist Request: {feat}" if feat else "New Waitlist Request"
        else:
            subject = "New Contact Request"
        lines = [
            "A new enterprise contact or waitlist form was submitted.",
            "",
            f"Name: {req.name}",
            f"Email: {req.email}",
            f"Company: {req.business_name or '(not provided)'}",
            f"Phone: {req.phone or '(not provided)'}",
            f"Feature requested: {feat or '(none)'}",
            f"Callback date: {req.callback_date}",
            f"Callback time: {req.callback_time}",
            f"Current tier / source: {req.current_tier or '(not provided)'}",
            "",
            "Description / message (waitlist business size may appear here):",
            req.description or "(empty)",
            "",
            f"Submitter user id: {submitter.get('id') or '(unknown)'}",
        ]
        body = "\n".join(lines)
        payload = {
            "from": RESEND_FROM_EMAIL,
            "to": [BIQC_ADMIN_NOTIFICATION_EMAIL],
            "subject": subject,
            "text": body,
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(
                "https://api.resend.com/emails",
                json=payload,
                headers={
                    "Authorization": f"Bearer {RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
            )
            if r.status_code >= 400:
                logger.warning(
                    "Resend API error for enterprise contact notify: %s %s",
                    r.status_code,
                    (r.text or "")[:500],
                )
    except Exception as e:
        logger.warning("enterprise contact admin notification failed: %s", e, exc_info=True)


async def _get_optional_user(request: Request) -> dict:
    """Best-effort auth extraction for public contact submissions."""
    auth_header = request.headers.get("Authorization", "").strip()
    if not auth_header.startswith("Bearer "):
        return {}
    token = auth_header.split(" ", 1)[1].strip()
    if not token:
        return {}
    try:
        from auth_supabase import verify_supabase_token
        user = await verify_supabase_token(token)
        return user if isinstance(user, dict) else {}
    except Exception:
        return {}


@router.post("/enterprise/contact-request")
async def enterprise_contact_request(
    req: EnterpriseContactRequest,
    request: Request,
    background_tasks: BackgroundTasks,
):
    """Store enterprise contact request. Will eventually be synced to HubSpot."""
    current_user = await _get_optional_user(request)
    try:
        sb = _get_service_client()
        now = datetime.now(timezone.utc).isoformat()
        sb.table('enterprise_contact_requests').insert({
            'user_id': current_user.get('id'),
            'name': req.name,
            'business_name': req.business_name,
            'email': req.email,
            'phone': req.phone,
            'callback_date': req.callback_date,
            'callback_time': req.callback_time,
            'description': req.description,
            'feature_requested': req.feature_requested,
            'current_tier': req.current_tier,
            'status': 'pending',
            'created_at': now,
        }).execute()
        background_tasks.add_task(_notify_admin_enterprise_contact, req, current_user)
    except Exception as e:
        logger.warning(f"enterprise_contact_requests table may not exist yet: {e}")
    return {'status': 'received', 'message': 'Request logged. Our team will be in touch within 1 business day.'}


@router.get("/enterprise/contact-requests")
async def list_enterprise_contacts(current_user: dict = Depends(get_current_user)):
    """List all enterprise contact requests (admin only)."""
    _require_super_admin(current_user)
    try:
        sb = _get_service_client()
        result = sb.table('enterprise_contact_requests').select('*').order('created_at', desc=True).limit(100).execute()
        return {'requests': result.data or []}
    except Exception as e:
        logger.warning(f"enterprise_contact_requests table may not exist: {e}")
        return {'requests': []}


@router.get("/admin/jobs/dead-letter")
async def get_dead_letter_queue(current_user: dict = Depends(get_current_user)):
    """Retrieve failed jobs from the Redis dead-letter queue (admin only)."""
    _require_super_admin(current_user)
    try:
        from biqc_jobs import biqc_jobs
        jobs = await biqc_jobs.get_dead_letter_jobs(limit=50)
        return {"dead_letter_jobs": jobs, "count": len(jobs)}
    except Exception as e:
        logger.warning(f"Failed to read dead-letter queue: {e}")
        return {"dead_letter_jobs": [], "count": 0, "error": str(e)}


@router.get("/admin/jobs/queue-health")
async def get_queue_health(current_user: dict = Depends(get_current_user)):
    """Detailed Redis queue + worker health (admin only).

    Surfaces queue depth, delayed depth, DLQ depth, log-buffer depth, and
    which worker instance currently holds the leader lock for periodic
    housekeeping (delayed-job promotion + log-buffer flush).
    """
    _require_super_admin(current_user)
    try:
        from biqc_jobs import biqc_jobs
        return await biqc_jobs.health_async()
    except Exception as e:
        logger.warning(f"Failed to read queue health: {e}")
        return {"redis_connected": False, "error": str(e)}


@router.get("/admin/cost/pricing-gaps")
async def get_ai_pricing_gaps(current_user: dict = Depends(get_current_user)):
    """Models that produced billable tokens but recorded zero cost — i.e.
    they're missing from `MODEL_PRICING`. These distort the GP view; admins
    must add them to backend/middleware/token_metering.py MODEL_PRICING and
    redeploy. Empty list = healthy.
    """
    _require_super_admin(current_user)
    try:
        from supabase_client import get_supabase_client
        sb = get_supabase_client()
        result = sb.rpc("admin_ai_pricing_gaps", {"p_limit": 50}).execute()
        rows = result.data or []
        return {"pricing_gaps": rows, "count": len(rows)}
    except Exception as e:
        logger.warning(f"Failed to read pricing gaps: {e}")
        return {"pricing_gaps": [], "count": 0, "error": str(e)}


# ═══ STRIPE ↔ DB RECONCILE (Step 10 / P1-5) ═══════════════════════
#
# Nightly job that compares Stripe's source of truth against our
# `users` mirror and records drift into `stripe_reconcile_log`
# (migration 097). Triggered by an Azure Logic App timer hitting this
# endpoint with super-admin auth.
#
# Why an HTTP endpoint and not pg_cron:
#   • We need access to the Stripe SDK (Python package + secret key),
#     which the DB can't invoke directly.
#   • Super-admin auth + audit trail is free here; adding a new cron
#     service would duplicate that surface.
#   • Manual "run it now to check drift before a release" is trivial
#     via curl once the endpoint exists.
#
# The underlying job re-raises on Stripe API failure so we surface a
# 502 rather than return a misleading "0 drifts" success. Per-sub
# errors are caught inside and become `missing_user` drift rows with
# internal_error notes so the batch keeps going.

@router.post("/admin/stripe/reconcile")
async def trigger_stripe_reconcile(current_user: dict = Depends(get_current_user)):
    """Run one Stripe → DB reconcile pass and return a summary.

    Super-admin only. Intended to be invoked nightly (02:00 UTC) by an
    Azure Logic App / Cloud Scheduler timer with an admin-issued bearer.
    The response shape matches what gets written to the `run_summary`
    row in `stripe_reconcile_log`, so dashboards can dedupe against it.

    Returns
    -------
    JSON with run_id, checked_subscriptions, drift_counts, total_drift,
    started_at / finished_at timestamps, and per-sub error strings (if any).

    Raises
    ------
    502 when the Stripe API is unreachable — explicitly NOT swallowed,
    because a silent zero-drift run would give ops false confidence the
    mirror is healthy when in fact we never queried Stripe at all.
    """
    _require_super_admin(current_user)
    try:
        from jobs.stripe_reconcile import run_stripe_reconcile
        sb = _get_service_client()
        summary = run_stripe_reconcile(sb)
        # Audit so ops can see "who ran reconcile at 2:03am last Tuesday".
        try:
            sb.table("admin_actions").insert({
                "admin_user_id": current_user.get("id"),
                "action_type": "stripe_reconcile_run",
                "new_value": {
                    "run_id": summary.get("run_id"),
                    "checked": summary.get("checked_subscriptions"),
                    "total_drift": summary.get("total_drift"),
                },
            }).execute()
        except Exception as audit_exc:  # pragma: no cover — audit must never block the response
            logger.warning("[StripeReconcile] audit insert failed: %s", audit_exc)
        return summary
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("[StripeReconcile] run failed: %s", exc, exc_info=True)
        # 502 (Bad Gateway) is the right signal — the failure lives
        # upstream (Stripe API) or at the job boundary, not in our logic.
        raise HTTPException(
            status_code=502,
            detail=f"Stripe reconcile failed: {type(exc).__name__}: {exc}",
        )


# ═══ MERGE INTEGRATION HEALTH CHECK ══════════════════════════════════
#
# Validates all Merge.dev account tokens are still active by pinging
# their APIs. Marks stale integrations as 'needs_reconnect'. Run via
# pg_cron every 4 hours or manually via this endpoint.
@router.post("/admin/merge/health-check")
async def admin_merge_health_check(current_user: dict = Depends(get_current_user)):
    """Run Merge.dev integration health check. Super-admin only."""
    _require_super_admin(current_user)
    try:
        from jobs.merge_health_check import run_merge_health_check
        result = await run_merge_health_check(_get_service_client())
        return {"ok": True, **result}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Health check failed: {exc}")


# ═══ AI PRICING GAP DAILY ALERT (Step 15 / P1-11) ════════════════════
#
# Queries v_ai_pricing_gaps and emails ops via Resend if any rows exist.
# Triggered daily by an Azure Logic App timer hitting this endpoint. The
# underlying job is an async function because the Resend call runs
# through httpx.AsyncClient; the endpoint awaits it directly.
#
# Failure semantics match stripe/reconcile:
#   • Resend outage → logged + surfaced in response, 200 still returned
#     (the GAP DATA itself is valuable even if email send failed)
#   • Supabase RPC outage → 502 (Bad Gateway) so the Logic App retries
#
# The run_summary dict mirrors what jobs/stripe_reconcile.py returns so
# dashboards and audit rows can be deduped on run_id.

@router.post("/admin/cost/pricing-gaps/alert")
async def trigger_pricing_gap_alert(
    force_send: bool = False,
    current_user: dict = Depends(get_current_user),
):
    """Run the daily AI pricing gap alert and return a summary.

    Super-admin only. Intended to be invoked daily (08:00 UTC Mon–Fri)
    by an Azure Logic App / Cloud Scheduler timer with an admin bearer.

    Query params
    ------------
    force_send : bool, default False
        When True, send the alert email even if the gap list is empty.
        Used by ops to smoke-test the Resend pipeline end-to-end.

    Returns
    -------
    JSON with run_id, started_at / finished_at, gap_count, gaps[],
    email_sent (bool), and optional email_error / skipped_reason.
    HTTP 200 even when Resend errored — the gap data itself is the
    payload the dashboard consumes.

    Raises
    ------
    502 when the Supabase RPC is unreachable — that's the only failure
    mode that invalidates the whole run.
    """
    _require_super_admin(current_user)
    try:
        from jobs.ai_pricing_gap_alert import run_pricing_gap_alert
        sb = _get_service_client()
        summary = await run_pricing_gap_alert(sb, force_send=bool(force_send))
        # Audit row mirrors the stripe_reconcile_run pattern so ops can
        # see both runs side-by-side in admin_actions history.
        try:
            sb.table("admin_actions").insert({
                "admin_user_id": current_user.get("id"),
                "action_type": "ai_pricing_gap_alert_run",
                "new_value": {
                    "run_id": summary.get("run_id"),
                    "gap_count": summary.get("gap_count"),
                    "email_sent": summary.get("email_sent"),
                    "skipped_reason": summary.get("skipped_reason"),
                },
            }).execute()
        except Exception as audit_exc:  # pragma: no cover
            logger.warning("[PricingGapAlert] audit insert failed: %s", audit_exc)
        # If the RPC itself errored, surface as 502 so the Logic App retries.
        if summary.get("error"):
            raise HTTPException(
                status_code=502,
                detail=f"Pricing gap RPC failed: {summary['error']}",
            )
        return summary
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("[PricingGapAlert] run failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=502,
            detail=f"Pricing gap alert failed: {type(exc).__name__}: {exc}",
        )


# ═══ MORNING BRIEF WORKER (Sprint A #2 / E15) ════════════════════════
#
# Drains intelligence_queue rows where schedule_key='morning_brief' and
# status='queued', builds + sends the E15 Morning Brief email, and
# marks rows completed/failed.
#
# Triggered in production by the `intel_process_morning_brief` pg_cron
# job (migration 117) which POSTs to /api/intelligence/process-morning-brief.
# This super-admin endpoint is for manual smoke tests + emergency drains
# when the cron is paused.

@router.post("/super-admin/run-morning-brief-worker")
async def trigger_morning_brief_worker(
    batch_size: int = 50,
    current_user: dict = Depends(get_current_user),
):
    """Run one pass of the morning_brief worker and return a summary.

    Super-admin only. Safe to call any time — the worker is idempotent
    (claim-lock via status='processing') and a no-op when the queue is
    empty.

    Query params
    ------------
    batch_size : int, default 50
        Maximum queue rows to drain in this pass. Clamped to [1, 500].

    Returns
    -------
    JSON summary: {total_processed, sent, failed, skipped,
                   batch_size, started_at, finished_at}.
    """
    _require_super_admin(current_user)
    # Clamp to sane bounds — a malicious/typoed batch_size=1_000_000
    # would happily exhaust Resend rate limit in one call.
    batch_size = max(1, min(int(batch_size or 50), 500))
    try:
        from jobs.morning_brief_worker import run_morning_brief_worker
        summary = await run_morning_brief_worker(batch_size=batch_size)
        # Audit row — mirrors the stripe_reconcile / pricing_gap pattern.
        try:
            sb = _get_service_client()
            sb.table("admin_actions").insert({
                "admin_user_id": current_user.get("id"),
                "action_type": "morning_brief_worker_run",
                "new_value": {
                    "batch_size": summary.get("batch_size"),
                    "total_processed": summary.get("total_processed"),
                    "sent": summary.get("sent"),
                    "failed": summary.get("failed"),
                    "skipped": summary.get("skipped"),
                },
            }).execute()
        except Exception as audit_exc:  # pragma: no cover — audit must never block
            logger.warning("[MorningBriefWorker] audit insert failed: %s", audit_exc)
        return summary
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("[MorningBriefWorker] run failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=502,
            detail=f"Morning brief worker failed: {type(exc).__name__}: {exc}",
        )


# ═══ API PROVIDERS DASHBOARD (Migration 118 / 2026-04-22) ═══════════
#
# Super-admin API Providers dashboard. One row per external vendor BIQc
# uses, showing name, env var status, plan allocation note, running
# call_count, cumulative cost (AUD), status (up/down/unknown/error), and
# last error / last called. Scope locked by Andreas 2026-04-22: one row
# per provider; per-GP drill-down is deferred.

# Provider catalog: slug → (env var, plan allocation note). Plan notes
# point at vendor dashboards where BIQc's paid plan caps live; Andreas can
# later fill concrete numbers via an admin update path (deferred).
_PROVIDER_CATALOG: tuple[dict, ...] = (
    {"provider": "openai",     "env_var_name": "OPENAI_API_KEY",
     "plan_allocation_note": "Usage-based; model pricing in MODEL_PRICING (backend/middleware/token_metering.py L63-78)",
     "plan_url": "https://platform.openai.com/account/limits"},
    {"provider": "anthropic",  "env_var_name": "ANTHROPIC_API_KEY",
     "plan_allocation_note": "Usage-based; Claude 4.6 in MODEL_PRICING",
     "plan_url": "https://console.anthropic.com/settings/limits"},
    {"provider": "gemini",     "env_var_name": "GOOGLE_API_KEY",
     "plan_allocation_note": "Usage-based; Gemini 3 Pro/Flash in MODEL_PRICING",
     "plan_url": "https://aistudio.google.com/apikey"},
    {"provider": "browse_ai",  "env_var_name": "BROWSE_AI_API_KEY",
     "plan_allocation_note": "Task runs per subscription — set in Browse AI dashboard",
     "plan_url": "https://dashboard.browse.ai/plan"},
    {"provider": "semrush",    "env_var_name": "SEMRUSH_API_KEY",
     "plan_allocation_note": "API units per subscription — set in SEMrush dashboard",
     "plan_url": "https://www.semrush.com/accounts/subscription-info/"},
    {"provider": "firecrawl",  "env_var_name": "FIRECRAWL_API_KEY",
     "plan_allocation_note": "Credits per plan — set in Firecrawl dashboard",
     "plan_url": "https://www.firecrawl.dev/app/usage"},
    {"provider": "perplexity", "env_var_name": "PERPLEXITY_API_KEY",
     "plan_allocation_note": "Usage-based per model; set in Perplexity dashboard",
     "plan_url": "https://www.perplexity.ai/settings/api"},
    {"provider": "resend",     "env_var_name": "RESEND_API_KEY",
     "plan_allocation_note": "Monthly emails per tier — set in Resend dashboard",
     "plan_url": "https://resend.com/settings/billing"},
    {"provider": "stripe",     "env_var_name": "STRIPE_API_KEY",
     "plan_allocation_note": "Per-transaction fees; no plan cap",
     "plan_url": "https://dashboard.stripe.com/settings/billing"},
    {"provider": "merge",      "env_var_name": "MERGE_API_KEY",
     "plan_allocation_note": "Linked-accounts per subscription — set in Merge dashboard",
     "plan_url": "https://app.merge.dev/billing"},
    {"provider": "supabase",   "env_var_name": "SUPABASE_SERVICE_ROLE_KEY",
     "plan_allocation_note": "Project tier (DB + egress); set in Supabase dashboard",
     "plan_url": "https://supabase.com/dashboard/org/_/billing"},
    {"provider": "serper",     "env_var_name": "SERPER_API_KEY",
     "plan_allocation_note": "Credits per plan; set in serper.dev dashboard",
     "plan_url": "https://serper.dev/billing"},
    {"provider": "sentry",     "env_var_name": "SENTRY_DSN",
     "plan_allocation_note": "Events/month per org; set in Sentry dashboard",
     "plan_url": "https://sentry.io/settings/billing/"},
)

_STATUS_SORT_ORDER = {"error": 0, "down": 1, "unknown": 2, "up": 3}


@router.get("/super-admin/api-providers")
async def get_api_providers(current_user: dict = Depends(get_current_user)):
    """Return one row per external provider BIQc uses.

    Super-admin only. Shape:
      [{
        provider, env_var_name, key_configured, plan_allocation_note, plan_url,
        call_count, total_cost_aud, status, last_error, last_error_at, last_called_at
      }]

    Sort order: status='error' first, then 'down', then 'unknown', then 'up'.

    On each call we:
      1. Run refresh_provider_usage() to roll fresh LLM rows in from
         usage_ledger (idempotent).
      2. Fetch all provider_usage rows.
      3. Merge with the in-process catalog so missing-provider rows still
         render with key_configured + plan_allocation_note visible.
      4. Attach `key_configured = bool(os.environ.get(env_var_name))` at
         request time so the dashboard shows live env-var status.
    """
    _require_super_admin(current_user)

    sb = _get_service_client()

    # 1) Refresh LLM rows from usage_ledger (safe if no rows yet).
    try:
        sb.rpc("refresh_provider_usage", {}).execute()
    except Exception as exc:
        logger.warning("[api-providers] refresh_provider_usage rpc failed: %s", exc)

    # 2) Fetch all tally rows.
    try:
        res = sb.table("provider_usage").select(
            "provider, call_count, total_cost_aud_micros, last_called_at, "
            "last_error, last_error_at, status"
        ).execute()
        rows_by_slug = {(r.get("provider") or "").lower(): r for r in (res.data or [])}
    except Exception as exc:
        logger.warning("[api-providers] provider_usage select failed: %s", exc)
        rows_by_slug = {}

    out: list[dict] = []
    for meta in _PROVIDER_CATALOG:
        slug = meta["provider"]
        row = rows_by_slug.get(slug, {}) or {}
        micros = int(row.get("total_cost_aud_micros") or 0)
        out.append({
            "provider": slug,
            "env_var_name": meta["env_var_name"],
            "key_configured": bool(os.environ.get(meta["env_var_name"])),
            "plan_allocation_note": meta["plan_allocation_note"],
            "plan_url": meta["plan_url"],
            "call_count": int(row.get("call_count") or 0),
            "total_cost_aud": round(micros / 1_000_000.0, 4),
            "total_cost_aud_micros": micros,
            "status": row.get("status") or "unknown",
            "last_error": row.get("last_error"),
            "last_error_at": row.get("last_error_at"),
            "last_called_at": row.get("last_called_at"),
        })

    out.sort(key=lambda r: (_STATUS_SORT_ORDER.get(r["status"], 99), r["provider"]))
    return {"providers": out, "count": len(out)}
