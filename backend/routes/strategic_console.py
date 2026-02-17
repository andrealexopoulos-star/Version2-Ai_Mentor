"""
Strategic Console API — Decision Compression Engine
Reads from intelligence tables, synthesizes executive briefings.
"""
from fastapi import APIRouter, Depends
from datetime import datetime, timezone
import logging
import json

from routes.deps import get_current_user, get_sb, OPENAI_KEY, logger

router = APIRouter()


@router.get("/strategic-console/briefing")
async def get_strategic_briefing(current_user: dict = Depends(get_current_user)):
    """
    The Strategic Console Briefing — real-time decision compression.
    Reads: observation_events, escalation_memory, decision_pressure, 
           business_profiles, intelligence_snapshots, email_intelligence
    Returns: Structured executive briefing with compression + drift + signals.
    """
    user_id = current_user.get("id")
    sb = get_sb()

    briefing = {
        "system_state": "STABLE",
        "decision_pressure_index": 0,
        "primary_focus_domain": None,
        "compression": [],
        "executive_narrative": None,
        "drift_vectors": [],
        "signal_trace": [],
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "data_sources": [],
    }

    # 1. Business context
    try:
        bp = sb.table("business_profiles").select(
            "business_name, industry, business_stage, target_market, main_challenges, short_term_goals, growth_strategy"
        ).eq("user_id", user_id).maybe_single().execute()
        if bp.data:
            briefing["business_context"] = bp.data
            briefing["data_sources"].append("business_profiles")
    except Exception:
        pass

    # 2. Observation events (signals from integrations)
    signals = []
    try:
        obs = sb.table("observation_events").select(
            "signal_name, payload, confidence, source, observed_at, domain"
        ).eq("user_id", user_id).order("observed_at", desc=True).limit(20).execute()
        if obs.data:
            signals = obs.data
            briefing["data_sources"].append(f"observation_events ({len(signals)})")
    except Exception:
        pass

    # 3. Escalation memory
    escalations = []
    try:
        esc = sb.table("escalation_memory").select(
            "domain, position, pressure_level, times_detected, last_detected_at, has_contradiction"
        ).eq("user_id", user_id).eq("active", True).order("times_detected", desc=True).limit(10).execute()
        if esc.data:
            escalations = esc.data
            briefing["data_sources"].append(f"escalation_memory ({len(escalations)})")
    except Exception:
        pass

    # 4. Decision pressure
    pressures = []
    try:
        dp = sb.table("decision_pressure").select(
            "domain, pressure_level, window_days, basis, last_updated_at"
        ).eq("user_id", user_id).eq("active", True).order("pressure_level", desc=True).limit(5).execute()
        if dp.data:
            pressures = dp.data
            briefing["data_sources"].append(f"decision_pressure ({len(pressures)})")
    except Exception:
        pass

    # 5. Latest intelligence snapshot
    try:
        snap = sb.table("intelligence_snapshots").select(
            "executive_memo, resolution_score, generated_at"
        ).eq("user_id", user_id).order("generated_at", desc=True).limit(1).execute()
        if snap.data:
            briefing["latest_snapshot"] = snap.data[0]
            briefing["data_sources"].append("intelligence_snapshots")
    except Exception:
        pass

    # 6. Email intelligence
    email_signals = []
    try:
        ei = sb.table("email_intelligence").select(
            "signal_type, summary, priority, source_email, detected_at"
        ).eq("user_id", user_id).order("detected_at", desc=True).limit(10).execute()
        if ei.data:
            email_signals = ei.data
            briefing["data_sources"].append(f"email_intelligence ({len(email_signals)})")
    except Exception:
        pass

    # 7. Email count for context
    try:
        emails = sb.table("outlook_emails").select("id", count="exact").eq("user_id", user_id).execute()
        if emails.count:
            briefing["data_sources"].append(f"outlook_emails ({emails.count})")
    except Exception:
        pass

    # === SYNTHESIS: Compute system state and compression ===

    # Decision Pressure Index (0-100)
    dpi = 0
    if pressures:
        level_map = {"CRITICAL": 100, "HIGH": 75, "ELEVATED": 50, "LOW": 20}
        dpi = max(level_map.get(p.get("pressure_level", "LOW"), 10) for p in pressures)
    elif escalations:
        dpi = min(60, len(escalations) * 15)
    briefing["decision_pressure_index"] = dpi

    # System State
    if dpi >= 80:
        briefing["system_state"] = "CRITICAL"
    elif dpi >= 50:
        briefing["system_state"] = "COMPRESSION"
    elif dpi >= 25 or len(escalations) > 0:
        briefing["system_state"] = "DRIFT"
    else:
        briefing["system_state"] = "STABLE"

    # Top 3 Strategic Forces (compression view)
    forces = []
    for esc in escalations[:3]:
        forces.append({
            "domain": esc.get("domain", "Unknown"),
            "position": esc.get("position", "UNKNOWN"),
            "intensity": esc.get("pressure_level", "LOW"),
            "times_detected": esc.get("times_detected", 1),
            "has_contradiction": esc.get("has_contradiction", False),
        })
    # Fill from decision pressure if not enough escalations
    if len(forces) < 3:
        for dp in pressures:
            if len(forces) >= 3:
                break
            if dp.get("domain") not in [f["domain"] for f in forces]:
                forces.append({
                    "domain": dp.get("domain", "Unknown"),
                    "position": "PRESSURED",
                    "intensity": dp.get("pressure_level", "LOW"),
                    "window_days": dp.get("window_days"),
                    "basis": dp.get("basis"),
                })
    briefing["compression"] = forces

    # Primary Focus Domain
    if forces:
        briefing["primary_focus_domain"] = forces[0]["domain"]

    # Drift Vectors from observation events
    drift_domains = {}
    for sig in signals:
        domain = sig.get("domain", "general")
        if domain not in drift_domains:
            drift_domains[domain] = {"count": 0, "latest": sig.get("observed_at"), "signals": []}
        drift_domains[domain]["count"] += 1
        drift_domains[domain]["signals"].append(sig.get("signal_name", "unknown"))
    briefing["drift_vectors"] = [
        {"domain": d, "signal_count": v["count"], "latest": v["latest"], "signals": v["signals"][:3]}
        for d, v in sorted(drift_domains.items(), key=lambda x: x[1]["count"], reverse=True)[:5]
    ]

    # Signal Trace (transparency)
    briefing["signal_trace"] = [
        {
            "signal": s.get("signal_name", "unknown"),
            "source": s.get("source", "unknown"),
            "confidence": s.get("confidence", 0),
            "observed_at": s.get("observed_at"),
            "domain": s.get("domain", "general"),
        }
        for s in signals[:10]
    ]

    # Executive Narrative (from snapshot or generated summary)
    snap_memo = (briefing.get("latest_snapshot") or {}).get("executive_memo")
    if snap_memo:
        briefing["executive_narrative"] = snap_memo
    elif briefing.get("business_context"):
        ctx = briefing["business_context"]
        challenges = ctx.get("main_challenges", "")
        goals = ctx.get("short_term_goals", "")
        briefing["executive_narrative"] = {
            "primary_tension": f"Active challenges: {challenges}" if challenges else "No active tensions detected. System monitoring.",
            "strategic_direction": f"Current focus: {goals}" if goals else None,
            "force_summary": f"Business stage: {ctx.get('business_stage', 'unknown')}. Growth strategy: {ctx.get('growth_strategy', 'undefined')}.",
        }

    return briefing


@router.post("/strategic-console/synthesize")
async def trigger_intelligence_synthesis(current_user: dict = Depends(get_current_user)):
    """
    Trigger intelligence synthesis from connected integrations.
    Reads emails, CRM data, financial data → writes to observation_events + intelligence tables.
    """
    user_id = current_user.get("id")
    sb = get_sb()
    results = {"signals_created": 0, "sources_processed": []}

    # 1. Process emails into observation_events
    try:
        emails = sb.table("outlook_emails").select(
            "id, subject, from_address, received_date, body_preview, is_read"
        ).eq("user_id", user_id).order("received_date", desc=True).limit(50).execute()

        if emails.data:
            results["sources_processed"].append(f"outlook_emails ({len(emails.data)})")
            for email in emails.data[:20]:
                # Create observation event from email signal
                try:
                    sb.table("observation_events").upsert({
                        "user_id": user_id,
                        "signal_name": "email.received",
                        "source": "outlook",
                        "domain": "communications",
                        "payload": {
                            "subject": email.get("subject", "")[:200],
                            "from": email.get("from_address", ""),
                            "is_read": email.get("is_read", False),
                        },
                        "confidence": 0.9,
                        "observed_at": email.get("received_date", datetime.now(timezone.utc).isoformat()),
                    }, on_conflict="user_id,signal_name,observed_at").execute()
                    results["signals_created"] += 1
                except Exception:
                    pass
    except Exception as e:
        logger.warning(f"[synthesis] Email processing failed: {e}")

    # 2. Process CRM data from merge integrations
    try:
        crm = sb.table("integration_accounts").select(
            "provider, category"
        ).eq("user_id", user_id).eq("category", "crm").execute()
        if crm.data:
            results["sources_processed"].append(f"crm ({len(crm.data)} providers)")
            for provider in crm.data:
                try:
                    sb.table("observation_events").upsert({
                        "user_id": user_id,
                        "signal_name": f"crm.connected.{provider['provider']}",
                        "source": provider["provider"],
                        "domain": "sales",
                        "payload": {"status": "connected", "provider": provider["provider"]},
                        "confidence": 1.0,
                        "observed_at": datetime.now(timezone.utc).isoformat(),
                    }, on_conflict="user_id,signal_name,observed_at").execute()
                    results["signals_created"] += 1
                except Exception:
                    pass
    except Exception as e:
        logger.warning(f"[synthesis] CRM processing failed: {e}")

    # 3. Process financial data
    try:
        fin = sb.table("integration_accounts").select(
            "provider, category"
        ).eq("user_id", user_id).eq("category", "financial").execute()
        if fin.data:
            results["sources_processed"].append(f"financial ({len(fin.data)} providers)")
    except Exception:
        pass

    results["synthesized_at"] = datetime.now(timezone.utc).isoformat()
    return results
