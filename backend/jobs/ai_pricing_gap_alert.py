"""Daily alert on v_ai_pricing_gaps (Step 15 / P1-11).

Purpose
-------
`v_ai_pricing_gaps` (migration 094) aggregates rows in `ai_usage_log` where
the model produced billable tokens (input_tokens > 0 OR output_tokens > 0)
but `cost_aud = 0`. That means either:

  1. The model name is missing from `backend/middleware/token_metering.py`
     MODEL_PRICING, so cost lookup returned 0 and the platform silently
     under-reports LLM spend on the GP dashboards. Margin leak.

  2. The logging row was written in a degraded state (pricing lookup
     errored but the request still served). Needs investigation.

In both cases, ops must know within one business day, because every day
that passes widens the GP-reporting blind spot and makes the fix harder
to backfill.

The alerting is intentionally minimal: once a day, run this job, look at
the view, and if it has rows, send an email via Resend. The email lists
the offending models, how many rows + tokens each has, when first / last
seen, and how many unique users are affected. That's enough for the ops
owner to open `backend/middleware/token_metering.py`, add the missing
entry to MODEL_PRICING, and redeploy.

Trigger points (all driven by ops — this module has no scheduler):
    • POST /api/admin/cost/pricing-gaps/alert — manual, super-admin only
    • Azure Logic App timer → admin endpoint (recommended: daily 08:00 UTC
      Monday–Friday, which is ~18:00 AEST / just after the ops team's
      morning standup so action can be taken same day)

Design notes
------------
• The admin_ai_pricing_gaps RPC enforces its own auth, so this job always
  runs with service_role and passes the check via the JWT claim path
  rather than the per-user super_admin lookup. That keeps the job
  independent of any particular admin user's tier.

• We DON'T raise on Resend failure — ops would rather know about gaps via
  logs than have the whole run fail and write nothing to the audit table.
  The summary return includes `email_sent: False` + `email_error: str`
  when Resend is down so the next run surfaces the same gaps again.

• Empty-result runs still write an audit row with `gap_count=0` so ops
  can see "the job has been running; there simply are no gaps today".
  Silent success would be indistinguishable from a broken cron.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)


# ═══ Top-level run entrypoint ══════════════════════════════════════
#
# The admin endpoint calls this and returns its dict verbatim. Keep the
# shape stable: dashboards and audit rows reference these keys.

async def run_pricing_gap_alert(sb: Any, *, force_send: bool = False) -> Dict[str, Any]:
    """Check v_ai_pricing_gaps and alert ops if any rows exist.

    Parameters
    ----------
    sb
        A service-role Supabase client (required so the RPC auth check
        passes via the `service_role` JWT claim).
    force_send
        When True, send the email even if gap_count is 0. Useful for
        testing the pipeline end-to-end without waiting for a real gap.

    Returns
    -------
    Dict with:
        run_id: str (uuid)
        started_at / finished_at: ISO-8601 timestamps
        gap_count: int (rows in v_ai_pricing_gaps)
        gaps: list of dicts (model_used, row_count, total_input_tokens,
            total_output_tokens, first_seen, last_seen, affected_users)
        email_sent: bool
        email_error: str | None (only present on failure)
        skipped_reason: str | None (e.g. 'no_gaps', 'resend_not_configured')
    """
    import uuid

    run_id = str(uuid.uuid4())
    started_at = datetime.now(timezone.utc)
    summary: Dict[str, Any] = {
        "run_id": run_id,
        "started_at": started_at.isoformat(),
        "gap_count": 0,
        "gaps": [],
        "email_sent": False,
    }

    try:
        rpc_result = sb.rpc("admin_ai_pricing_gaps", {"p_limit": 50}).execute()
        gaps = list(rpc_result.data or [])
    except Exception as exc:
        logger.error("[PricingGapAlert] RPC call failed: %s", exc, exc_info=True)
        summary["finished_at"] = datetime.now(timezone.utc).isoformat()
        summary["error"] = f"{type(exc).__name__}: {exc}"
        return summary

    summary["gap_count"] = len(gaps)
    summary["gaps"] = gaps

    # Skip email when there's nothing to report (unless force_send),
    # but still return a clean summary so the audit row records a 'ran OK'
    # signal.
    if not gaps and not force_send:
        summary["skipped_reason"] = "no_gaps"
        summary["finished_at"] = datetime.now(timezone.utc).isoformat()
        logger.info("[PricingGapAlert] run_id=%s: no gaps, no email sent", run_id)
        return summary

    # Send email via Resend. Behaviour matrix:
    #   • No RESEND_API_KEY: record skipped_reason, don't fail the run
    #   • Send error:        record email_error, don't fail the run
    #   • Send success:      email_sent=True
    try:
        send_result = await _send_gap_alert_email(gaps, run_id=run_id)
    except Exception as exc:
        # The helper already catches + logs; bare except here is a
        # belt-and-braces guard for anything the helper might re-raise.
        logger.error("[PricingGapAlert] email send raised: %s", exc, exc_info=True)
        send_result = {"sent": False, "error": f"{type(exc).__name__}: {exc}"}

    summary["email_sent"] = bool(send_result.get("sent"))
    if send_result.get("error"):
        summary["email_error"] = send_result["error"]
    if send_result.get("skipped_reason"):
        summary["skipped_reason"] = send_result["skipped_reason"]

    summary["finished_at"] = datetime.now(timezone.utc).isoformat()
    logger.info(
        "[PricingGapAlert] run_id=%s: gap_count=%s email_sent=%s",
        run_id,
        summary["gap_count"],
        summary["email_sent"],
    )
    return summary


# ═══ Email helper ═══════════════════════════════════════════════════

async def _send_gap_alert_email(
    gaps: List[Dict[str, Any]],
    *,
    run_id: str,
) -> Dict[str, Any]:
    """Send the alert via Resend. Returns {sent, error?, skipped_reason?}."""
    # Late imports so this module stays importable in test environments
    # where core.config isn't bootable.
    try:
        from core.config import (
            BIQC_ADMIN_NOTIFICATION_EMAIL,
            RESEND_API_KEY,
            RESEND_FROM_EMAIL,
        )
    except Exception as import_err:
        logger.warning("[PricingGapAlert] core.config unavailable: %s", import_err)
        return {"sent": False, "skipped_reason": "resend_config_unavailable"}

    if not RESEND_API_KEY:
        logger.debug("[PricingGapAlert] RESEND_API_KEY not set; skipping email")
        return {"sent": False, "skipped_reason": "resend_not_configured"}
    if not RESEND_FROM_EMAIL:
        logger.warning("[PricingGapAlert] RESEND_FROM_EMAIL not set; skipping email")
        return {"sent": False, "skipped_reason": "resend_from_email_missing"}

    subject = (
        f"BIQc AI pricing gaps: {len(gaps)} model(s) missing from MODEL_PRICING"
    )
    body = _format_gap_email_body(gaps, run_id=run_id)

    payload = {
        "from": RESEND_FROM_EMAIL,
        "to": [BIQC_ADMIN_NOTIFICATION_EMAIL],
        "subject": subject,
        "text": body,
    }

    try:
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
                "[PricingGapAlert] Resend API error: %s %s",
                r.status_code,
                (r.text or "")[:500],
            )
            return {
                "sent": False,
                "error": f"resend_{r.status_code}: {(r.text or '')[:200]}",
            }
        return {"sent": True}
    except Exception as exc:
        logger.warning("[PricingGapAlert] Resend call raised: %s", exc)
        return {"sent": False, "error": f"{type(exc).__name__}: {exc}"}


def _format_gap_email_body(gaps: List[Dict[str, Any]], *, run_id: str) -> str:
    """Format the alert text body. Plain text — the audience is ops."""
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    lines: List[str] = [
        "BIQc AI pricing gap alert",
        "",
        f"Run ID:   {run_id}",
        f"Run time: {now}",
        f"Gaps:     {len(gaps)} model(s) produced billable tokens with cost_aud = 0",
        "",
        "WHY THIS MATTERS",
        "  These rows mean the platform served LLM responses and didn't log",
        "  a cost. GP dashboards under-report LLM spend until MODEL_PRICING",
        "  is updated. Every hour of delay widens the reporting blind spot.",
        "",
        "FIX",
        "  1. Open backend/middleware/token_metering.py",
        "  2. Add each model below to MODEL_PRICING with input / output rates",
        "     (check the model provider's published pricing page)",
        "  3. Redeploy — new rows will backfill correctly; historical rows",
        "     keep cost_aud=0 unless you backfill manually",
        "",
        "OFFENDING MODELS",
    ]
    for gap in gaps:
        lines.append(
            f"  • {gap.get('model_used')!r}  "
            f"rows={gap.get('row_count')}  "
            f"in_tok={gap.get('total_input_tokens')}  "
            f"out_tok={gap.get('total_output_tokens')}  "
            f"users={gap.get('affected_users')}  "
            f"first={gap.get('first_seen')}  "
            f"last={gap.get('last_seen')}"
        )
    lines += [
        "",
        "DASHBOARD",
        "  Super-admin → Cost → Pricing Gaps (or GET /api/admin/cost/pricing-gaps)",
        "",
        "— BIQc automated alert",
    ]
    return "\n".join(lines)
