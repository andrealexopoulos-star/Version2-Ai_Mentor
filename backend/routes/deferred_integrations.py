"""Deferred integration planning and tracking routes."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

from routes.deps import get_super_admin, get_sb


router = APIRouter()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class DeferredIntegrationUpsert(BaseModel):
    integration_key: str = Field(min_length=2, max_length=64)
    display_name: str = Field(min_length=2, max_length=128)
    status: str = "deferred"
    priority: int = 100
    blocked_by: List[str] = Field(default_factory=list)
    auth_scope: Optional[str] = None
    ingestion_scope: Optional[str] = None
    pricing_impact: Optional[str] = None
    owner_user_id: Optional[str] = None
    target_wave: Optional[str] = None
    target_date: Optional[str] = None
    notes: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

    @field_validator("integration_key", "status", "target_wave")
    @classmethod
    def normalize_keys(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        return value.strip().lower()


@router.get("/admin/deferred-integrations")
async def admin_list_deferred_integrations(admin: dict = Depends(get_super_admin)):
    sb = get_sb()
    rows = (
        sb.table("deferred_integrations")
        .select("*")
        .order("priority")
        .order("updated_at", desc=True)
        .execute()
    )
    return {"ok": True, "items": rows.data or []}


@router.put("/admin/deferred-integrations")
async def admin_upsert_deferred_integration(payload: DeferredIntegrationUpsert, admin: dict = Depends(get_super_admin)):
    sb = get_sb()
    row = {
        "integration_key": payload.integration_key,
        "display_name": payload.display_name,
        "status": payload.status,
        "priority": payload.priority,
        "blocked_by": payload.blocked_by or [],
        "auth_scope": payload.auth_scope,
        "ingestion_scope": payload.ingestion_scope,
        "pricing_impact": payload.pricing_impact,
        "owner_user_id": payload.owner_user_id,
        "target_wave": payload.target_wave,
        "target_date": payload.target_date,
        "notes": payload.notes,
        "metadata": payload.metadata or {},
        "updated_at": _now_iso(),
    }

    upserted = sb.table("deferred_integrations").upsert(row, on_conflict="integration_key").execute()
    if not upserted.data:
        raise HTTPException(status_code=500, detail="Failed to upsert deferred integration")
    return {"ok": True, "item": upserted.data[0]}
