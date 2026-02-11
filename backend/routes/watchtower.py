"""Watchtower V2 routes — extracted from server.py. Zero logic changes."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional
from routes.deps import get_current_user

router = APIRouter()


class ObservationEventRequest(BaseModel):
    domain: str
    event_type: str
    payload: Dict[str, Any] = {}
    source: str
    severity: str = "info"
    observed_at: Optional[str] = None


@router.post("/watchtower/emit")
async def watchtower_emit_event(
    event: ObservationEventRequest,
    current_user: dict = Depends(get_current_user)
):
    from watchtower_engine import get_watchtower_engine
    engine = get_watchtower_engine()

    if event.domain not in ("finance", "sales", "operations", "team", "market"):
        raise HTTPException(status_code=400, detail=f"Invalid domain: {event.domain}")

    result = await engine.emit_event(
        user_id=current_user["id"],
        domain=event.domain,
        event_type=event.event_type,
        payload=event.payload,
        source=event.source,
        severity=event.severity,
        observed_at=event.observed_at,
    )

    if result is None:
        raise HTTPException(status_code=500, detail="Failed to persist observation event")

    return {"success": True, "event_id": result.get("id")}


@router.post("/watchtower/analyse")
async def watchtower_analyse(current_user: dict = Depends(get_current_user)):
    from watchtower_engine import get_watchtower_engine
    engine = get_watchtower_engine()
    result = await engine.run_analysis(current_user["id"])
    return result


@router.get("/watchtower/positions")
async def watchtower_get_positions(current_user: dict = Depends(get_current_user)):
    from watchtower_engine import get_watchtower_engine
    engine = get_watchtower_engine()
    positions = await engine.get_positions(current_user["id"])
    return {"positions": positions}


@router.get("/watchtower/findings")
async def watchtower_get_findings(
    domain: Optional[str] = None,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    from watchtower_engine import get_watchtower_engine
    engine = get_watchtower_engine()
    findings = await engine.get_findings(current_user["id"], domain=domain, limit=limit)
    return {"findings": findings, "count": len(findings)}
