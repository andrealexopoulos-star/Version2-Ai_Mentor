"""Morning Brief queue processor (P0 Sprint A #2).

Purpose
-------
Drain rows from `public.intelligence_queue` where `schedule_key='morning_brief'`
and `status='queued'`, build a personalised brief, email it via Resend (E15),
and mark the row `completed`.

Contract
--------
    async def run_morning_brief_worker(batch_size: int = 50) -> dict

Returns
    {
      "total_processed": int,   # rows we attempted in this pass
      "sent":            int,   # emails Resend accepted (returned an id)
      "failed":          int,   # rows that errored (status='failed')
      "skipped":         int,   # rows with no email / missing profile (status='failed')
      "batch_size":      int,
      "started_at":      ISO8601 UTC,
      "finished_at":     ISO8601 UTC,
    }

Design
------
• Idempotent claim-lock via `status='processing'`. The fan-out dedup inside
  `queue_intelligence_job()` prevents a second queue row while the first is
  still `processing`, so two concurrent workers picking up the same row is
  guarded at BOTH ends (unique row + a transactional UPDATE below).

• Concurrency bounded by an `asyncio.Semaphore(10)`. Resend accepts ~10 RPS
  per API key comfortably; this also caps outbound httpx connections so a
  1000-user morning doesn't saturate the worker pod.

• Content pipeline (cheap → expensive, first hit wins):
    1. Pre-computed payload on the queue row (future: cron enqueuer may
       pre-render. Currently None, so this falls through.)
    2. watchtower observation events (last 24h) via
       `get_recent_observation_events` + `build_watchtower_events`. This
       is the ONLY free signal today — cheap DB read, no LLM.
    3. Empty-state fallback ("all quiet") — template renders this cleanly.

• Failure policy:
    - Fetching user email/name: if the `users` row is missing we mark the
      queue row `failed` with error_detail and count as skipped. NEVER
      send to an empty address.
    - Resend returns None (4xx/5xx/timeout): mark `failed`, count failed.
    - Any unexpected exception inside the per-row coroutine: caught and
      marked `failed`. Never let one bad row stop the batch.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Concurrency cap for parallel Resend calls. 10 is Resend's comfortable
# zone at the free/starter tier; bump this once we upgrade the key.
_RESEND_CONCURRENCY = 10


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _sydney_greeting() -> str:
    """Return a short date-string in Australia/Sydney tz for the brief
    eyebrow. Example: 'Wednesday, 22 April'.

    Falls back to UTC if zoneinfo is missing (shouldn't happen on py>=3.9,
    but Azure's Python image has surprised us before — keep graceful).
    """
    try:
        from zoneinfo import ZoneInfo
        tz = ZoneInfo("Australia/Sydney")
        dt = datetime.now(tz)
    except Exception:  # pragma: no cover
        dt = datetime.now(timezone.utc)
    # Cross-platform day-of-month: strftime('%-d') doesn't work on Windows;
    # Azure runs Linux so %-d is fine, but hedge anyway.
    try:
        day = dt.strftime("%-d")
    except ValueError:  # Windows fallback
        day = str(int(dt.strftime("%d")))
    return dt.strftime("%A") + ", " + day + " " + dt.strftime("%B")


def _get_service_client():
    """Resolve a Supabase client usable by the worker. Prefers the shared
    get_sb() dep; falls back to init_supabase() so we still work from a
    CLI-invoked script (useful for smoke tests)."""
    try:
        from routes.deps import get_sb
        return get_sb()
    except Exception:
        pass
    try:
        from supabase_client import init_supabase
        return init_supabase()
    except Exception as exc:
        logger.error("[morning_brief_worker] no supabase client available: %s", exc)
        return None


# ─── content pipeline helpers ────────────────────────────────────────

def _build_brief_from_watchtower(sb, user_id: str) -> Dict[str, List[Dict[str, str]]]:
    """Build top_actions + overnight_signals from watchtower observation events.

    Returns {'top_actions': [...], 'overnight_signals': [...]}. Either list
    may be empty — caller passes through to the "all quiet" template path.

    This is the MVP content pipeline. Track A follow-up will layer
    `/unified/advisor` output on top, but that endpoint is per-request
    async and requires the full integration fetch — keeping this cheap
    for now so the worker scales to 1000 users on first ship.
    """
    top_actions: List[Dict[str, str]] = []
    overnight_signals: List[Dict[str, str]] = []

    try:
        from intelligence_live_truth import (
            get_recent_observation_events,
            build_watchtower_events,
        )
    except Exception as exc:
        logger.warning("[morning_brief_worker] live_truth import failed for %s: %s", user_id, exc)
        return {"top_actions": top_actions, "overnight_signals": overnight_signals}

    try:
        raw = get_recent_observation_events(sb, user_id, limit=25) or {}
        events = build_watchtower_events(raw.get("events") or [], limit=10) or []
    except Exception as exc:
        logger.warning("[morning_brief_worker] watchtower fetch failed for %s: %s", user_id, exc)
        return {"top_actions": top_actions, "overnight_signals": overnight_signals}

    severity_rank = {"critical": 0, "high": 1, "medium": 2, "moderate": 2, "low": 3, "info": 4}
    events.sort(key=lambda e: severity_rank.get((e.get("severity") or "medium").lower(), 9))

    # Top 3 severest → actions (dedup by title+detail)
    seen = set()
    for ev in events:
        title = (ev.get("title") or ev.get("signal") or "").strip()
        detail = (ev.get("detail") or ev.get("description") or "").strip()
        recommendation = (ev.get("recommendation") or ev.get("action") or "").strip()
        key = (title, detail)
        if not title or key in seen:
            continue
        seen.add(key)
        text_line = recommendation or f"Review: {title}"
        impact = detail or f"Severity: {ev.get('severity') or 'medium'}"
        top_actions.append({"text": text_line, "impact": impact})
        if len(top_actions) >= 3:
            break

    # Up to 3 signals for "what changed overnight" — prefer events NOT
    # already surfaced as actions, so the email stays varied.
    action_keys = seen.copy()
    for ev in events:
        if len(overnight_signals) >= 3:
            break
        title = (ev.get("title") or ev.get("signal") or "").strip()
        detail = (ev.get("detail") or ev.get("description") or "").strip()
        key = (title, detail)
        if not title or key in action_keys:
            continue
        action_keys.add(key)
        overnight_signals.append({"title": title, "description": detail})

    return {"top_actions": top_actions, "overnight_signals": overnight_signals}


def _build_brief_from_payload(payload: Optional[Dict[str, Any]]) -> Optional[Dict[str, List[Dict[str, str]]]]:
    """If the queue row payload already has pre-computed brief content
    (future: a lightweight cron pre-render pass), return it. Otherwise
    return None so caller falls through to watchtower."""
    if not isinstance(payload, dict):
        return None
    brief = payload.get("brief") if isinstance(payload.get("brief"), dict) else None
    if not brief:
        return None
    ta = brief.get("top_actions")
    sig = brief.get("overnight_signals")
    if isinstance(ta, list) and isinstance(sig, list):
        return {
            "top_actions": [t for t in ta if isinstance(t, dict)][:5],
            "overnight_signals": [s for s in sig if isinstance(s, dict)][:3],
        }
    return None


# ─── per-row processor (runs inside the concurrency gate) ────────────

async def _process_row(sb, row: Dict[str, Any],
                       sem: asyncio.Semaphore,
                       greeting: str) -> Dict[str, str]:
    """Process one queue row. Returns one of:
       {'status': 'sent'} / {'status': 'failed'} / {'status': 'skipped'}.
    Always marks the DB row to a terminal state. Never raises."""
    row_id = row.get("id")
    user_id = row.get("user_id")
    payload = row.get("payload")

    async with sem:
        # 1. Claim-lock — transition queued → processing atomically.
        # If this UPDATE returns zero affected rows (another worker
        # won the race) we treat as already-handled and skip.
        try:
            claim = await asyncio.to_thread(
                lambda: sb.table("intelligence_queue")
                    .update({"status": "processing", "started_at": _now_iso()})
                    .eq("id", row_id)
                    .eq("status", "queued")
                    .execute()
            )
            claimed = bool(getattr(claim, "data", None))
            if not claimed:
                logger.info("[morning_brief_worker] row %s already claimed; skipping", row_id)
                return {"status": "skipped"}
        except Exception as exc:
            logger.exception("[morning_brief_worker] claim failed row=%s: %s", row_id, exc)
            await _mark_failed(sb, row_id, f"claim_error: {exc}")
            return {"status": "failed"}

        # 2. Fetch user email + full_name.
        try:
            ures = await asyncio.to_thread(
                lambda: sb.table("users")
                    .select("id, email, full_name")
                    .eq("id", user_id)
                    .maybe_single()
                    .execute()
            )
            user_row = getattr(ures, "data", None) or {}
        except Exception as exc:
            logger.exception("[morning_brief_worker] user fetch failed row=%s user=%s: %s", row_id, user_id, exc)
            await _mark_failed(sb, row_id, f"user_fetch_error: {exc}")
            return {"status": "failed"}

        to_addr = (user_row.get("email") or "").strip()
        full_name = (user_row.get("full_name") or "").strip()
        if not to_addr or "@" not in to_addr:
            await _mark_failed(sb, row_id, "missing_or_invalid_email")
            return {"status": "skipped"}

        # 3. Build brief content (payload → watchtower → empty state).
        try:
            brief = _build_brief_from_payload(payload) or await asyncio.to_thread(
                lambda: _build_brief_from_watchtower(sb, user_id)
            )
        except Exception as exc:
            logger.warning("[morning_brief_worker] brief build failed row=%s user=%s: %s — falling through to empty-state", row_id, user_id, exc)
            brief = {"top_actions": [], "overnight_signals": []}

        # 4. Send via Resend (E15). Template renders the "all quiet"
        #    empty-state when both lists are empty — we still send.
        try:
            from services.email_service import send_morning_brief_email
            email_id = await asyncio.to_thread(
                send_morning_brief_email,
                to=to_addr,
                full_name=full_name,
                greeting=greeting,
                top_actions=brief.get("top_actions") or [],
                overnight_signals=brief.get("overnight_signals") or [],
                advisor_url=None,  # default: {APP_URL}/advisor
            )
        except Exception as exc:
            logger.exception("[morning_brief_worker] send failed row=%s user=%s: %s", row_id, user_id, exc)
            await _mark_failed(sb, row_id, f"send_exception: {type(exc).__name__}: {exc}")
            return {"status": "failed"}

        if not email_id:
            # Resend returned None — logged inside _send_via_resend.
            await _mark_failed(sb, row_id, "resend_returned_none")
            return {"status": "failed"}

        # 5. Mark completed.
        try:
            await asyncio.to_thread(
                lambda: sb.table("intelligence_queue")
                    .update({
                        "status": "completed",
                        "completed_at": _now_iso(),
                        "error_detail": None,
                    })
                    .eq("id", row_id)
                    .execute()
            )
        except Exception as exc:
            # Email did send — only DB write failed. Log loudly but
            # don't count as failure since the user got the brief.
            logger.exception("[morning_brief_worker] completed-write failed row=%s: %s", row_id, exc)
        return {"status": "sent"}


async def _mark_failed(sb, row_id: Any, detail: str) -> None:
    """Best-effort failure write. Never raises."""
    try:
        await asyncio.to_thread(
            lambda: sb.table("intelligence_queue")
                .update({
                    "status": "failed",
                    "completed_at": _now_iso(),
                    "error_detail": (detail or "")[:1000],  # column cap
                })
                .eq("id", row_id)
                .execute()
        )
    except Exception as exc:  # pragma: no cover
        logger.warning("[morning_brief_worker] mark_failed error row=%s: %s", row_id, exc)


# ─── Public entry point ──────────────────────────────────────────────

async def run_morning_brief_worker(batch_size: int = 50) -> Dict[str, Any]:
    """Drain a single batch of morning_brief queue rows. See module docstring."""
    started_at = _now_iso()
    summary: Dict[str, Any] = {
        "total_processed": 0,
        "sent": 0,
        "failed": 0,
        "skipped": 0,
        "batch_size": batch_size,
        "started_at": started_at,
        "finished_at": started_at,
    }

    sb = _get_service_client()
    if sb is None:
        logger.error("[morning_brief_worker] no DB client — aborting run")
        summary["finished_at"] = _now_iso()
        summary["error"] = "no_supabase_client"
        return summary

    # 1. Claim-poll: fetch up to batch_size queued rows, priority first
    #    then oldest-first. We don't SELECT FOR UPDATE here — the per-row
    #    claim UPDATE guards the race. Safe to over-fetch.
    try:
        q = await asyncio.to_thread(
            lambda: sb.table("intelligence_queue")
                .select("id, user_id, schedule_key, status, priority, payload, queued_at")
                .eq("schedule_key", "morning_brief")
                .eq("status", "queued")
                .order("priority", desc=False)
                .order("queued_at", desc=False)
                .limit(batch_size)
                .execute()
        )
        rows: List[Dict[str, Any]] = getattr(q, "data", None) or []
    except Exception as exc:
        logger.exception("[morning_brief_worker] queue fetch failed: %s", exc)
        summary["finished_at"] = _now_iso()
        summary["error"] = f"queue_fetch_error: {exc}"
        return summary

    if not rows:
        logger.info("[morning_brief_worker] no queued rows; exiting")
        summary["finished_at"] = _now_iso()
        return summary

    greeting = _sydney_greeting()
    sem = asyncio.Semaphore(_RESEND_CONCURRENCY)

    # 2. Fire all rows through the concurrency gate.
    coros = [_process_row(sb, row, sem, greeting) for row in rows]
    results = await asyncio.gather(*coros, return_exceptions=True)

    # 3. Tally.
    for res in results:
        summary["total_processed"] += 1
        if isinstance(res, Exception):
            # Shouldn't happen — _process_row catches everything — but
            # hedge in case a future refactor breaks that contract.
            logger.exception("[morning_brief_worker] unexpected exception in row coro: %s", res)
            summary["failed"] += 1
            continue
        status = (res or {}).get("status")
        if status == "sent":
            summary["sent"] += 1
        elif status == "skipped":
            summary["skipped"] += 1
        else:
            summary["failed"] += 1

    summary["finished_at"] = _now_iso()
    logger.info(
        "[morning_brief_worker] done processed=%s sent=%s failed=%s skipped=%s",
        summary["total_processed"], summary["sent"], summary["failed"], summary["skipped"],
    )
    return summary
