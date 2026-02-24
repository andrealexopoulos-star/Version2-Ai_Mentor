"""Intelligence routes — emission, snapshot, baseline. Extracted from server.py."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional
from routes.deps import get_current_user

router = APIRouter()


# ═══ EMISSION ═══

@router.post("/emission/run")
async def run_emission(current_user: dict = Depends(get_current_user)):
    """Trigger a Merge emission cycle."""
    from workspace_helpers import get_user_account
    from supabase_client import supabase_admin

    user_id = current_user["id"]
    account = await get_user_account(supabase_admin, user_id)
    if not account:
        raise HTTPException(status_code=400, detail="Workspace not initialized")

    try:
        from merge_emission_layer import get_emission_layer
        layer = get_emission_layer()
    except RuntimeError:
        return {"signals_emitted": 0, "status": "emission_layer_not_available"}

    result = await layer.run_emission(user_id, account["id"])
    return result


# ═══ SNAPSHOT ═══

@router.post("/snapshot/generate")
async def snapshot_generate(
    snapshot_type: str = "ad_hoc",
    current_user: dict = Depends(get_current_user),
):
    from snapshot_agent import get_snapshot_agent
    agent = get_snapshot_agent()
    result = await agent.generate_snapshot(current_user["id"], snapshot_type)

    # Also trigger watchtower analysis (non-blocking)
    try:
        from watchtower_engine import get_watchtower_engine
        engine = get_watchtower_engine()
        await engine.run_analysis(current_user["id"])
    except Exception:
        pass  # Watchtower failure is non-blocking

    if result is None:
        return {"generated": False, "reason": "no_material_change"}
    return {"generated": True, "snapshot": result}


@router.get("/snapshot/latest")
async def snapshot_latest(current_user: dict = Depends(get_current_user)):
    import json as _json
    from snapshot_agent import get_snapshot_agent
    agent = get_snapshot_agent()
    snapshot = await agent.get_latest_snapshot(current_user["id"])

    # Parse the summary JSON string into a cognitive object for the frontend
    cognitive = None
    if snapshot:
        summary = snapshot.get("summary")
        if isinstance(summary, str):
            try:
                cognitive = _json.loads(summary)
            except Exception:
                cognitive = None
        elif isinstance(summary, dict):
            cognitive = summary

        # Merge executive_memo from snapshot top-level if not in cognitive
        if cognitive and not cognitive.get("executive_memo") and snapshot.get("executive_memo"):
            cognitive["executive_memo"] = snapshot["executive_memo"]

    return {"snapshot": snapshot, "cognitive": cognitive}


@router.get("/snapshot/history")
async def snapshot_history(limit: int = 10, current_user: dict = Depends(get_current_user)):
    from snapshot_agent import get_snapshot_agent
    agent = get_snapshot_agent()
    snapshots = await agent.get_snapshots(current_user["id"], limit=limit)
    return {"snapshots": snapshots, "count": len(snapshots)}


# ═══ BASELINE ═══

class BaselineSaveRequest(BaseModel):
    baseline: Dict[str, Any]


@router.get("/baseline")
async def baseline_get(current_user: dict = Depends(get_current_user)):
    from intelligence_baseline import get_intelligence_baseline
    bl = get_intelligence_baseline()
    existing = await bl.get_baseline(current_user["id"])
    if existing:
        return {"baseline": existing.get("baseline"), "configured": True}
    defaults = await bl.get_defaults()
    return {"baseline": defaults, "configured": False}


@router.post("/baseline")
async def baseline_save(payload: BaselineSaveRequest, current_user: dict = Depends(get_current_user)):
    from intelligence_baseline import get_intelligence_baseline
    bl = get_intelligence_baseline()
    result = await bl.save_baseline(current_user["id"], payload.baseline)
    return {"saved": True, "baseline": result}


@router.get("/baseline/defaults")
async def baseline_defaults(current_user: dict = Depends(get_current_user)):
    from intelligence_baseline import get_intelligence_baseline
    bl = get_intelligence_baseline()
    defaults = await bl.get_defaults()
    return {"baseline": defaults}
