"""Redis-backed scan cache for the calibration pipeline.

Caches domain-level enrichment results and per-edge-function outputs
to eliminate redundant API calls across users and regenerate attempts.

Key schema (per Redis best-practice naming):
    biqc:scan:{domain}              → full enrichment JSON (24h TTL)
    biqc:edge:{function}:{domain}   → edge function result JSON (1h TTL)

All reads are non-blocking: if Redis is unavailable the caller gets None
and proceeds with a live scan. Writes are fire-and-forget with exception
suppression so they never block the response path.
"""

import json
import logging
import re
from typing import Any, Dict, Optional
from urllib.parse import urlparse

from biqc_jobs import get_redis

logger = logging.getLogger(__name__)

SCAN_TTL = 86_400       # 24 hours
EDGE_TTL = 3_600        # 1 hour
KEY_PREFIX_SCAN = "biqc:scan"
KEY_PREFIX_EDGE = "biqc:edge"

# ─── R2D: per-edge TTL overrides ────────────────────────────────────────────
# SEMrush domain stats (rank, organic KW, backlinks) do NOT change minute to
# minute. The R2D brief mandates 24h domain-level caching to stay inside the
# API-units budget — re-scanning the same domain inside 24h must hit cache
# and consume zero units. Bump the TTL from 1h (default) to 24h for the
# semrush-domain-intel edge function only. Other functions (e.g. social
# enrichment, calibration sync) keep the standard 1h freshness.
EDGE_TTL_OVERRIDES: dict = {
    "semrush-domain-intel": 86_400,   # 24 hours
}


def normalize_domain(url: str) -> str:
    """Strip protocol, www prefix, trailing slash, and query/fragment."""
    cleaned = (url or "").strip()
    if not cleaned:
        return ""
    if not re.match(r"https?://", cleaned, re.IGNORECASE):
        cleaned = f"https://{cleaned}"
    parsed = urlparse(cleaned)
    host = (parsed.hostname or "").lower().lstrip("www.")
    return host


def _scan_key(domain: str) -> str:
    return f"{KEY_PREFIX_SCAN}:{domain}"


def _edge_key(function_name: str, domain: str) -> str:
    return f"{KEY_PREFIX_EDGE}:{function_name}:{domain}"


async def get_domain_scan(domain: str) -> Optional[Dict[str, Any]]:
    """Return cached enrichment for *domain*, or None on miss / Redis down."""
    redis = get_redis()
    if redis is None or not domain:
        return None
    try:
        raw = await redis.get(_scan_key(domain))
        if raw is None:
            return None
        return json.loads(raw)
    except Exception as exc:
        logger.debug("scan_cache get miss: %s", exc)
        return None


async def set_domain_scan(
    domain: str,
    enrichment: Dict[str, Any],
    ttl: int = SCAN_TTL,
) -> None:
    """Cache *enrichment* for *domain*. Fire-and-forget."""
    redis = get_redis()
    if redis is None or not domain:
        return
    try:
        await redis.set(
            _scan_key(domain),
            json.dumps(enrichment, default=str),
            ex=ttl,
        )
    except Exception as exc:
        logger.debug("scan_cache set failed: %s", exc)


async def invalidate_domain_scan(domain: str) -> None:
    """Bust the domain cache (called on regenerate)."""
    redis = get_redis()
    if redis is None or not domain:
        return
    try:
        await redis.delete(_scan_key(domain))
        keys = await redis.keys(f"{KEY_PREFIX_EDGE}:*:{domain}")
        if keys:
            await redis.delete(*keys)
    except Exception as exc:
        logger.debug("scan_cache invalidate failed: %s", exc)


async def get_edge_result(
    function_name: str, domain: str
) -> Optional[Dict[str, Any]]:
    """Return cached edge-function result, or None."""
    redis = get_redis()
    if redis is None or not domain:
        return None
    try:
        raw = await redis.get(_edge_key(function_name, domain))
        if raw is None:
            return None
        return json.loads(raw)
    except Exception as exc:
        logger.debug("edge_cache get miss: %s", exc)
        return None


async def set_edge_result(
    function_name: str,
    domain: str,
    result: Dict[str, Any],
    ttl: Optional[int] = None,
) -> None:
    """Cache an edge-function result. Fire-and-forget.

    ``ttl`` defaults to ``EDGE_TTL`` (1h) but is overridden per-edge via
    ``EDGE_TTL_OVERRIDES``. R2D bumps semrush-domain-intel to 24h so the
    same domain inside a 24h window costs zero SEMrush API units.
    """
    redis = get_redis()
    if redis is None or not domain:
        return
    if ttl is None:
        ttl = EDGE_TTL_OVERRIDES.get(function_name, EDGE_TTL)
    try:
        await redis.set(
            _edge_key(function_name, domain),
            json.dumps(result, default=str),
            ex=ttl,
        )
    except Exception as exc:
        logger.debug("edge_cache set failed: %s", exc)
