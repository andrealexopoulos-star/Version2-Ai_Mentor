"""Fact resolution routes — extracted from server.py."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Any
from routes.deps import get_current_user, get_sb

router = APIRouter()


@router.get("/facts/resolve")
async def resolve_user_facts(current_user: dict = Depends(get_current_user)):
    from fact_resolution import resolve_facts, resolve_onboarding_fields
    user_id = current_user["id"]
    facts = await resolve_facts(get_sb(), user_id)
    resolved_fields = resolve_onboarding_fields(facts)
    return {"facts": facts, "resolved_fields": resolved_fields, "total_known": len(facts)}


class FactConfirmRequest(BaseModel):
    fact_key: str
    value: Any
    source: str = "user_confirmed"


@router.post("/facts/confirm")
async def confirm_fact(request: FactConfirmRequest, current_user: dict = Depends(get_current_user)):
    from fact_resolution import persist_fact
    await persist_fact(get_sb(), current_user["id"], request.fact_key, request.value, request.source)
    return {"status": "confirmed", "fact_key": request.fact_key}
