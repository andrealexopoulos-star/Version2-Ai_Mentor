"""
Cross-domain signal grouping for watchtower_insights (signal_group_id).

Eligible tiers: CRITICAL_* and ELEVATED_MONITOR. Same-domain pairs are never grouped.
Correlation uses token overlap on finding + explanation within a ±7 day detected_at window.
"""
from __future__ import annotations

import logging
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Set

logger = logging.getLogger(__name__)

GROUPING_TIERS = frozenset(
    {
        "CRITICAL_IMMEDIATE",
        "CRITICAL_WEEK",
        "ELEVATED_MONITOR",
    }
)
WINDOW = timedelta(days=7)
# At least this many shared significant tokens, or Jaccard on tokens >= threshold
_MIN_SHARED_TOKENS = 3
_MIN_JACCARD = 0.12
_TOKEN_RE = re.compile(r"[a-z0-9]{4,}", re.IGNORECASE)


def _parse_detected_at(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        dt = value
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt
    s = str(value).strip()
    if not s:
        return None
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(s)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _text_tokens(finding: Any, explanation: Any) -> Set[str]:
    blob = f"{finding or ''} {explanation or ''}".lower()
    return {t.lower() for t in _TOKEN_RE.findall(blob)}


def _correlates(anchor_tokens: Set[str], peer_tokens: Set[str]) -> bool:
    if not anchor_tokens or not peer_tokens:
        return False
    inter = anchor_tokens & peer_tokens
    if len(inter) >= _MIN_SHARED_TOKENS:
        return True
    union = anchor_tokens | peer_tokens
    if not union:
        return False
    return len(inter) / len(union) >= _MIN_JACCARD


async def group_insight(supabase, insight_id: str) -> Dict[str, Any]:
    """
    Assign signal_group_id when this insight correlates with at least one other-domain
    insight in the 7-day window. Idempotent if already grouped.
    """
    try:
        try:
            row_res = (
                supabase.table("watchtower_insights")
                .select(
                    "id,user_id,domain,detected_at,finding,explanation,urgency_tier,signal_group_id"
                )
                .eq("id", insight_id)
                .maybe_single()
                .execute()
            )
        except Exception as exc:
            logger.exception("[signal_grouper] read failed insight_id=%s", insight_id)
            return {"ok": False, "insight_id": insight_id, "error": f"supabase_read:{exc}"}

        row = row_res.data if row_res else None
        if not row:
            return {"ok": False, "insight_id": insight_id, "error": "not_found"}

        if row.get("signal_group_id"):
            return {
                "ok": True,
                "insight_id": insight_id,
                "skipped": True,
                "reason": "already_grouped",
                "signal_group_id": row.get("signal_group_id"),
            }

        explanation = row.get("explanation")
        if explanation is None or not str(explanation).strip():
            return {
                "ok": True,
                "insight_id": insight_id,
                "skipped": True,
                "reason": "no_explanation",
            }

        urgency = (row.get("urgency_tier") or "").strip()
        if urgency not in GROUPING_TIERS:
            return {
                "ok": True,
                "insight_id": insight_id,
                "skipped": True,
                "reason": "tier_not_grouped",
                "urgency_tier": urgency or None,
            }

        user_id = row.get("user_id")
        domain = row.get("domain")
        if not user_id or not domain:
            return {"ok": False, "insight_id": insight_id, "error": "missing_user_or_domain"}

        anchor_dt = _parse_detected_at(row.get("detected_at"))
        if anchor_dt is None:
            anchor_dt = datetime.now(timezone.utc)
        start = (anchor_dt - WINDOW).isoformat()
        end = (anchor_dt + WINDOW).isoformat()

        anchor_tokens = _text_tokens(row.get("finding"), row.get("explanation"))

        try:
            peer_res = (
                supabase.table("watchtower_insights")
                .select(
                    "id,domain,detected_at,finding,explanation,urgency_tier,signal_group_id"
                )
                .eq("user_id", user_id)
                .neq("id", insight_id)
                .neq("domain", domain)
                .not_.is_("explanation", "null")
                .gte("detected_at", start)
                .lte("detected_at", end)
                .in_("urgency_tier", list(GROUPING_TIERS))
                .execute()
            )
        except Exception as exc:
            logger.exception("[signal_grouper] peer list failed insight_id=%s", insight_id)
            return {"ok": False, "insight_id": insight_id, "error": f"supabase_peers:{exc}"}

        peers: List[Dict[str, Any]] = list(peer_res.data or [])
        matches: List[Dict[str, Any]] = []
        for p in peers:
            if not p.get("explanation"):
                continue
            if (p.get("domain") or "") == domain:
                continue
            ptoks = _text_tokens(p.get("finding"), p.get("explanation"))
            if _correlates(anchor_tokens, ptoks):
                matches.append(p)

        if not matches:
            return {
                "ok": True,
                "insight_id": insight_id,
                "skipped": True,
                "reason": "no_correlated_peers",
            }

        existing_gids = [
            str(m["signal_group_id"])
            for m in matches
            if m.get("signal_group_id")
        ]
        if existing_gids:
            group_id = min(existing_gids)
        else:
            group_id = str(uuid.uuid4())

        ids_to_set = {insight_id} | {str(m["id"]) for m in matches}
        for uid in ids_to_set:
            try:
                supabase.table("watchtower_insights").update({"signal_group_id": group_id}).eq(
                    "id", uid
                ).execute()
            except Exception as exc:
                logger.exception("[signal_grouper] update failed id=%s", uid)
                return {"ok": False, "insight_id": insight_id, "error": f"supabase_update:{exc}"}

        logger.info(
            "[signal_grouper] grouped insight_id=%s group=%s peers=%s",
            insight_id,
            group_id,
            len(matches),
        )
        return {
            "ok": True,
            "insight_id": insight_id,
            "skipped": False,
            "signal_group_id": group_id,
            "peer_count": len(matches),
        }
    except Exception as exc:
        logger.exception("[signal_grouper] unexpected failure insight_id=%s", insight_id)
        return {"ok": False, "insight_id": insight_id, "error": str(exc)}
