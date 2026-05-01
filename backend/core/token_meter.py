"""BIQc Token Meter — async-safe fire-and-forget insert into usage_ledger.

Design (post peer review):
  C1: row includes kind='consume' (NOT NULL in migration 111)
  C2: row uses 'tokens' (not 'tokens_total' — column is named tokens)
  C3: row includes 'provider' (required by CHECK usage_ledger_consume_requires_model)
  H1: logger.error on insert failure (was warning — silent on billing path)
  H2: _BACKGROUND_TASKS strong-ref set so Python 3.11+ GC can't cancel mid-flight
       (per asyncio.create_task docs)
  H4: explicit SOT — ledger is SHADOW during PR1; legacy (ai_usage_log +
       token_allocations) is source-of-truth until PR B4/B5 cutover

Kill switch: env USAGE_LEDGER_ENABLED=false stops every emit.
"""
from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timezone
from typing import Optional

from core.plans import (
    PRICING_VERSION,
    USD_TO_AUD,
    compute_cost_aud_micros,
    normalize_tier,
    provider_of,
)

logger = logging.getLogger(__name__)

_ENABLED_ENV = os.environ.get("USAGE_LEDGER_ENABLED", "true").strip().lower()
USAGE_LEDGER_ENABLED: bool = _ENABLED_ENV not in ("0", "false", "no", "off")
if not USAGE_LEDGER_ENABLED:
    logger.warning("[token_meter] USAGE_LEDGER_ENABLED=false — usage_ledger emits DISABLED")

# H2: strong-ref prevents Python 3.11+ GC from cancelling detached tasks mid-flight
_BACKGROUND_TASKS: set[asyncio.Task] = set()


def _insert_sync(sb, row: dict) -> None:
    """Blocking Supabase insert — wrapped via asyncio.to_thread from async callers
    (supabase-py 2.x is sync; we don't want to block the LLM response path)."""
    sb.table("usage_ledger").insert(row).execute()


def _log_if_failed(task: asyncio.Task) -> None:
    """Done-callback: H1 escalation to logger.error + exc_info for billing visibility."""
    try:
        exc = task.exception()
    except asyncio.CancelledError:
        return
    if exc is not None:
        logger.error("[token_meter] usage_ledger insert failed", exc_info=exc)


async def emit_consume(
    sb,
    *,
    user_id: str,
    account_id: Optional[str] = None,
    model: str,
    input_tokens: int,
    output_tokens: int,
    cached_input_tokens: int = 0,
    feature: str = "llm_call",
    action: Optional[str] = None,
    tier_at_event: Optional[str] = None,
    cache_hit: Optional[bool] = None,
    request_id: Optional[str] = None,
) -> None:
    """Fire-and-forget insert of a kind='consume' row. Never raises, never blocks.

    Caller just `await`s; this schedules the blocking insert in a thread and
    returns immediately. Errors logged via done-callback. LLM response path
    is never blocked by the ledger write.
    """
    if not USAGE_LEDGER_ENABLED:
        return
    if not user_id:
        return

    ti = max(0, int(input_tokens or 0))
    to = max(0, int(output_tokens or 0))
    tc = max(0, int(cached_input_tokens or 0))
    tt = max(0, ti + to)
    if ti == 0 and to == 0:
        return

    # C3: CHECK usage_ledger_consume_requires_model requires provider NOT NULL
    prov = provider_of(model)
    if prov == "unknown" and model:
        logger.warning("[token_meter] unknown provider for model=%s — stamping 'unknown'", model)

    cost_micros = compute_cost_aud_micros(
        model=model,
        input_tokens=ti,
        output_tokens=to,
        cached_input_tokens=tc,
    )

    row = {
        # id omitted — DB DEFAULT gen_random_uuid()
        "user_id":              user_id,
        "account_id":           account_id,
        "kind":                 "consume",         # C1
        "tokens":               tt,                # C2
        "input_tokens":         ti,
        "output_tokens":        to,
        "cached_input_tokens":  tc,
        "model":                model,
        "provider":             prov,              # C3
        "feature":              feature,
        "action":               action,
        "request_id":           request_id,
        "cost_aud_micros":      cost_micros,
        "cache_hit":            bool(cache_hit) if cache_hit is not None else None,
        "tier_at_event":        normalize_tier(tier_at_event),
        "metadata":             {"fx_rate": USD_TO_AUD, "pricing_version": PRICING_VERSION},
        "created_at":           datetime.now(timezone.utc).isoformat(),
    }

    try:
        task = asyncio.create_task(asyncio.to_thread(_insert_sync, sb, row))
        _BACKGROUND_TASKS.add(task)                        # H2: strong ref
        task.add_done_callback(_BACKGROUND_TASKS.discard)  # H2: cleanup
        task.add_done_callback(_log_if_failed)             # H1: error visibility
    except Exception as exc:
        logger.error("[token_meter] could not schedule insert", exc_info=exc)


__all__ = ["emit_consume", "USAGE_LEDGER_ENABLED"]
