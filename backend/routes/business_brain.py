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


def _transient_outlook(risk_score: float) -> Dict[str, Any]:
    ignored_30 = min(99, max(18, int(round(risk_score))))
    ignored_60 = min(99, ignored_30 + 10)
    ignored_90 = min(99, ignored_60 + 9)
    return {
        "ignored": [ignored_30, ignored_60, ignored_90],
        "actioned": [max(6, ignored_30 - 14), max(8, ignored_60 - 18), max(10, ignored_90 - 22)],
        "meaning": "Projected risk path over 30, 60, and 90 days if ignored versus actioned now.",
    }


def _transient_fact_points(card: Dict[str, Any]) -> List[str]:
    facts: List[str] = []
    for evidence in (card.get("evidence_refs") or [])[:3]:
        if isinstance(evidence, dict):
            if evidence.get("value") is not None and evidence.get("name"):
                facts.append(f"{evidence['name']} · {evidence['value']}")
            elif evidence.get("subject"):
                facts.append(f"Thread: {evidence['subject']}")
            elif evidence.get("reason"):
                facts.append(str(evidence.get("reason")))
    return facts


def _data_freshness_from_iso(value: Any) -> str:
    if not value:
        return "unknown"
    try:
        dt = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
        mins = int(max(0, (datetime.now(timezone.utc) - dt).total_seconds() // 60))
        if mins < 60:
            return f"{mins}m"
        return f"{mins // 60}h"
    except Exception:
        return "unknown"


def _normalize_lineage(concern: Dict[str, Any], mode: str) -> Dict[str, Any]:
    if isinstance(concern.get("evidence_lineage"), dict):
        return concern.get("evidence_lineage") or {}
    evidence = concern.get("evidence") or []
    metric_names = []
    for item in evidence:
        if isinstance(item, dict) and item.get("metric_name"):
            metric_names.append(item.get("metric_name"))
    return {
        "engine_mode": mode,
        "metrics_used": metric_names,
        "model_used": concern.get("probabilistic_model") or "business_brain_priority_engine",
        "deterministic_rule": concern.get("deterministic_rule"),
    }


def _enrich_concern_contract(concern: Dict[str, Any], mode: str) -> Dict[str, Any]:
    enriched = dict(concern)
    evidence = concern.get("evidence") or []
    if "confidence_score" not in enriched:
        enriched["confidence_score"] = concern.get("confidence")
    if "data_sources_count" not in enriched:
        enriched["data_sources_count"] = max(1, len([e for e in evidence if isinstance(e, dict)])) if evidence else 1
    if not enriched.get("data_freshness"):
        enriched["data_freshness"] = _data_freshness_from_iso(concern.get("last_seen") or concern.get("time_window", {}).get("evaluated_at"))
    if not enriched.get("recommended_action_id"):
        concern_id = concern.get("concern_id") or "unknown"
        enriched["recommended_action_id"] = f"action.brain.{concern_id}"
    enriched["lineage"] = _normalize_lineage(concern, mode)
    return enriched


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
            "issue_brief": card.get("decision_summary") or card.get("signal_summary") or "Live concern detected by BIQc Brain.",
            "why_now_brief": card.get("evidence_summary") or card.get("signal_summary") or "Live evidence indicates attention is needed in this cycle.",
            "action_brief": card.get("action_summary") or "Execute owner action from BIQc recommendation.",
            "if_ignored_brief": card.get("consequence") or card.get("decision_summary") or "The issue is likely to compound if left unresolved.",
            "fact_points": _transient_fact_points(card),
            "source_summary": f"Source signals came from {card.get('source') or 'the live intelligence layer' }.",
            "confidence_note": f"Confidence derived from live signal interval {card.get('confidence_interval') or 'not available'}.",
            "outlook_30_60_90": _transient_outlook(risk_score),
            "repeat_count": max(1, len(card.get("evidence_refs") or [])),
            "last_seen": card.get("timestamp") or datetime.now(timezone.utc).isoformat(),
            "escalation_state": "critical" if risk_score >= 90 else "elevated" if risk_score >= 70 else "monitoring",
            "decision_label": card.get("signal_summary") or card.get("decision_summary") or bucket.replace("_", " ").title(),
            "confidence_score": round(confidence, 4),
            "data_sources_count": max(1, len(card.get("evidence_refs") or [])),
            "data_freshness": _data_freshness_from_iso(card.get("timestamp")),
            "recommended_action_id": f"action.brain.{concern_by_bucket.get(bucket, 'operations_bottlenecks')}",
            "evidence_lineage": {
                "engine_mode": "live_transient",
                "source": card.get("source"),
                "signal_key": card.get("signal_key"),
            },
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


class KpiThresholdInput(BaseModel):
    metric_key: str = Field(..., min_length=2)
    enabled: bool = True
    comparator: str = Field(default="below", pattern="^(above|below)$")
    warning_value: Optional[float] = None
    critical_value: Optional[float] = None
    note: Optional[str] = None


class KpiThresholdUpdateRequest(BaseModel):
    selected_metric_keys: Optional[List[str]] = None
    thresholds: List[KpiThresholdInput] = Field(default_factory=list)


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
        if not engine.business_core_ready:
            try:
                fallback = await _build_transient_priorities_from_live_integrations(current_user)
            except Exception:
                fallback = {"concerns": [], "tier_mode": "free", "all_clear": True}
            concerns = [_enrich_concern_contract(item, "live_transient") for item in (fallback.get("concerns") or [])]
            return {
                "tenant_id": tenant_id,
                "business_core_ready": False,
                "mode": "live_transient",
                "tier_mode": fallback.get("tier_mode", "free"),
                "brain_policy": engine.brain_policy(),
                "all_clear": bool(fallback.get("all_clear", not concerns)),
                "model_execution_id": None,
                "source_event_ids": [],
                "concerns": concerns,
                "integrity_alerts": [],
                "truth_summary": {},
                "confidence_score": 0.5,
                "data_sources_count": 1,
                "data_freshness": "live",
                "lineage": {"engine": "business_brain", "mode": "live_transient"},
                "generated_at": datetime.now(timezone.utc).isoformat(),
            }
        result = engine.get_priorities(recompute_metrics=recompute)

        concerns = [_enrich_concern_contract(item, result.get("mode", "business_core")) for item in (result.get("concerns") or [])]
        source_count = max(1, max((int(c.get("data_sources_count") or 0) for c in concerns), default=1))
        avg_conf = round(sum(float(c.get("confidence_score") or 0) for c in concerns) / max(1, len(concerns)), 4)
        freshest = "unknown"
        freshness_candidates = [c.get("data_freshness") for c in concerns if c.get("data_freshness")]
        if freshness_candidates:
            freshest = freshness_candidates[0]

        return {
            "tenant_id": tenant_id,
            "business_core_ready": engine.business_core_ready,
            "mode": result.get("mode", "business_core"),
            "tier_mode": result.get("tier_mode"),
            "brain_policy": result.get("brain_policy") or engine.brain_policy(),
            "all_clear": bool(result.get("all_clear", False)),
            "model_execution_id": result.get("model_execution_id"),
            "source_event_ids": result.get("source_event_ids") or [],
            "concerns": concerns,
            "integrity_alerts": result.get("integrity_alerts") or [],
            "truth_summary": result.get("truth_summary") or {},
            "confidence_score": avg_conf,
            "data_sources_count": source_count,
            "data_freshness": freshest,
            "lineage": {
                "engine": "business_brain",
                "mode": result.get("mode", "business_core"),
                "source_event_ids": result.get("source_event_ids") or [],
                "model_execution_id": result.get("model_execution_id"),
            },
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute business priorities: {e}")


@router.get("/brain/initial-calibration")
async def get_brain_initial_calibration(current_user: dict = Depends(get_current_user)):
    """First-pass cognitive calibration payload for onboarding + executive summary."""
    tenant_id = current_user["id"]
    sb = get_sb()
    try:
        rpc_result = sb.rpc("brain_initial_calibration", {"p_tenant_id": tenant_id}).execute()
        if rpc_result.data:
            return {
                "status": "ok",
                "tenant_id": tenant_id,
                **rpc_result.data,
            }
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Canonical initial calibration is not active: {e}",
        )

    raise HTTPException(
        status_code=503,
        detail="Canonical initial calibration is not active. Deploy the SQL RPC and retry.",
    )


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
                "runtime_catalog_source": engine.catalog_source,
                "runtime_catalog_metric_count": len(engine.catalog),
                **coverage,
            }

        return {
            "tenant_id": tenant_id,
            "brain_policy": engine.brain_policy(),
            "metrics": engine.get_metrics(metric_name=metric_name, period=period),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch metrics: {e}")


@router.get("/brain/kpis")
async def get_brain_kpis(current_user: dict = Depends(get_current_user)):
    """Return tier-aware KPI access and user threshold configuration."""
    tenant_id = current_user["id"]
    engine = BusinessBrainEngine(get_sb(), tenant_id, current_user)
    try:
        return {
            "tenant_id": tenant_id,
            **engine.get_kpi_configuration(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch KPI configuration: {e}")


@router.put("/brain/kpis")
async def update_brain_kpis(
    payload: KpiThresholdUpdateRequest,
    current_user: dict = Depends(get_current_user),
):
    """Persist KPI threshold preferences for the current user."""
    tenant_id = current_user["id"]
    engine = BusinessBrainEngine(get_sb(), tenant_id, current_user)
    try:
        config = engine.save_kpi_thresholds(
            [item.model_dump() for item in payload.thresholds],
            payload.selected_metric_keys,
        )
        return {
            "tenant_id": tenant_id,
            **config,
            "message": "KPI thresholds saved. Brain refresh will use the updated policy.",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save KPI configuration: {e}")


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


@router.get("/brain/runtime-check")
async def brain_runtime_check(current_user: dict = Depends(get_current_user)):
    """Forensic runtime diagnostics for deployment verification.

    Use this endpoint to verify the backend container is running the expected Brain build.
    """
    tenant_id = current_user["id"]
    engine = BusinessBrainEngine(get_sb(), tenant_id, current_user)
    try:
        return {
            "tenant_id": tenant_id,
            "server_time": datetime.now(timezone.utc).isoformat(),
            "business_core_ready": engine.business_core_ready,
            "brain_policy": engine.brain_policy(),
            "catalog_source_resolved": engine.catalog_source,
            "catalog_metric_count": len(engine.catalog),
            "catalog_diagnostics": engine.catalog_diagnostics,
            "tier_mode": engine.tier_mode,
            "runtime_expectation": {
                "target_metric_count": 100,
                "target_business_core_ready": True,
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get runtime diagnostics: {e}")
