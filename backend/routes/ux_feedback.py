"""UX feedback loop routes."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

from routes.deps import get_current_user, get_super_admin, get_sb


router = APIRouter()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class FeedbackEventCreate(BaseModel):
    route: Optional[str] = None
    feedback_type: str = Field(min_length=2, max_length=64)
    rating: Optional[int] = Field(default=None, ge=1, le=10)
    sentiment: Optional[str] = None
    message: Optional[str] = Field(default=None, max_length=2000)
    metadata: Dict[str, Any] = Field(default_factory=dict)

    @field_validator("feedback_type")
    @classmethod
    def normalize_feedback_type(cls, value: str) -> str:
        return value.strip().lower()


class UsabilityCheckpointUpsert(BaseModel):
    milestone_key: str
    checkpoint_key: str
    target_metric: str
    baseline_value: Optional[float] = None
    target_value: Optional[float] = None
    current_value: Optional[float] = None
    status: str = "planned"
    notes: Optional[str] = None
    owner_user_id: Optional[str] = None
    due_at: Optional[str] = None

    @field_validator("milestone_key", "checkpoint_key", "target_metric", "status")
    @classmethod
    def normalize_keys(cls, value: str) -> str:
        return value.strip().lower()


@router.post("/ux-feedback/events")
async def create_feedback_event(payload: FeedbackEventCreate, current_user: dict = Depends(get_current_user)):
    sb = get_sb()
    row = {
        "user_id": current_user.get("id"),
        "route": payload.route,
        "feedback_type": payload.feedback_type,
        "rating": payload.rating,
        "sentiment": payload.sentiment,
        "message": payload.message,
        "metadata": payload.metadata or {},
        "created_at": _now_iso(),
    }
    created = sb.table("ux_feedback_events").insert(row).execute()
    if not created.data:
        raise HTTPException(status_code=500, detail="Failed to persist feedback event")
    return {"ok": True, "event": created.data[0]}


@router.get("/admin/ux-feedback/summary")
async def admin_feedback_summary(admin: dict = Depends(get_super_admin)):
    sb = get_sb()
    events = (
        sb.table("ux_feedback_events")
        .select("id,route,feedback_type,rating,sentiment,message,metadata,created_at,user_id")
        .order("created_at", desc=True)
        .limit(500)
        .execute()
    )
    rows = events.data or []
    total = len(rows)
    rating_values = [r.get("rating") for r in rows if isinstance(r.get("rating"), int)]
    avg_rating = round(sum(rating_values) / len(rating_values), 2) if rating_values else None

    by_type: Dict[str, int] = {}
    for row in rows:
        k = str(row.get("feedback_type") or "unknown")
        by_type[k] = by_type.get(k, 0) + 1

    return {
        "ok": True,
        "summary": {
            "total_events": total,
            "average_rating": avg_rating,
            "by_type": by_type,
        },
        "events": rows[:100],
    }


@router.get("/admin/ux-feedback/checkpoints")
async def admin_list_usability_checkpoints(admin: dict = Depends(get_super_admin)):
    sb = get_sb()
    rows = (
        sb.table("usability_test_checkpoints")
        .select("*")
        .order("updated_at", desc=True)
        .limit(500)
        .execute()
    )
    return {"ok": True, "checkpoints": rows.data or []}


@router.put("/admin/ux-feedback/checkpoints")
async def admin_upsert_usability_checkpoint(payload: UsabilityCheckpointUpsert, admin: dict = Depends(get_super_admin)):
    sb = get_sb()
    row = {
        "milestone_key": payload.milestone_key,
        "checkpoint_key": payload.checkpoint_key,
        "target_metric": payload.target_metric,
        "baseline_value": payload.baseline_value,
        "target_value": payload.target_value,
        "current_value": payload.current_value,
        "status": payload.status,
        "notes": payload.notes,
        "owner_user_id": payload.owner_user_id,
        "due_at": payload.due_at,
        "updated_at": _now_iso(),
    }
    upserted = sb.table("usability_test_checkpoints").upsert(row, on_conflict="milestone_key,checkpoint_key").execute()
    if not upserted.data:
        raise HTTPException(status_code=500, detail="Failed to upsert usability checkpoint")
    return {"ok": True, "checkpoint": upserted.data[0]}
