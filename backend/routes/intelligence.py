"""Intelligence routes — emission, snapshot, baseline. Extracted from server.py.
Instrumented with Intelligence Spine event logging.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
import json as _json
import logging
from routes.deps import get_current_user, get_sb
from intelligence_spine import emit_spine_event

logger = logging.getLogger("server")
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
    
    # Spine: log snapshot generation
    emit_spine_event(
        tenant_id=current_user["id"],
        event_type='FORECAST_RUN',
        model_name='snapshot_agent',
        json_payload={'snapshot_type': snapshot_type, 'generated': True},
        confidence_score=1.0,
    )
    
    return {"generated": True, "snapshot": result}


@router.get("/snapshot/latest")
async def snapshot_latest(current_user: dict = Depends(get_current_user)):
    import json as _json
    from snapshot_agent import get_snapshot_agent
    from supabase_client import init_supabase
    from intelligence_live_truth import get_live_integration_truth, get_recent_observation_events, build_watchtower_events
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

    sb = init_supabase()
    live_truth = get_live_integration_truth(sb, current_user["id"])
    observation_state = get_recent_observation_events(sb, current_user["id"], limit=5)
    live_alerts = build_watchtower_events(observation_state.get("events") or [], limit=5)

    if cognitive is None:
        cognitive = {}

    cognitive["integrations"] = {
        "crm": live_truth["canonical_truth"]["crm_connected"],
        "email": live_truth["canonical_truth"]["email_connected"],
        "accounting": live_truth["canonical_truth"]["accounting_connected"],
    }
    cognitive["live_signal_count"] = observation_state.get("count", 0)
    cognitive["top_alerts"] = live_alerts

    snapshot_text = _json.dumps(cognitive).lower() if cognitive else ""
    stale_accounting_phrase = (
        live_truth["canonical_truth"]["accounting_connected"]
        and any(phrase in snapshot_text for phrase in ["no accounting tool connected", "connect xero", "connect quickbooks"])
    )
    if stale_accounting_phrase and live_alerts:
        live_memo = f"Live signal watch: {live_alerts[0]['detail']}"
        cognitive["executive_memo"] = live_memo
        if snapshot is not None:
            snapshot["executive_memo"] = live_memo

    burn_rate_overlay = ((cognitive.get("system_state") or {}).get("burn_rate_overlay") or "") if isinstance(cognitive, dict) else ""
    if live_truth["canonical_truth"]["accounting_connected"] and "lack of accounting tool integration" in burn_rate_overlay.lower():
        cognitive.setdefault("system_state", {})["burn_rate_overlay"] = "Accounting is connected live. Cash interpretation is using the latest connected-state truth and recent signals."

    # ═══ MERGE DIGITAL FOOTPRINT FROM business_dna_enrichment ═══
    # Surfaces the Deep Scan result (persisted at onboarding scan time) so
    # Market & Position can render real Digital Footprint / SEO / Social /
    # Content Authority scores instead of "Signal still calibrating...".
    # Wrapped so a read failure never breaks /snapshot/latest.
    try:
        profile_row = sb.table("business_profiles") \
            .select("id") \
            .eq("user_id", current_user["id"]) \
            .limit(1).execute()
        profile_id = (profile_row.data or [{}])[0].get("id") if profile_row else None
        if profile_id:
            bde = sb.table("business_dna_enrichment") \
                .select("digital_footprint,enrichment") \
                .eq("user_id", current_user["id"]) \
                .eq("business_profile_id", profile_id) \
                .limit(1).execute()
            bde_row = (bde.data or [{}])[0] if bde else {}
            df = bde_row.get("digital_footprint") or {}
            if df.get("score") is not None:
                cognitive["digital_footprint"] = df
            if bde_row.get("enrichment"):
                cognitive["business_dna_enrichment"] = bde_row["enrichment"]
    except Exception as e:
        logger.warning(f"[/snapshot/latest] business_dna_enrichment read skipped: {e}")

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



# ═══ MARKET INTELLIGENCE AGGREGATOR ═══
# Pulls real data from CRM, forensic calibration, business profile
# to provide the Market page with live intelligence

@router.get("/industry-signals")
async def get_industry_signals(
    limit: int = 5,
    current_user: dict = Depends(get_current_user),
):
    """
    Cold-start feed (Sprint B #14) — generic SMB signals for brand-new users
    whose integrations + watchtower feed are empty.

    Returns the `limit` most recent rows matching the user's industry,
    falling back to industry='general' when no industry-specific content
    exists. No user-specific data is read.
    """
    from supabase_intelligence_helpers import get_business_profile_supabase

    sb = get_sb()
    safe_limit = max(1, min(int(limit or 5), 20))

    # Determine the user's industry; fall back to 'general' on any miss.
    industry_key = "general"
    try:
        profile = await get_business_profile_supabase(sb, current_user["id"])
        if profile and profile.get("industry"):
            industry_key = str(profile["industry"]).strip().lower() or "general"
    except Exception as e:
        logger.warning(f"[industry-signals] profile lookup failed: {e}")

    def _fetch(industry_value: str) -> List[Dict[str, Any]]:
        try:
            res = (
                sb.table("industry_signals")
                .select("id,title,description,source,industry,published_at")
                .eq("industry", industry_value)
                .order("published_at", desc=True)
                .limit(safe_limit)
                .execute()
            )
            return res.data or []
        except Exception as exc:
            logger.warning(f"[industry-signals] fetch failed for {industry_value}: {exc}")
            return []

    rows = _fetch(industry_key)
    if not rows and industry_key != "general":
        rows = _fetch("general")

    return {
        "signals": rows,
        "industry": industry_key,
        "count": len(rows),
    }


@router.get("/market-intelligence")
async def get_market_intelligence(current_user: dict = Depends(get_current_user)):
    """
    Aggregate live data from CRM (Merge.dev), forensic calibration,
    and business profile to generate market intelligence summary.
    Falls back to existing cognitive snapshot if available.
    """
    from workspace_helpers import get_user_account, get_account_integrations
    from supabase_intelligence_helpers import get_business_profile_supabase

    user_id = current_user["id"]
    sb = get_sb()

    # 1. Try existing cognitive snapshot first
    cognitive = None
    try:
        from snapshot_agent import get_snapshot_agent
        agent = get_snapshot_agent()
        snapshot = await agent.get_latest_snapshot(user_id)
        if snapshot:
            summary = snapshot.get("summary")
            if isinstance(summary, str):
                try:
                    cognitive = _json.loads(summary)
                except Exception:
                    pass
            elif isinstance(summary, dict):
                cognitive = summary
            if cognitive and snapshot.get("executive_memo"):
                cognitive["executive_memo"] = snapshot["executive_memo"]
    except Exception as e:
        logger.warning(f"[market-intel] Snapshot load failed: {e}")

    # 2. Aggregate CRM data
    crm_summary = None
    try:
        account = await get_user_account(sb, user_id)
        if account:
            account_id = account["id"]
            records = await get_account_integrations(sb, account_id)
            crm_integrations = [r for r in records if r.get("category") == "crm" and r.get("merge_account_id")]
            if crm_integrations:
                merge_account_id = crm_integrations[0]["merge_account_id"]
                provider = crm_integrations[0].get("provider", "CRM")
                import os, httpx
                merge_key = os.environ.get("MERGE_API_KEY", "")
                headers = {"Authorization": f"Bearer {merge_key}", "X-Account-Token": crm_integrations[0].get("account_token", ""), "Accept": "application/json"}

                # Get deal counts
                deals_data = {"total": 0, "open": 0, "won": 0, "lost": 0, "pipeline_value": 0}
                try:
                    async with httpx.AsyncClient(timeout=10) as client:
                        deals_res = await client.get("https://api.merge.dev/api/crm/v1/opportunities?page_size=100", headers=headers)
                        if deals_res.status_code == 200:
                            deals = deals_res.json().get("results", [])
                            deals_data["total"] = len(deals)
                            for d in deals:
                                status = (d.get("status") or "").upper()
                                if status == "OPEN":
                                    deals_data["open"] += 1
                                elif status in ("WON", "CLOSED_WON"):
                                    deals_data["won"] += 1
                                elif status in ("LOST", "CLOSED_LOST"):
                                    deals_data["lost"] += 1
                                amt = d.get("amount")
                                if amt and status == "OPEN":
                                    try:
                                        deals_data["pipeline_value"] += float(amt)
                                    except (ValueError, TypeError):
                                        pass
                except Exception as e:
                    logger.warning(f"[market-intel] Deals fetch failed: {e}")

                # Get contact count
                contact_count = 0
                try:
                    async with httpx.AsyncClient(timeout=10) as client:
                        contacts_res = await client.get("https://api.merge.dev/api/crm/v1/contacts?page_size=1", headers=headers)
                        if contacts_res.status_code == 200:
                            contact_count = len(contacts_res.json().get("results", []))
                            # Check if there's pagination (next cursor)
                            if contacts_res.json().get("next"):
                                contact_count = 50  # approximate
                except Exception as e:
                    logger.warning(f"[market-intel] Contacts fetch failed: {e}")

                crm_summary = {
                    "provider": provider,
                    "connected": True,
                    "contacts": contact_count,
                    "deals": deals_data,
                }
    except Exception as e:
        logger.warning(f"[market-intel] CRM aggregation failed: {e}")

    # 3. Get forensic calibration
    forensic = None
    try:
        op_res = sb.table("user_operator_profile").select("operator_profile").eq("user_id", user_id).maybe_single().execute()
        op_data = op_res.data if op_res else None
        if op_data:
            op = op_data.get("operator_profile") or {}
            forensic = op.get("forensic_calibration")
    except Exception:
        pass

    # 4. Get business profile
    bp = None
    try:
        bp = await get_business_profile_supabase(user_id)
    except Exception:
        pass

    # 5. Build market intelligence response
    # If we have a cognitive snapshot, enhance it with live CRM data
    if not cognitive:
        cognitive = {}

    # Inject live CRM data into cognitive structure
    if crm_summary:
        cognitive["crm"] = crm_summary
        if crm_summary["deals"]["pipeline_value"] > 0:
            cognitive["pipeline_total"] = crm_summary["deals"]["pipeline_value"]
        if not cognitive.get("system_state"):
            # Generate system state from CRM data
            deals = crm_summary["deals"]
            if deals["total"] > 0:
                win_rate = deals["won"] / deals["total"] if deals["total"] > 0 else 0
                if win_rate > 0.5:
                    cognitive["system_state"] = {"status": "STABLE", "confidence": 65, "interpretation": f"Active CRM pipeline with {deals['total']} deals. {crm_summary['provider']} connected and syncing.", "velocity": "stable"}
                elif deals["open"] > deals["won"]:
                    cognitive["system_state"] = {"status": "DRIFT", "confidence": 60, "interpretation": f"Pipeline shows {deals['open']} open deals. Conversion rate needs attention.", "velocity": "worsening"}
                else:
                    cognitive["system_state"] = {"status": "STABLE", "confidence": 55, "interpretation": f"CRM shows {deals['total']} total opportunities.", "velocity": "stable"}

    # Inject forensic data
    if forensic:
        cognitive["forensic_calibration"] = forensic
        mi = cognitive.get("market_intelligence") or {}
        mi["risk_profile"] = forensic.get("risk_profile")
        mi["composite_score"] = forensic.get("composite_score")
        cognitive["market_intelligence"] = mi

    # Inject business profile data
    if bp:
        if bp.get("website"):
            cognitive["website"] = bp["website"]
        if bp.get("industry"):
            cognitive["industry"] = bp["industry"]

    return {"cognitive": cognitive, "crm": crm_summary, "forensic": forensic, "has_data": bool(cognitive.get("system_state") or crm_summary or forensic)}
