"""Provider call tracker — fire-and-forget upserts into provider_usage.

Used by non-LLM provider integrations (Resend, Merge, Browse AI, SEMrush,
Firecrawl, Perplexity, Stripe) to update the running tally that powers the
Super-Admin API Providers dashboard.

LLM providers (openai, anthropic, gemini) are NOT tracked here — they go
through usage_ledger and are rolled up by refresh_provider_usage() when
the super-admin endpoint is hit. See migration 118.

Design notes:
- Never raises. Telemetry failures must never break the calling path.
- Uses the service-role Supabase client so the upsert bypasses RLS.
- Call_count increments and error fields are updated via a single upsert.
- Cost is in AUD micros (1 AUD = 1_000_000) to match usage_ledger.

Scope locked 2026-04-22 by Andreas.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)


_KNOWN_PROVIDERS = {
    "openai", "anthropic", "gemini", "browse_ai", "semrush", "firecrawl",
    "perplexity", "resend", "stripe", "merge", "supabase", "serper", "sentry",
}


async def record_provider_call(
    provider: str,
    *,
    cost_aud_micros: int = 0,
    error: Optional[str] = None,
) -> None:
    """Fire-and-forget per-call tracker. Upserts into provider_usage.

    Parameters
    ----------
    provider : str
        Lowercase provider slug. Must match a row seeded in migration 118
        (e.g. 'resend', 'merge', 'stripe'). Unknown providers log a warning
        and no-op to avoid silently spawning new rows.
    cost_aud_micros : int, default 0
        Incremental cost in AUD * 1_000_000. Zero for free-tier calls or
        when the vendor price is unknown at call time.
    error : str | None
        Short error code / message on failure. When set, status flips to
        'error' and last_error / last_error_at are recorded. When None,
        status flips to 'up' on success.
    """
    if not provider:
        return
    slug = provider.strip().lower()
    if slug not in _KNOWN_PROVIDERS:
        logger.warning("[provider_tracker] unknown provider slug: %s", slug)
        return

    try:
        from supabase_client import get_supabase_client
        sb = get_supabase_client()
        if sb is None:
            return

        now_iso = datetime.now(timezone.utc).isoformat()
        # Read current row so we can increment call_count. A CAS loop
        # isn't necessary here — occasional lost counts on high contention
        # are acceptable for an ops-grade running tally, and pg_cron-backed
        # refresh_provider_usage() corrects drift for LLM providers.
        current = (
            sb.table("provider_usage")
              .select("call_count")
              .eq("provider", slug)
              .maybe_single()
              .execute()
        )
        cur_count = int((current.data or {}).get("call_count") or 0)

        update_payload = {
            "provider": slug,
            "call_count": cur_count + 1,
            "last_called_at": now_iso,
            "updated_at": now_iso,
        }
        if error:
            update_payload["last_error"] = str(error)[:500]
            update_payload["last_error_at"] = now_iso
            update_payload["status"] = "error"
        else:
            update_payload["status"] = "up"

        if cost_aud_micros and cost_aud_micros > 0:
            # Read the existing total and increment server-side-ish.
            existing = (
                sb.table("provider_usage")
                  .select("total_cost_aud_micros")
                  .eq("provider", slug)
                  .maybe_single()
                  .execute()
            )
            prev = int((existing.data or {}).get("total_cost_aud_micros") or 0)
            update_payload["total_cost_aud_micros"] = prev + int(cost_aud_micros)

        sb.table("provider_usage").upsert(
            update_payload, on_conflict="provider"
        ).execute()
    except Exception as exc:  # pragma: no cover — telemetry must never raise
        logger.warning(
            "[provider_tracker] record_provider_call(%s) failed: %s",
            provider, exc,
        )


def record_provider_call_sync(
    provider: str,
    *,
    cost_aud_micros: int = 0,
    error: Optional[str] = None,
) -> None:
    """Synchronous variant for code paths that aren't async.

    Same semantics as record_provider_call. Intended for call sites inside
    services/email_service.py which are sync today.
    """
    if not provider:
        return
    slug = provider.strip().lower()
    if slug not in _KNOWN_PROVIDERS:
        logger.warning("[provider_tracker] unknown provider slug: %s", slug)
        return

    try:
        from supabase_client import get_supabase_client
        sb = get_supabase_client()
        if sb is None:
            return

        now_iso = datetime.now(timezone.utc).isoformat()
        current = (
            sb.table("provider_usage")
              .select("call_count, total_cost_aud_micros")
              .eq("provider", slug)
              .maybe_single()
              .execute()
        )
        cur = current.data or {}
        cur_count = int(cur.get("call_count") or 0)
        cur_cost = int(cur.get("total_cost_aud_micros") or 0)

        update_payload = {
            "provider": slug,
            "call_count": cur_count + 1,
            "last_called_at": now_iso,
            "updated_at": now_iso,
        }
        if error:
            update_payload["last_error"] = str(error)[:500]
            update_payload["last_error_at"] = now_iso
            update_payload["status"] = "error"
        else:
            update_payload["status"] = "up"

        if cost_aud_micros and cost_aud_micros > 0:
            update_payload["total_cost_aud_micros"] = cur_cost + int(cost_aud_micros)

        sb.table("provider_usage").upsert(
            update_payload, on_conflict="provider"
        ).execute()
    except Exception as exc:  # pragma: no cover
        logger.warning(
            "[provider_tracker] record_provider_call_sync(%s) failed: %s",
            provider, exc,
        )
