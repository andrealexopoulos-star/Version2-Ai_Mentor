"""
LLM-backed enrichment for watchtower_insights (explanation, urgency_tier, next_best_action).
"""
from __future__ import annotations

import json
import logging
import os
import re
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable, Dict, List, Optional

from core.llm_router import llm_chat
from routes.deps import AI_MODELS, OPENAI_KEY

logger = logging.getLogger(__name__)

ALLOWED_URGENCY = frozenset(
    {
        "CRITICAL_IMMEDIATE",
        "CRITICAL_WEEK",
        "ELEVATED_MONITOR",
        "STABLE_WATCH",
    }
)
DEFAULT_URGENCY = "ELEVATED_MONITOR"

LlmCaller = Callable[[str, str], Awaitable[str]]


async def _llm_caller(system_prompt: str, user_prompt: str) -> str:
    """Default LLM wrapper: boardroom model, JSON-oriented settings."""
    model = AI_MODELS.get("boardroom", AI_MODELS.get("default"))
    api_key = OPENAI_KEY or os.environ.get("OPENAI_API_KEY")
    kwargs: Dict[str, Any] = {
        "system_message": system_prompt,
        "user_message": user_prompt,
        "model": model,
        "temperature": 0.2,
        "max_tokens": 400,
        "api_key": api_key,
        "response_format": {"type": "json_object"},
    }
    try:
        return await llm_chat(**kwargs)
    except TypeError:
        kwargs.pop("response_format", None)
        return await llm_chat(**kwargs)


def _strip_json_fence(text: str) -> str:
    raw = (text or "").strip()
    fence = re.match(r"^```(?:json)?\s*([\s\S]*?)\s*```$", raw, re.IGNORECASE)
    if fence:
        return fence.group(1).strip()
    return raw


def _normalize_urgency(value: Any) -> str:
    tier = (str(value).strip().upper() if value is not None else "") or ""
    if tier in ALLOWED_URGENCY:
        return tier
    return DEFAULT_URGENCY


async def enrich_insight(
    supabase,
    llm_caller: LlmCaller,
    insight_id: str,
) -> Dict[str, Any]:
    """
    Enrich a single watchtower_insights row by id.
    Idempotent: skips when explanation is already set (non-empty).
    """
    logger.info("[signal_enricher] enrich_insight start insight_id=%s", insight_id)
    try:
        try:
            row_res = (
                supabase.table("watchtower_insights")
                .select("id,user_id,domain,position,finding,confidence,explanation")
                .eq("id", insight_id)
                .maybe_single()
                .execute()
            )
        except Exception as exc:
            logger.exception("[signal_enricher] enrich_insight supabase read failed insight_id=%s", insight_id)
            return {"ok": False, "insight_id": insight_id, "error": f"supabase_read:{exc}", "skipped": False}

        row = row_res.data if row_res else None
        if not row:
            logger.warning("[signal_enricher] enrich_insight no row insight_id=%s", insight_id)
            return {"ok": False, "insight_id": insight_id, "error": "not_found", "skipped": False}

        existing = row.get("explanation")
        if existing is not None and str(existing).strip():
            logger.info("[signal_enricher] enrich_insight skip already enriched insight_id=%s", insight_id)
            return {"ok": True, "insight_id": insight_id, "skipped": True, "error": None}

        system_prompt = (
            "You enrich executive intelligence signals. "
            "Respond with a single JSON object only (no markdown). "
            "Keys: explanation (string, 2-4 sentences, operator-facing), "
            "urgency_tier (exactly one of: CRITICAL_IMMEDIATE, CRITICAL_WEEK, ELEVATED_MONITOR, STABLE_WATCH), "
            "next_best_action (string, one concrete action)."
        )
        user_prompt = json.dumps(
            {
                "insight_id": row.get("id"),
                "domain": row.get("domain"),
                "position": row.get("position"),
                "finding": row.get("finding"),
                "confidence": row.get("confidence"),
            },
            default=str,
        )

        try:
            raw = await llm_caller(system_prompt, user_prompt)
        except Exception as exc:
            logger.exception("[signal_enricher] enrich_insight llm failed insight_id=%s", insight_id)
            return {"ok": False, "insight_id": insight_id, "error": f"llm:{exc}", "skipped": False}

        try:
            payload = json.loads(_strip_json_fence(raw))
        except json.JSONDecodeError as exc:
            logger.warning("[signal_enricher] enrich_insight json parse failed insight_id=%s: %s", insight_id, exc)
            return {"ok": False, "insight_id": insight_id, "error": f"json_parse:{exc}", "skipped": False}

        explanation = (payload.get("explanation") or "").strip() if isinstance(payload, dict) else ""
        next_action = (payload.get("next_best_action") or "").strip() if isinstance(payload, dict) else ""
        urgency = _normalize_urgency(payload.get("urgency_tier") if isinstance(payload, dict) else None)

        if not explanation:
            logger.warning("[signal_enricher] enrich_insight empty explanation insight_id=%s", insight_id)
            return {"ok": False, "insight_id": insight_id, "error": "empty_explanation", "skipped": False}

        model_used = AI_MODELS.get("boardroom", AI_MODELS.get("default"))
        update_payload = {
            "explanation": explanation,
            "urgency_tier": urgency,
            "next_best_action": next_action or None,
            "enriched_at": datetime.now(timezone.utc).isoformat(),
            "enrichment_model": str(model_used),
        }

        try:
            supabase.table("watchtower_insights").update(update_payload).eq("id", insight_id).execute()
        except Exception as exc:
            logger.exception("[signal_enricher] enrich_insight supabase update failed insight_id=%s", insight_id)
            return {"ok": False, "insight_id": insight_id, "error": f"supabase_update:{exc}", "skipped": False}

        logger.info("[signal_enricher] enrich_insight success insight_id=%s urgency=%s", insight_id, urgency)
        return {
            "ok": True,
            "insight_id": insight_id,
            "skipped": False,
            "error": None,
            "urgency_tier": urgency,
        }
    except Exception as exc:
        logger.exception("[signal_enricher] enrich_insight unexpected failure insight_id=%s", insight_id)
        return {"ok": False, "insight_id": insight_id, "error": str(exc), "skipped": False}


async def backfill_unenriched(
    supabase,
    llm_caller: LlmCaller,
    limit: int = 25,
    *,
    user_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Process up to `limit` rows with no explanation yet.
    When user_id is set, only that user's rows are considered (recommended for user-scoped routes).
    """
    logger.info(
        "[signal_enricher] backfill_unenriched start limit=%s user_id=%s",
        limit,
        (user_id[:8] + "…") if user_id else None,
    )
    results: List[Dict[str, Any]] = []
    try:
        try:
            q = (
                supabase.table("watchtower_insights")
                .select("id")
                .is_("explanation", "null")
                .order("created_at", desc=False)
                .limit(limit)
            )
            if user_id:
                q = q.eq("user_id", user_id)
            res = q.execute()
        except Exception as exc:
            logger.exception("[signal_enricher] backfill_unenriched list failed")
            return {"ok": False, "error": f"supabase_list:{exc}", "results": [], "processed": 0}

        rows = res.data or []
        for r in rows:
            iid = r.get("id")
            if not iid:
                continue
            results.append(await enrich_insight(supabase, llm_caller, str(iid)))

        processed = sum(1 for x in results if x.get("ok") and not x.get("skipped"))
        skipped = sum(1 for x in results if x.get("skipped"))
        failed = sum(1 for x in results if not x.get("ok"))

        logger.info(
            "[signal_enricher] backfill_unenriched done rows=%s processed=%s skipped=%s failed=%s",
            len(results),
            processed,
            skipped,
            failed,
        )
        return {
            "ok": True,
            "error": None,
            "results": results,
            "processed": processed,
            "skipped": skipped,
            "failed": failed,
            "candidates": len(rows),
        }
    except Exception as exc:
        logger.exception("[signal_enricher] backfill_unenriched unexpected failure")
        return {"ok": False, "error": str(exc), "results": results, "processed": 0}


# Public alias for route modules that pass the default OpenAI JSON wrapper as `llm_caller`.
llm_caller = _llm_caller
