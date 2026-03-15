"""Business Brain Routes — unified priorities, concerns and metrics APIs."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from routes.deps import get_current_user, get_sb
from business_brain_engine import BusinessBrainEngine, normalize_tier_mode
from routes.integrations import get_advisor_executive_surface

router = APIRouter()


def _parse_confidence_mid(confidence_interval: str | None) -> float:
    if not confidence_interval:
        return 0.65
    text = str(confidence_interval)
    try:
        parts = text.replace('%', '').replace('–', '-').split('-')
        nums = [float(p.strip()) for p in parts if p.strip()]
        if len(nums) == 2:
            return max(0.0, min(1.0, ((nums[0] + nums[1]) / 2.0) / 100.0))
        if len(nums) == 1:
            return max(0.0, min(1.0, nums[0] / 100.0))
    except Exception:
        pass
    return 0.65


async def _build_transient_priorities_from_live_integrations(current_user: Dict[str, Any]) -> Dict[str, Any]:
    """Non-fallback, live Brain priorities when business_core schema is not active.

    Uses live executive-surface contract as canonical concern input.
    """
    surface = await get_advisor_executive_surface(current_user=current_user)
    cards = surface.get("cards") or {}
    concern_by_bucket = {
        "decide_now": "cashflow_risk",
        "monitor_this_week": "pipeline_stagnation",
        "build_next": "operations_bottlenecks",
    }

    concerns: List[Dict[str, Any]] = []
    for bucket in ["decide_now", "monitor_this_week", "build_next"]:
        card = cards.get(bucket)
        if not card:
            continue

        risk_score = float(card.get("risk_score") or 0.0)
        impact = max(0.0, min(10.0, round(risk_score / 10.0, 4)))
        urgency = max(0.0, min(10.0, round((risk_score * 0.9) / 10.0, 4)))
        confidence = _parse_confidence_mid(card.get("confidence_interval"))
        effort = 3.0 if bucket == "decide_now" else 4.0 if bucket == "monitor_this_week" else 5.0
        priority_score = round((impact * urgency * confidence) / max(1.0, effort), 4)

        concerns.append({
            "concern_id": concern_by_bucket.get(bucket, "operations_bottlenecks"),
            "priority_score": priority_score,
            "impact": impact,
            "urgency": urgency,
            "confidence": round(confidence, 4),
            "effort": effort,
            "recommendation": card.get("action_summary") or "Execute owner action from BIQc recommendation.",
            "tier": "free",
            "evidence": card.get("evidence_refs") or [],
            "explanation": card.get("decision_summary") or card.get("signal_summary") or "Live concern detected by BIQc Brain.",
            "source": {
                "event_id": None,
                "provider": card.get("source"),
                "signal_key": card.get("signal_key"),
                "bucket": bucket,
            },
            "time_window": {
                "period": "live",
                "evaluated_at": card.get("timestamp") or datetime.now(timezone.utc).isoformat(),
            },
            "deterministic_rule": "executive_surface_live_priority",
            "probabilistic_model": "business_brain_live_surface_v1",
            "priority_formula": {"formula": "impact*urgency*confidence/max(1,effort)"},
        })

    concerns.sort(key=lambda x: x.get("priority_score", 0), reverse=True)
    return {
        "tier_mode": normalize_tier_mode(current_user),
        "all_clear": bool(surface.get("all_clear")),
        "concerns": concerns,
        "model_execution_id": None,
        "source_event_ids": [],
        "mode": "live_transient",
    }


class ConcernUpsertRequest(BaseModel):
    concern_id: str = Field(..., min_length=2)
    name: Optional[str] = None
    description: Optional[str] = None
    required_signals: Optional[List[str]] = None
    tier: Optional[str] = Field(default=None, pattern="^(free|paid|custom)$")
    priority_formula: Optional[Dict[str, Any]] = None
    deterministic_rule: Optional[str] = None
    probabilistic_model: Optional[str] = None
    active: Optional[bool] = None
    scope: str = Field(default="tenant", pattern="^(tenant|global)$")


def _is_admin_like(user: Dict[str, Any]) -> bool:
    role = str(user.get("role") or "").lower()
    if role in {"admin", "superadmin", "super_admin"}:
        return True
    tier_mode = normalize_tier_mode(user)
    return tier_mode == "custom"


@router.get("/brain/priorities")
async def get_brain_priorities(
    recompute: bool = Query(default=True),
    current_user: dict = Depends(get_current_user),
):
    """Return prioritized business concerns for current tenant.

    Free tier: top-3 explanations only
    Paid tier: full concerns + recommendations
    Custom tier: full concerns + formula context
    """
    tenant_id = current_user["id"]
    engine = BusinessBrainEngine(get_sb(), tenant_id, current_user)
    try:
        if engine.business_core_ready:
            result = engine.get_priorities(recompute_metrics=recompute)
        else:
            result = await _build_transient_priorities_from_live_integrations(current_user=current_user)

            # Enforce tier gating in transient mode too.
            if result.get("tier_mode") == "free":
                result["concerns"] = (result.get("concerns") or [])[:3]

        return {
            "tenant_id": tenant_id,
            "business_core_ready": engine.business_core_ready,
            "mode": result.get("mode", "business_core"),
            "tier_mode": result.get("tier_mode"),
            "all_clear": bool(result.get("all_clear", False)),
            "model_execution_id": result.get("model_execution_id"),
            "source_event_ids": result.get("source_event_ids") or [],
            "concerns": result.get("concerns") or [],
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute business priorities: {e}")


@router.get("/brain/concerns")
async def get_brain_concerns(current_user: dict = Depends(get_current_user)):
    """List effective concern definitions and formulas for current tenant."""
    tenant_id = current_user["id"]
    engine = BusinessBrainEngine(get_sb(), tenant_id, current_user)
    try:
        return {
            "business_core_ready": engine.business_core_ready,
            **engine.list_concerns(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch concern registry: {e}")


@router.post("/brain/concerns")
async def upsert_brain_concern(
    payload: ConcernUpsertRequest,
    current_user: dict = Depends(get_current_user),
):
    """Create/update concern definitions.

    - tenant scope: admin/custom users can set tenant-level override formulas
    - global scope: superadmin-only concern registry updates
    """
    if not _is_admin_like(current_user):
        raise HTTPException(status_code=403, detail="Admin/custom tier access required")

    sb = get_sb()
    tenant_id = current_user["id"]
    role = str(current_user.get("role") or "").lower()

    try:
        if payload.scope == "global":
            if role not in {"superadmin", "super_admin"}:
                raise HTTPException(status_code=403, detail="Global concern edits require superadmin")

            row: Dict[str, Any] = {
                "concern_id": payload.concern_id,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            if payload.name is not None:
                row["name"] = payload.name
            if payload.description is not None:
                row["description"] = payload.description
            if payload.required_signals is not None:
                row["required_signals"] = payload.required_signals
            if payload.tier is not None:
                row["tier"] = payload.tier
            if payload.priority_formula is not None:
                row["priority_formula"] = payload.priority_formula
            if payload.deterministic_rule is not None:
                row["deterministic_rule"] = payload.deterministic_rule
            if payload.probabilistic_model is not None:
                row["probabilistic_model"] = payload.probabilistic_model
            if payload.active is not None:
                row["active"] = payload.active

            sb.schema("business_core").table("concern_registry").upsert(
                row,
                on_conflict="concern_id",
            ).execute()

            return {"ok": True, "scope": "global", "concern_id": payload.concern_id}

        # tenant override
        if payload.priority_formula is None and payload.active is None:
            raise HTTPException(status_code=400, detail="Tenant override requires priority_formula or active")

        override_row: Dict[str, Any] = {
            "tenant_id": tenant_id,
            "concern_id": payload.concern_id,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if payload.priority_formula is not None:
            override_row["priority_formula"] = payload.priority_formula
        if payload.active is not None:
            override_row["enabled"] = payload.active

        sb.schema("business_core").table("concern_overrides").upsert(
            override_row,
            on_conflict="tenant_id,concern_id",
        ).execute()

        return {"ok": True, "scope": "tenant", "tenant_id": tenant_id, "concern_id": payload.concern_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upsert concern: {e}")


@router.get("/brain/metrics")
async def get_brain_metrics(
    metric_name: Optional[str] = Query(default=None),
    period: Optional[str] = Query(default=None),
    include_coverage: bool = Query(default=True),
    current_user: dict = Depends(get_current_user),
):
    """Return computed business metrics for current tenant."""
    tenant_id = current_user["id"]
    engine = BusinessBrainEngine(get_sb(), tenant_id, current_user)
    try:
        if include_coverage:
            coverage = engine.get_metric_coverage(period=period)
            if metric_name:
                coverage["metrics"] = [m for m in coverage["metrics"] if m.get("metric_key") == metric_name or m.get("metric_name") == metric_name]
            return {
                "tenant_id": tenant_id,
                "catalog_source": "biqc_top100_metrics_authoritative",
                "business_core_ready": engine.business_core_ready,
                **coverage,
            }

        return {
            "tenant_id": tenant_id,
            "metrics": engine.get_metrics(metric_name=metric_name, period=period),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch metrics: {e}")


@router.post("/brain/metrics/recompute")
async def recompute_brain_metrics(current_user: dict = Depends(get_current_user)):
    """Force recomputation of business metrics for current tenant."""
    tenant_id = current_user["id"]
    engine = BusinessBrainEngine(get_sb(), tenant_id, current_user)
    try:
        result = engine.compute_metrics()
        return {"tenant_id": tenant_id, **result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to recompute metrics: {e}")
