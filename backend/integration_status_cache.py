"""Redis-backed cache helpers for user integration status payloads.

Cache is best-effort only and never blocks request flow.
"""

from __future__ import annotations

import json
import os
from typing import Any, Dict, Optional

from biqc_jobs import biqc_jobs


def _cache_key(user_id: str) -> str:
    return f"biqc-cache:integration-status:{user_id}"


def _cache_ttl_seconds() -> int:
    raw = (os.environ.get("INTEGRATION_STATUS_CACHE_TTL_SECONDS") or "45").strip()
    try:
        ttl = int(raw)
    except Exception:
        ttl = 45
    return max(5, min(ttl, 300))


async def get_cached_integration_status(user_id: str) -> Optional[Dict[str, Any]]:
    if not user_id or not biqc_jobs.redis_connected or not biqc_jobs.redis:
        return None
    try:
        cached = await biqc_jobs.redis.get(_cache_key(user_id))
        if not cached:
            return None
        payload = json.loads(cached)
        if isinstance(payload, dict):
            return payload
        return None
    except Exception:
        return None


async def set_cached_integration_status(user_id: str, payload: Dict[str, Any]) -> None:
    if not user_id or not isinstance(payload, dict):
        return
    if not biqc_jobs.redis_connected or not biqc_jobs.redis:
        return
    try:
        await biqc_jobs.redis.setex(
            _cache_key(user_id),
            _cache_ttl_seconds(),
            json.dumps(payload, separators=(",", ":"), default=str),
        )
    except Exception:
        return


async def invalidate_cached_integration_status(user_id: str) -> None:
    if not user_id or not biqc_jobs.redis_connected or not biqc_jobs.redis:
        return
    try:
        await biqc_jobs.redis.delete(_cache_key(user_id))
    except Exception:
        return
