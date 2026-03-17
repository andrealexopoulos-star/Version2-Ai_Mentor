"""Business-core integration snapshot cache helpers.

Stores and retrieves short-lived integration bundles to reduce repeated
connector fetches and stabilize cognition responses.
"""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _freshness_label(generated_at: Optional[str]) -> str:
    if not generated_at:
        return "unknown"
    try:
        dt = datetime.fromisoformat(str(generated_at).replace("Z", "+00:00"))
        mins = int(max(0, (datetime.now(timezone.utc) - dt).total_seconds() // 60))
        if mins < 60:
            return f"{mins}m"
        hours = mins // 60
        return f"{hours}h"
    except Exception:
        return "unknown"


def get_snapshot(
    sb,
    tenant_id: str,
    source_key: str,
    *,
    max_age_minutes: int = 10,
) -> Optional[Dict[str, Any]]:
    try:
        res = (
            sb.schema("business_core")
            .table("integration_snapshots")
            .select("source_key,payload,data_sources_count,confidence_score,data_freshness,lineage,generated_at,expires_at")
            .eq("tenant_id", tenant_id)
            .eq("source_key", source_key)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        if not rows:
            return None
        row = rows[0]
        generated_at = row.get("generated_at")
        if generated_at:
            dt = datetime.fromisoformat(str(generated_at).replace("Z", "+00:00"))
            if datetime.now(timezone.utc) - dt > timedelta(minutes=max_age_minutes):
                return None
        return {
            "payload": row.get("payload") or {},
            "source_key": source_key,
            "data_sources_count": int(row.get("data_sources_count") or 0),
            "confidence_score": float(row.get("confidence_score") or 0),
            "data_freshness": row.get("data_freshness") or _freshness_label(generated_at),
            "lineage": row.get("lineage") or {},
            "generated_at": generated_at,
            "cache_hit": True,
        }
    except Exception:
        return None


def set_snapshot(
    sb,
    tenant_id: str,
    source_key: str,
    payload: Dict[str, Any],
    *,
    data_sources_count: int,
    confidence_score: float,
    lineage: Optional[Dict[str, Any]] = None,
    ttl_minutes: int = 10,
) -> None:
    now = datetime.now(timezone.utc)
    generated_at = now.isoformat()
    row = {
        "tenant_id": tenant_id,
        "source_key": source_key,
        "payload": payload,
        "data_sources_count": max(0, int(data_sources_count or 0)),
        "confidence_score": max(0.0, min(1.0, float(confidence_score or 0))),
        "data_freshness": _freshness_label(generated_at),
        "lineage": lineage or {},
        "generated_at": generated_at,
        "expires_at": (now + timedelta(minutes=max(1, ttl_minutes))).isoformat(),
    }
    try:
        (
            sb.schema("business_core")
            .table("integration_snapshots")
            .upsert(row, on_conflict="tenant_id,source_key")
            .execute()
        )
    except Exception:
        # Optional cache path; never break core request path.
        return
