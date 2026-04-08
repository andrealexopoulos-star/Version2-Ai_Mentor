"""
Poll watchtower_insights for rows missing LLM enrichment and backfill via signal_enricher.
"""
from __future__ import annotations

import asyncio
import contextlib
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

_stop_event: Optional[asyncio.Event] = None
_worker_task: Optional[asyncio.Task[None]] = None


def _enrichment_worker_enabled() -> bool:
    raw = os.environ.get("ENRICHMENT_WORKER_ENABLED", "true").strip().lower()
    return raw not in ("0", "false", "no", "off")


async def _run_enrichment_loop(stop_event: asyncio.Event) -> None:
    from routes.deps import get_sb
    from services.signal_enricher import backfill_unenriched, llm_caller

    poll_interval = 60.0
    limit = 50

    while not stop_event.is_set():
        try:
            sb = get_sb()
            await backfill_unenriched(sb, llm_caller, limit=limit, user_id=None)
        except RuntimeError as exc:
            logger.warning("[enrichment_worker] skipped cycle: %s", exc)
        except Exception:
            logger.exception("[enrichment_worker] cycle failed")

        try:
            await asyncio.wait_for(stop_event.wait(), timeout=poll_interval)
        except asyncio.TimeoutError:
            pass


def start_enrichment_worker() -> None:
    global _stop_event, _worker_task

    if not _enrichment_worker_enabled():
        logger.info("[enrichment_worker] disabled via ENRICHMENT_WORKER_ENABLED")
        return
    if _worker_task is not None and not _worker_task.done():
        logger.warning("[enrichment_worker] already running")
        return

    _stop_event = asyncio.Event()
    _worker_task = asyncio.get_running_loop().create_task(_run_enrichment_loop(_stop_event))
    logger.info("[enrichment_worker] started (poll=60s limit=%s)", 50)


async def stop_enrichment_worker() -> None:
    global _stop_event, _worker_task

    if _stop_event is not None:
        _stop_event.set()

    if _worker_task is not None:
        with contextlib.suppress(asyncio.TimeoutError):
            await asyncio.wait_for(_worker_task, timeout=300.0)
        if not _worker_task.done():
            _worker_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await _worker_task

    _worker_task = None
    _stop_event = None
    logger.info("[enrichment_worker] stopped")
