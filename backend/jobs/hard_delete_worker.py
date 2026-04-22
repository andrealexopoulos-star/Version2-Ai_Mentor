"""Hard-delete sweep for accounts past the 30-day retention window.

Sprint C #22 Phase 2 (2026-04-22).

Context
-------
Phase 1 (commit ccf58b2e) added `users.deletion_requested_at TIMESTAMPTZ`
and wired the DELETE /user/account handler to stamp it + set
`is_disabled=true` after the user types the confirmation phrase. Phase 1
did NOT physically purge rows — it only starts the 30-day abort clock.

This worker closes the loop: it finds users whose
`deletion_requested_at` is > 30 days in the past (and still
is_disabled=true — an undo would have cleared both), then performs a
best-effort purge across every table the user had a right to export
from, plus the `public.users` mirror row and the backing `auth.users`
row via the Supabase Admin API.

Contract
--------
    async def run_hard_delete_sweep(sb=None) -> dict

    Returns
    -------
        {
          "users_purged":    int,           # rows actually deleted
          "users_considered":int,           # candidates seen
          "tables_affected": list[str],     # tables we attempted delete on
          "errors":          list[str],     # per-user/table failures
          "aborted":         bool,          # True if safety rail tripped
          "abort_reason":    str|None,      # human-readable abort reason
          "started_at":      ISO8601 UTC,
          "finished_at":     ISO8601 UTC,
        }

Safety rails
------------
1. 30-day retention window is enforced by the SQL filter. A row with
   `deletion_requested_at >= now() - interval '30 days'` is NEVER touched
   by this worker. Undo clears the flag within the window and takes the
   row out of the candidate set automatically.

2. The candidate MUST still have `is_disabled=true`. Any code path that
   re-enables the account (admin unsuspend, undo-delete) clears that
   flag and removes the row from the sweep.

3. Hard cap: if a single sweep would purge > 10% of the current active
   user count, the worker aborts without touching any row. This guards
   against a runaway migration, a malformed filter, or a cron clock skew
   that would otherwise cascade into mass data loss. Ops gets a clear
   summary row in `admin_actions` and can investigate before retrying.

4. Best-effort deletion: a FK / RLS / missing-table error on one
   sub-table logs the exception and continues. The audit row captures
   exactly which tables succeeded and which failed so the operator can
   run a follow-up cleanup.

5. `public.users` is deleted LAST (after all child rows). The auth row
   is the FINAL step — if we cannot delete it, we still log the public
   row's prior deletion and surface the auth orphan in the errors list.
   A surviving auth.users row blocks a fresh signup with the same email,
   so this is the only error we escalate in the returned summary.

CLI
---
    python -m backend.jobs.hard_delete_worker

Runs one full sweep and prints the summary dict as JSON. Intended for
a nightly Azure Logic App / admin endpoint trigger, not a bare-metal
cron (so we inherit telemetry + retries from the orchestrator).
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


# 30-day retention window. Must match the value in
# routes/user_settings.py so the marketing copy, the retention policy
# page, and the worker all agree.
_RETENTION_DAYS = 30

# Safety rail: abort if a sweep would purge > this percentage of the
# current active-user population. 10% is aggressive enough to catch a
# real runaway (e.g. somebody accidentally stamps every row with
# deletion_requested_at) while still allowing a legitimate bulk churn
# event (seldom exceeds single digits in practice).
_MAX_PURGE_PERCENT = 10

# Same list as backend/routes/user_settings.py:_USER_EXPORT_TABLES —
# parity here ensures we delete EXACTLY what we exported to the user.
# Keep this list in sync with that module. Tables that contain other
# users' data are NOT included — those are filtered out at the export
# layer so we never miss a deletion right because we skipped a table
# that had no `user_id` column.
_USER_PURGE_TABLES: tuple = (
    "business_profiles",
    "user_settings",
    "user_preferences",
    "onboarding",
    "chat_history",
    "documents",
    "sops",
    "email_intelligence",
    "calendar_intelligence",
    "intelligence_actions",
    "strategy_profiles",
    "cognitive_profiles",
    "observation_events",
    "observation_event_dismissals",
    "signal_snoozes",
    "signal_feedback",
    "usage_ledger",
    "payment_transactions",
    "alerts_queue",
    "action_items",
    "merge_integrations",
)


# ─── helpers ──────────────────────────────────────────────────────────

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _get_service_client():
    """Resolve a Supabase service-role client.

    Prefer the already-initialised routes.deps client (production path).
    Fall back to `init_supabase()` so this module also runs from a CLI
    invocation (e.g. `python -m backend.jobs.hard_delete_worker`) before
    FastAPI has called init_route_deps.
    """
    try:
        from routes.deps import get_sb
        return get_sb()
    except Exception:
        pass
    try:
        from supabase_client import init_supabase
        return init_supabase()
    except Exception as exc:
        logger.error("[hard_delete_worker] no supabase client available: %s", exc)
        return None


def _cutoff_iso(now: Optional[datetime] = None) -> str:
    """ISO timestamp for `now - 30 days`. Injectable for tests."""
    base = now or datetime.now(timezone.utc)
    from datetime import timedelta
    return (base - timedelta(days=_RETENTION_DAYS)).isoformat()


def _fetch_candidates(sb, cutoff_iso: str) -> List[Dict[str, Any]]:
    """Return users whose deletion request has passed the abort window.

    Filter:
        deletion_requested_at IS NOT NULL
        AND deletion_requested_at < cutoff_iso
        AND is_disabled = true

    The `is_disabled` check is redundant given a well-behaved
    undo-delete path (which clears deletion_requested_at), but it
    doubles as a belt-and-braces guard: any row that is_disabled=false
    for ANY reason is treated as restored and skipped.
    """
    try:
        res = (
            sb.table("users")
            .select("id, email, deletion_requested_at, is_disabled")
            .not_.is_("deletion_requested_at", "null")
            .lt("deletion_requested_at", cutoff_iso)
            .eq("is_disabled", True)
            .execute()
        )
        rows = getattr(res, "data", None) or []
        return [r for r in rows if r.get("id")]
    except Exception as exc:
        logger.error("[hard_delete_worker] candidate fetch failed: %s", exc)
        return []


def _fetch_active_user_count(sb) -> int:
    """Best-effort count of users whose account is still live.

    Used ONLY as the denominator for the 10% safety rail. A wrong value
    (Supabase downed, query failed) falls back to a high count so the
    safety rail errs on the side of ALLOWING the sweep — we don't want
    a transient DB blip to block a legitimate purge forever. The rail is
    about catching a malformed filter returning the whole table, not
    about enforcing a business-critical invariant.
    """
    try:
        res = (
            sb.table("users")
            .select("id", count="exact")
            .eq("is_disabled", False)
            .execute()
        )
        count = getattr(res, "count", None)
        if isinstance(count, int) and count > 0:
            return count
        # Fallback: if count isn't available, count rows in the response.
        data = getattr(res, "data", None) or []
        return max(len(data), 1)
    except Exception as exc:
        logger.warning(
            "[hard_delete_worker] active user count lookup failed, "
            "defaulting to a high number to avoid false-positive abort: %s",
            exc,
        )
        # Sentinel large value — the percentage check will never abort.
        return 1_000_000


def _purge_user_tables(sb, user_id: str) -> Dict[str, Any]:
    """Best-effort delete from every table in _USER_PURGE_TABLES.

    Returns dict {
        'purged':  list[str]    — tables where delete succeeded
        'skipped': dict[str,str] — table -> short error string
    }

    Each delete is wrapped in its own try/except so one failing table
    (missing, RLS-blocked, FK-locked) never aborts the purge. Supabase
    does not give us a cross-table transaction from the PostgREST API,
    so ordering is what we control — finish child tables first, leave
    `users` for the caller to delete last.
    """
    purged: List[str] = []
    skipped: Dict[str, str] = {}
    for table in _USER_PURGE_TABLES:
        try:
            sb.table(table).delete().eq("user_id", user_id).execute()
            purged.append(table)
        except Exception as exc:
            # Defensive: a missing table in staging/local drift, or an
            # RLS-blocked delete, must not stop the sweep. Log, record,
            # continue.
            logger.warning(
                "[hard_delete_worker] table=%s delete failed for user=%s: %s",
                table, user_id, exc,
            )
            skipped[table] = str(exc)[:200]
    return {"purged": purged, "skipped": skipped}


def _delete_public_user(sb, user_id: str) -> Optional[str]:
    """Delete the row from `public.users`. Returns an error string if
    the delete fails, None on success.
    """
    try:
        sb.table("users").delete().eq("id", user_id).execute()
        return None
    except Exception as exc:
        logger.error(
            "[hard_delete_worker] public.users delete FAILED for %s: %s",
            user_id, exc,
        )
        return f"public.users: {str(exc)[:200]}"


def _delete_auth_user(sb, user_id: str) -> Optional[str]:
    """Delete the backing auth.users row via the Admin API.

    Returns None on success, or an error string if the admin API call
    failed. A surviving auth.users row blocks re-signup with the same
    email (migration 116 previous-session investigation), so ops needs
    this surfaced prominently — we return the error and the caller
    adds it to the top-level `errors` list.
    """
    try:
        sb.auth.admin.delete_user(user_id)
        return None
    except Exception as exc:
        logger.error(
            "[hard_delete_worker] auth.users delete FAILED for %s: %s — "
            "public.users row already deleted, auth row now ORPHANED. "
            "Re-signup with same email will fail until cleaned manually.",
            user_id, exc,
        )
        return f"auth.users: {str(exc)[:200]}"


def _write_audit_row(sb, *, user_id: str, email: Optional[str],
                     tables_purged: List[str], tables_skipped: Dict[str, str],
                     auth_error: Optional[str], public_error: Optional[str]) -> None:
    """Best-effort audit — never block the sweep on a failed audit write.

    action_type='hard_delete_completed' is the canonical marker. The
    payload stores everything ops needs to reconstruct what happened if
    a customer later calls asking why their row is gone.
    """
    payload = {
        "user_id": user_id,
        "email": email,
        "tables_purged": tables_purged,
        "tables_skipped": tables_skipped,
        "public_users_error": public_error,
        "auth_users_error": auth_error,
        "timestamp": _now_iso(),
    }
    try:
        sb.table("admin_actions").insert({
            "action_type": "hard_delete_completed",
            "target_user_id": user_id,
            "new_value": payload,
        }).execute()
    except Exception as exc:
        logger.warning(
            "[hard_delete_worker] audit row write failed for user=%s: %s",
            user_id, exc,
        )


def _write_abort_audit(sb, *, reason: str, considered: int, active: int) -> None:
    """Record a safety-rail abort in admin_actions so ops can see it."""
    try:
        sb.table("admin_actions").insert({
            "action_type": "hard_delete_aborted",
            "new_value": {
                "reason": reason,
                "users_considered": considered,
                "active_users": active,
                "max_purge_percent": _MAX_PURGE_PERCENT,
                "timestamp": _now_iso(),
            },
        }).execute()
    except Exception as exc:
        logger.warning("[hard_delete_worker] abort audit write failed: %s", exc)


# ─── public entrypoint ────────────────────────────────────────────────

async def run_hard_delete_sweep(sb=None) -> Dict[str, Any]:
    """Execute one hard-delete sweep.

    Parameters
    ----------
    sb : optional Supabase service-role client. When None, the worker
        resolves one itself (routes.deps → supabase_client fallback).

    Returns
    -------
    Summary dict. See module docstring for the exact shape.
    """
    started_at = _now_iso()
    tables_affected: List[str] = []
    errors: List[str] = []
    users_purged = 0
    aborted = False
    abort_reason: Optional[str] = None

    if sb is None:
        sb = _get_service_client()
    if sb is None:
        return {
            "users_purged": 0,
            "users_considered": 0,
            "tables_affected": [],
            "errors": ["no_supabase_client"],
            "aborted": True,
            "abort_reason": "supabase client unavailable",
            "started_at": started_at,
            "finished_at": _now_iso(),
        }

    cutoff = _cutoff_iso()
    candidates = _fetch_candidates(sb, cutoff)
    considered = len(candidates)

    if considered == 0:
        finished_at = _now_iso()
        logger.info(
            "[hard_delete_worker] no candidates past %s — nothing to purge",
            cutoff,
        )
        return {
            "users_purged": 0,
            "users_considered": 0,
            "tables_affected": [],
            "errors": [],
            "aborted": False,
            "abort_reason": None,
            "started_at": started_at,
            "finished_at": finished_at,
        }

    # Safety rail — abort if the candidate set exceeds _MAX_PURGE_PERCENT
    # of the live user count. Sentinel large fallback in
    # _fetch_active_user_count means a DB outage never blocks a sweep.
    active_users = _fetch_active_user_count(sb)
    pct = (considered / max(active_users, 1)) * 100.0
    if pct > _MAX_PURGE_PERCENT:
        abort_reason = (
            f"{considered} candidates > {_MAX_PURGE_PERCENT}% of "
            f"{active_users} active users ({pct:.2f}%). "
            f"Aborting to prevent runaway purge. Investigate the filter."
        )
        logger.error("[hard_delete_worker] SAFETY ABORT: %s", abort_reason)
        _write_abort_audit(sb, reason=abort_reason, considered=considered,
                           active=active_users)
        return {
            "users_purged": 0,
            "users_considered": considered,
            "tables_affected": [],
            "errors": [],
            "aborted": True,
            "abort_reason": abort_reason,
            "started_at": started_at,
            "finished_at": _now_iso(),
        }

    # Iterate candidates. Each user's purge is independent — one failure
    # must not abort the rest of the sweep.
    for row in candidates:
        user_id = row.get("id")
        email = row.get("email")
        if not user_id:
            continue

        purge_result = _purge_user_tables(sb, user_id)
        for t in purge_result["purged"]:
            if t not in tables_affected:
                tables_affected.append(t)

        public_err = _delete_public_user(sb, user_id)
        auth_err = _delete_auth_user(sb, user_id)

        if public_err:
            errors.append(f"user={user_id}: {public_err}")
        if auth_err:
            # Auth orphans are the most important errors to surface
            # because they block a future re-signup with the same email.
            errors.append(f"user={user_id}: {auth_err}")

        _write_audit_row(
            sb,
            user_id=user_id,
            email=email,
            tables_purged=purge_result["purged"],
            tables_skipped=purge_result["skipped"],
            auth_error=auth_err,
            public_error=public_err,
        )

        if not public_err:
            users_purged += 1

    finished_at = _now_iso()
    logger.info(
        "[hard_delete_worker] sweep complete: purged=%d considered=%d errors=%d tables=%d",
        users_purged, considered, len(errors), len(tables_affected),
    )
    return {
        "users_purged": users_purged,
        "users_considered": considered,
        "tables_affected": tables_affected,
        "errors": errors,
        "aborted": aborted,
        "abort_reason": abort_reason,
        "started_at": started_at,
        "finished_at": finished_at,
    }


# ─── CLI entrypoint ───────────────────────────────────────────────────

def _cli_main() -> int:
    """Synchronous wrapper for `python -m backend.jobs.hard_delete_worker`.

    Prints the summary as JSON and exits 0 on success, 1 on safety abort
    or unrecoverable error. Does not print timestamps as anything fancy —
    ops pipes this through jq or the Azure Logic App's JSON trigger.
    """
    logging.basicConfig(
        level=os.environ.get("LOG_LEVEL", "INFO"),
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )
    try:
        summary = asyncio.run(run_hard_delete_sweep())
    except Exception as exc:
        logger.error("[hard_delete_worker] CLI run failed: %s", exc, exc_info=True)
        print(json.dumps({"error": str(exc)}))
        return 1
    print(json.dumps(summary, indent=2, default=str))
    if summary.get("aborted"):
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(_cli_main())
