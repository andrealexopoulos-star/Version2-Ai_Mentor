"""
Strategic Console API — Decision Compression Engine
Reads from intelligence tables + Merge.dev integrations, synthesizes executive briefings.
"""
from fastapi import APIRouter, Depends
from datetime import datetime, timezone
import logging
import json
import os
import httpx

from routes.deps import get_current_user, get_sb, OPENAI_KEY, logger

router = APIRouter()

MERGE_API_KEY = os.environ.get("MERGE_API_KEY", "")


async def _fetch_merge_data(account_token: str, endpoint: str, page_size: int = 20):
    """Fetch data from Merge.dev API."""
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                f"https://api.merge.dev/api/{endpoint}?page_size={page_size}",
                headers={"Authorization": f"Bearer {MERGE_API_KEY}", "X-Account-Token": account_token}
            )
            if resp.status_code == 200:
                return resp.json().get("results", [])
    except Exception as e:
        logger.warning(f"[merge] Fetch failed for {endpoint}: {e}")
    return []


@router.get("/strategic-console/briefing")
async def get_strategic_briefing(current_user: dict = Depends(get_current_user)):
    """Real-time decision compression from all connected data sources."""
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
        "crm_summary": None,
        "financial_summary": None,
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

    # 2. Connected integrations — fetch live data from Merge.dev
    integrations = []
    try:
        int_result = sb.table("integration_accounts").select(
            "provider, category, account_token"
        ).eq("user_id", user_id).execute()
        integrations = int_result.data or []
    except Exception:
        pass

    crm_token = None
    finance_token = None
    for integ in integrations:
        if integ.get("category") == "crm" and integ.get("account_token"):
            crm_token = integ["account_token"]
            briefing["data_sources"].append(f"CRM ({integ['provider']})")
        elif integ.get("category") in ("accounting", "financial") and integ.get("account_token"):
            finance_token = integ["account_token"]
            briefing["data_sources"].append(f"Financial ({integ['provider']})")
        elif integ.get("category") == "email":
            briefing["data_sources"].append(f"Email ({integ['provider']})")

    # 3. CRM data (HubSpot)
    if crm_token and crm_token != "connected":
        contacts = await _fetch_merge_data(crm_token, "crm/v1/contacts", 50)
        deals = await _fetch_merge_data(crm_token, "crm/v1/opportunities", 20)
        open_deals = [d for d in deals if d.get("status") == "OPEN"]
        won_deals = [d for d in deals if d.get("status") == "WON"]
        lost_deals = [d for d in deals if d.get("status") == "LOST"]
        briefing["crm_summary"] = {
            "total_contacts": len(contacts),
            "total_deals": len(deals),
            "open_deals": len(open_deals),
            "won_deals": len(won_deals),
            "lost_deals": len(lost_deals),
            "recent_deals": [{"name": d.get("name","")[:60], "status": d.get("status")} for d in deals[:5]],
        }

    # 4. Financial data (Xero)
    if finance_token and finance_token != "connected":
        accounts = await _fetch_merge_data(finance_token, "accounting/v1/accounts", 30)
        invoices = await _fetch_merge_data(finance_token, "accounting/v1/invoices", 20)
        balance_sheet = await _fetch_merge_data(finance_token, "accounting/v1/balance-sheets", 1)
        briefing["financial_summary"] = {
            "total_accounts": len(accounts),
            "total_invoices": len(invoices),
            "account_types": list(set(a.get("type","") for a in accounts if a.get("type"))),
            "recent_invoices": [{"number": i.get("number",""), "total": i.get("total_amount"), "status": i.get("status")} for i in invoices[:5]],
        }

    # 5. Observation events
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

    # 6. Escalation memory
    escalations = []
    try:
        esc = sb.table("escalation_memory").select(
            "domain, position, pressure_level, times_detected, last_detected_at, has_contradiction"
        ).eq("user_id", user_id).eq("active", True).order("times_detected", desc=True).limit(10).execute()
        if esc.data:
            escalations = esc.data
    except Exception:
        pass

    # 7. Decision pressure
    pressures = []
    try:
        dp = sb.table("decision_pressure").select(
            "domain, pressure_level, window_days, basis, last_updated_at"
        ).eq("user_id", user_id).eq("active", True).limit(5).execute()
        if dp.data:
            pressures = dp.data
    except Exception:
        pass

    # 8. Email count
    try:
        emails = sb.table("outlook_emails").select("id", count="exact").eq("user_id", user_id).execute()
        if emails.count:
            briefing["data_sources"].append(f"outlook_emails ({emails.count})")
    except Exception:
        pass

    # === SYNTHESIS ===

    # Decision Pressure Index
    dpi = 0
    if pressures:
        level_map = {"CRITICAL": 100, "HIGH": 75, "ELEVATED": 50, "LOW": 20}
        dpi = max(level_map.get(p.get("pressure_level", "LOW"), 10) for p in pressures)
    elif escalations:
        dpi = min(60, len(escalations) * 15)
    # Boost DPI if CRM shows pipeline risk
    if briefing.get("crm_summary"):
        crm = briefing["crm_summary"]
        if crm["open_deals"] > 0 and crm["won_deals"] == 0:
            dpi = max(dpi, 35)  # Pipeline with no closes = attention
        if crm["lost_deals"] > crm["won_deals"]:
            dpi = max(dpi, 50)  # Losing more than winning = compression
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

    # Top 3 Forces
    forces = []
    for esc in escalations[:3]:
        forces.append({
            "domain": esc.get("domain", "Unknown"),
            "position": esc.get("position", "UNKNOWN"),
            "intensity": esc.get("pressure_level", "LOW"),
            "times_detected": esc.get("times_detected", 1),
            "has_contradiction": esc.get("has_contradiction", False),
        })
    # Add CRM force if open deals exist
    if briefing.get("crm_summary") and briefing["crm_summary"]["open_deals"] > 0:
        forces.append({
            "domain": "Revenue Pipeline",
            "position": "ACTIVE" if briefing["crm_summary"]["won_deals"] > 0 else "ELEVATED",
            "intensity": "HIGH" if briefing["crm_summary"]["lost_deals"] > briefing["crm_summary"]["won_deals"] else "MEDIUM",
            "detail": f"{briefing['crm_summary']['open_deals']} open, {briefing['crm_summary']['won_deals']} won, {briefing['crm_summary']['lost_deals']} lost",
        })
    # Add Financial force
    if briefing.get("financial_summary") and briefing["financial_summary"]["total_accounts"] > 0:
        forces.append({
            "domain": "Financial Position",
            "position": "STABLE",
            "intensity": "LOW",
            "detail": f"{briefing['financial_summary']['total_accounts']} accounts tracked",
        })
    briefing["compression"] = forces[:3]
    if forces:
        briefing["primary_focus_domain"] = forces[0]["domain"]

    # Drift Vectors
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

    # Signal Trace
    briefing["signal_trace"] = [
        {"signal": s.get("signal_name"), "source": s.get("source"), "confidence": s.get("confidence", 0), "observed_at": s.get("observed_at"), "domain": s.get("domain")}
        for s in signals[:10]
    ]

    # Executive Narrative
    snap_memo = None
    try:
        snap = sb.table("intelligence_snapshots").select("executive_memo").eq("user_id", user_id).order("generated_at", desc=True).limit(1).execute()
        if snap.data:
            snap_memo = snap.data[0].get("executive_memo")
    except Exception:
        pass

    if snap_memo:
        briefing["executive_narrative"] = snap_memo
    else:
        ctx = briefing.get("business_context", {})
        narrative_parts = {}
        # Build from business context + CRM + financial
        tension_parts = []
        if ctx.get("main_challenges"):
            tension_parts.append(f"Active challenges: {ctx['main_challenges']}")
        if briefing.get("crm_summary"):
            crm = briefing["crm_summary"]
            tension_parts.append(f"Pipeline: {crm['open_deals']} open deals, {crm['total_contacts']} contacts tracked")
        if briefing.get("financial_summary"):
            fin = briefing["financial_summary"]
            tension_parts.append(f"Financial: {fin['total_accounts']} accounts monitored via Xero")
        narrative_parts["primary_tension"] = ". ".join(tension_parts) if tension_parts else "System monitoring. No active tensions."
        narrative_parts["force_summary"] = f"Business stage: {ctx.get('business_stage', 'unknown')}. Growth: {ctx.get('growth_strategy', 'undefined')}."
        if ctx.get("short_term_goals"):
            narrative_parts["strategic_direction"] = f"Current focus: {ctx['short_term_goals']}"
        briefing["executive_narrative"] = narrative_parts

    return briefing


@router.post("/strategic-console/synthesize")
async def trigger_intelligence_synthesis(current_user: dict = Depends(get_current_user)):
    """Process connected integrations into observation_events signals."""
    user_id = current_user.get("id")
    sb = get_sb()
    results = {"signals_created": 0, "sources_processed": []}

    # 1. Emails
    try:
        emails = sb.table("outlook_emails").select(
            "id, subject, from_address, received_date, body_preview, is_read"
        ).eq("user_id", user_id).order("received_date", desc=True).limit(50).execute()
        if emails.data:
            results["sources_processed"].append(f"outlook_emails ({len(emails.data)})")
            for email in emails.data[:20]:
                try:
                    sb.table("observation_events").insert({
                        "user_id": user_id,
                        "signal_name": "email.received",
                        "event_type": "email_signal",
                        "source": "outlook",
                        "domain": "operations",
                        "payload": {"subject": email.get("subject", "")[:200], "from": email.get("from_address", ""), "is_read": email.get("is_read", False)},
                        "confidence": 0.9,
                        "observed_at": email.get("received_date", datetime.now(timezone.utc).isoformat()),
                    }).execute()
                    results["signals_created"] += 1
                except Exception:
                    pass
    except Exception as e:
        logger.warning(f"[synthesis] Email processing: {e}")

    # 2. CRM from Merge.dev
    integrations = []
    try:
        int_result = sb.table("integration_accounts").select("provider, category, account_token").eq("user_id", user_id).execute()
        integrations = int_result.data or []
    except Exception:
        pass

    for integ in integrations:
        token = integ.get("account_token")
        if not token or token == "connected":
            continue

        if integ.get("category") == "crm":
            try:
                deals = await _fetch_merge_data(token, "crm/v1/opportunities", 20)
                results["sources_processed"].append(f"CRM deals ({len(deals)})")
                for deal in deals[:10]:
                    try:
                        sb.table("observation_events").insert({
                            "user_id": user_id,
                            "signal_name": f"crm.deal.{deal.get('status','unknown').lower()}",
                            "event_type": "crm_signal",
                            "source": integ["provider"],
                            "domain": "revenue",
                            "payload": {"deal_name": deal.get("name","")[:100], "status": deal.get("status"), "amount": deal.get("amount")},
                            "confidence": 0.95,
                        }).execute()
                        results["signals_created"] += 1
                    except Exception:
                        pass
            except Exception as e:
                logger.warning(f"[synthesis] CRM: {e}")

        elif integ.get("category") in ("accounting", "financial"):
            try:
                accounts = await _fetch_merge_data(token, "accounting/v1/accounts", 20)
                results["sources_processed"].append(f"Financial accounts ({len(accounts)})")
                for acc in accounts[:5]:
                    try:
                        sb.table("observation_events").insert({
                            "user_id": user_id,
                            "signal_name": f"finance.account.{acc.get('type','unknown').lower()}",
                            "event_type": "financial_signal",
                            "source": integ["provider"],
                            "domain": "operations",
                            "payload": {"name": acc.get("name","")[:100], "type": acc.get("type"), "balance": acc.get("current_balance")},
                            "confidence": 0.9,
                        }).execute()
                        results["signals_created"] += 1
                    except Exception:
                        pass
            except Exception as e:
                logger.warning(f"[synthesis] Finance: {e}")

    results["synthesized_at"] = datetime.now(timezone.utc).isoformat()
    return results
