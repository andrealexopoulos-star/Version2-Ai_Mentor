"""Board Room routes — extracted from server.py. Zero logic changes."""
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Dict, List, Optional
from core.llm_router import llm_chat, llm_trinity_chat
from routes.deps import get_current_user_from_request, get_sb, OPENAI_KEY, logger, check_rate_limit, AI_MODELS
from intelligence_live_truth import get_live_integration_truth
from supabase_intelligence_helpers import get_priority_analysis_supabase
import os
import httpx
import asyncio
from guardrails import sanitise_input, sanitise_output

router = APIRouter()


class BoardRoomRequest(BaseModel):
    message: str
    history: Optional[List[Dict[str, str]]] = []


class EscalationActionRequest(BaseModel):
    domain: str
    action: str  # acknowledged | deferred


class BoardRoomDiagnosisRequest(BaseModel):
    focus_area: str


class WarRoomAskRequest(BaseModel):
    question: str
    product_or_service: Optional[str] = None


def _is_crm_note_audit_query(question: str) -> bool:
    text = (question or '').lower()
    has_note = 'note' in text or 'notes' in text
    has_last = 'last' in text or 'latest' in text or 'most recent' in text
    has_crm_object = 'hubspot' in text or 'contact' in text or 'crm' in text
    return has_note and has_last and has_crm_object


DIAGNOSIS_FOCUS_AREAS = {
    "cash_flow_financial_risk",
    "revenue_momentum",
    "strategy_effectiveness",
    "operations_delivery",
    "people_retention_capacity",
    "customer_relationships",
    "risk_compliance",
    "systems_technology",
    "market_position",
}


def _domain_action_hint(domain: str) -> str:
    domain_value = (domain or "").lower()
    if "revenue" in domain_value or "sales" in domain_value:
        return "Assign a commercial owner, prioritise the top at-risk deal, and set a 48-hour recovery check."
    if "cash" in domain_value or "financial" in domain_value or "capital" in domain_value:
        return "Protect cash first: tighten collections, defer non-critical spend, and re-forecast this week."
    if "operations" in domain_value or "delivery" in domain_value:
        return "Name one bottleneck owner and clear one delivery blocker before the next operating cycle."
    if "people" in domain_value or "team" in domain_value:
        return "Stabilise capacity: rebalance workload and protect priority response windows today."
    if "risk" in domain_value or "compliance" in domain_value:
        return "Document immediate mitigation, assign accountable owner, and confirm control checks this week."
    return "Select one accountable owner and commit to an immediate next step before the decision window narrows."


def _build_fallback_explainability(primary_domain: str = "business", primary_detail: str = "") -> Dict[str, object]:
    detail = (primary_detail or "Live pressure is emerging across connected signals.").strip()
    return {
        "why_visible": f"BIQc is surfacing {primary_domain or 'business'} risk from live connected telemetry.",
        "why_now": detail,
        "next_action": _domain_action_hint(primary_domain),
        "if_ignored": "Delayed response can compress options and increase second-order impact across execution, cash, and trust.",
        "evidence_chain": [],
    }


def _build_event_chain(events: List[Dict[str, object]]) -> List[Dict[str, object]]:
    chain = []
    for event in events:
        chain.append({
            "domain": event.get("domain"),
            "event_type": event.get("event_type"),
            "severity": event.get("severity"),
            "source": event.get("source"),
            "created_at": event.get("created_at"),
        })
    return chain


def _derive_explainability(sb, user_id: str, primary_domain: str = "business", primary_detail: str = "") -> Dict[str, object]:
    payload = _build_fallback_explainability(primary_domain, primary_detail)
    try:
        integrations = sb.table("integration_accounts").select("id", count="exact").eq("user_id", user_id).eq("is_active", True).execute()
        connected_count = integrations.count or 0

        events_result = sb.table("observation_events").select(
            "domain, event_type, severity, source, created_at, detail"
        ).eq("user_id", user_id).order("created_at", desc=True).limit(5).execute()
        events = events_result.data or []

        if events:
            top_event = events[0]
            domain = top_event.get("domain") or primary_domain or "business"
            detail = top_event.get("detail") or primary_detail or "Signal severity increased from observed telemetry."
            payload["why_visible"] = (
                f"BIQc is surfacing {domain} pressure from {connected_count} connected system"
                f"{'s' if connected_count != 1 else ''}."
            )
            payload["why_now"] = detail
            payload["next_action"] = _domain_action_hint(domain)
            payload["evidence_chain"] = _build_event_chain(events)
        else:
            payload["why_visible"] = (
                f"BIQc is operating with {connected_count} connected system"
                f"{'s' if connected_count != 1 else ''}; no recent observation events were returned."
            )
    except Exception:
        pass
    return payload


def _normalise_war_room_analysis_text(data: Dict[str, object]) -> Optional[str]:
    analysis = data.get("analysis") if isinstance(data, dict) else None
    if not isinstance(analysis, dict):
        return None

    title = str(analysis.get("analysis_title") or "").strip()
    customer_insight = str(analysis.get("customer_insight") or "").strip()
    revenue_opportunity = str(analysis.get("revenue_opportunity") or "").strip()

    recommendations = [
        str(item).strip()
        for item in (analysis.get("recommendations") or [])
        if str(item).strip()
    ]
    risks = [
        str(item).strip()
        for item in (analysis.get("risks_to_watch") or [])
        if str(item).strip()
    ]

    lines: List[str] = []
    if title:
        lines.append(title)
    if customer_insight:
        lines.append(f"Situation: {customer_insight}")
    if revenue_opportunity:
        lines.append(f"Opportunity: {revenue_opportunity}")
    if recommendations:
        lines.append("Recommended actions:")
        lines.extend([f"- {item}" for item in recommendations[:3]])
    if risks:
        lines.append("Risks to watch:")
        lines.extend([f"- {item}" for item in risks[:2]])

    return "\n".join(lines).strip() or None


async def _build_email_truth_fallback(sb, user_id: str) -> Optional[str]:
    try:
        priority_analysis = await get_priority_analysis_supabase(sb, user_id)
        analysis = (priority_analysis or {}).get("analysis") or {}
        high_priority = analysis.get("high_priority") or []
        medium_priority = analysis.get("medium_priority") or []
        if high_priority:
            top = high_priority[0]
            return (
                f"Boardroom is in resilience mode, but BIQc still sees {len(high_priority)} high-priority email thread(s) needing attention. "
                f"Top thread: {top.get('subject') or 'priority email'} from {top.get('from') or 'a key contact'}. "
                f"Why it matters: {top.get('reason') or 'commercial urgency remains active'}."
            )
        if medium_priority:
            top = medium_priority[0]
            return (
                f"Boardroom is in resilience mode. No unresolved high-priority reply gap is currently leading, but {len(medium_priority)} medium-priority email thread(s) still need review. "
                f"Top example: {top.get('subject') or 'email thread'} from {top.get('from') or 'a contact'}."
            )
    except Exception:
        pass
    return None


def _build_cross_integration_truth_guard(sb, user_id: str) -> Optional[str]:
    try:
        live_truth = get_live_integration_truth(sb, user_id)
        connector_truth = {}
        for item in live_truth.get("integrations", []):
            cat = (item.get("category") or "").lower()
            if cat:
                connector_truth[cat] = item
        blocked = [
            item for key, item in connector_truth.items()
            if key in {"crm", "accounting", "email", "calendar"} and item.get("truth_state") in {"stale", "error", "unverified"}
        ]
        if not blocked:
            return None

        blocked_copy = ", ".join(
            f"{item.get('category', 'source').title()} ({item.get('truth_state')})"
            for item in blocked
        )
        return (
            f"Boardroom truth gate is active. BIQc is withholding unsupported cross-system claims because these sources are not live-verified right now: {blocked_copy}. "
            f"Restore source truth first, then rerun Boardroom for full strategic synthesis."
        )
    except Exception:
        return None


async def _post_with_retries(url: str, headers: Dict[str, str], payload: Dict[str, object], timeout_seconds: int = 45, retries: int = 2):
    last_error = None
    for attempt in range(1, retries + 1):
        try:
            async with httpx.AsyncClient(timeout=timeout_seconds) as client:
                response = await client.post(url, headers=headers, json=payload)
            if response.status_code >= 500 and attempt < retries:
                await asyncio.sleep(0.4 * attempt)
                continue
            return response
        except httpx.HTTPError as error:
            last_error = error
            if attempt < retries:
                await asyncio.sleep(0.4 * attempt)
                continue
            raise
    if last_error:
        raise last_error
    raise HTTPException(status_code=502, detail="Edge function unavailable")


# ─── Priority Compression: domain ranking by urgency (pure function) ───
POSITION_SEVERITY = {"CRITICAL": 40, "DETERIORATING": 30, "ELEVATED": 15, "STABLE": 0}
PRESSURE_SCORE = {"CRITICAL": 30, "HIGH": 20, "MODERATE": 10, "LOW": 0}


def rank_domains(positions, escalation_history, contradictions, pressure, freshness):
    """Score and rank domains for priority compression. Pure function — response shaping only."""
    esc_map = {}
    if escalation_history:
        for e in escalation_history:
            esc_map[e.get("domain", "")] = e

    contra_map = {}
    if contradictions:
        for c in contradictions:
            d = c.get("domain", "")
            if d not in contra_map:
                contra_map[d] = []
            contra_map[d].append(c)

    ranked = []
    for domain, data in (positions or {}).items():
        pos = data.get("position", "STABLE")
        score = POSITION_SEVERITY.get(pos, 0)

        p_data = (pressure or {}).get(domain, {})
        if p_data:
            score += PRESSURE_SCORE.get(p_data.get("pressure_level", "LOW"), 0)
            window = (p_data.get("basis") or {}).get("window_days_remaining")
            if window is not None:
                if window <= 3:
                    score += 20
                elif window <= 7:
                    score += 10
                elif window <= 14:
                    score += 5

        if domain in contra_map:
            score += 15 * len(contra_map[domain])

        if domain in esc_map:
            score += min(esc_map[domain].get("times_detected", 1) * 3, 15)

        ranked.append({
            "domain": domain,
            "position": pos,
            "score": score,
            "confidence": data.get("confidence", 0),
            "finding": data.get("finding", ""),
            "has_contradiction": domain in contra_map,
            "contradiction_count": len(contra_map.get(domain, [])),
            "pressure_level": p_data.get("pressure_level") if p_data else None,
            "window_days": (p_data.get("basis") or {}).get("window_days_remaining") if p_data else None,
            "persistence": esc_map.get(domain, {}).get("times_detected", 0),
            "freshness_state": ((freshness or {}).get(domain) or {}).get("confidence_state"),
        })

    ranked.sort(key=lambda x: x["score"], reverse=True)
    return ranked


@router.post("/boardroom/respond")
async def boardroom_respond(request: Request, payload: BoardRoomRequest):
    try:
        current_user = await get_current_user_from_request(request)
        user_id = current_user.get("id")
    except Exception:
        raise HTTPException(status_code=401, detail="Not authenticated")

    await check_rate_limit(user_id, "boardroom_diagnosis", get_sb())

    message = payload.message.strip()
    history = payload.history or []
    if not message:
        raise HTTPException(status_code=400, detail="Message required")

    sanitised = sanitise_input(message)
    if sanitised.get("blocked"):
        raise HTTPException(status_code=400, detail="Message rejected by safety filter")
    message = sanitised.get("text") or message

    sb = get_sb()
    truth_guard = _build_cross_integration_truth_guard(sb, user_id)
    if truth_guard:
        return {"response": truth_guard, "escalations": []}

    try:
        from watchtower_engine import get_watchtower_engine
        from boardroom_prompt import build_boardroom_prompt
        from fact_resolution import resolve_facts, build_known_facts_prompt

        engine = get_watchtower_engine()
        resolved_facts = await resolve_facts(sb, user_id)
        facts_prompt = build_known_facts_prompt(resolved_facts)

        positions = await engine.get_positions(user_id)
        findings = await engine.get_findings(user_id, limit=10)

        intel_config = None
        try:
            bp_result = sb.table("business_profiles").select("intelligence_configuration").eq("user_id", user_id).single().execute()
            if bp_result.data:
                intel_config = bp_result.data.get("intelligence_configuration")
        except Exception:
            pass

        calibration = None
        try:
            cal_result = sb.table("user_operator_profile").select("operator_profile, agent_persona, agent_instructions").eq("user_id", user_id).single().execute()
            if cal_result.data:
                calibration = cal_result.data
        except Exception:
            pass

        escalation_history = None
        try:
            from escalation_memory import get_escalation_memory
            escalation_history = await get_escalation_memory().get_active_escalations(user_id)
        except RuntimeError:
            pass

        contradictions = None
        try:
            from contradiction_engine import get_contradiction_engine
            contradictions = await get_contradiction_engine().get_active_contradictions(user_id)
        except RuntimeError:
            pass

        pressure = None
        try:
            from pressure_calibration import get_pressure_calibration
            pressure = await get_pressure_calibration().get_active_pressures(user_id)
        except RuntimeError:
            pass

        freshness = None
        try:
            from evidence_freshness import get_evidence_freshness
            freshness = await get_evidence_freshness().get_freshness(user_id)
        except RuntimeError:
            pass

        # Fetch recent observation events for raw signal context
        recent_signals = []
        try:
            sig_result = sb.table("observation_events").select(
                "domain, event_type, severity, source, created_at"
            ).eq("user_id", user_id).order(
                "created_at", desc=True
            ).limit(15).execute()
            if sig_result.data:
                recent_signals = sig_result.data
        except Exception:
            pass

        system_prompt = build_boardroom_prompt(
            watchtower_positions=positions, watchtower_findings=findings,
            intelligence_config=intel_config, calibration=calibration,
            escalation_history=escalation_history, contradictions=contradictions,
            pressure=pressure, freshness=freshness,
            recent_signals=recent_signals,
        )
        if facts_prompt:
            system_prompt += f"\n\nRESOLVED BUSINESS FACTS:\n{facts_prompt}\n"

        api_key = OPENAI_KEY or os.environ.get('OPENAI_API_KEY')

        context_block = ""
        if history:
            context_block = "PRIOR EXCHANGE:\n"
            for h in history:
                label = "OPERATOR" if h.get("role", "user") == "user" else "BOARD ROOM"
                context_block += f"[{label}]: {h.get('content', '')}\n"
            context_block += "\n---\n"

        tier = str(current_user.get("subscription_tier") or "free").lower()
        use_trinity = tier in {"pro", "enterprise", "growth", "custom"}
        if use_trinity:
            raw_response = await llm_trinity_chat(
                system_message=system_prompt,
                user_message=f"{context_block}OPERATOR INPUT: {message}",
                messages=[],
            )
        else:
            raw_response = await llm_chat(
                system_message=system_prompt,
                user_message=f"{context_block}OPERATOR INPUT: {message}",
                model=AI_MODELS.get("boardroom", "gpt-5.3"),
                api_key=api_key,
            )

        active_escalations = []
        try:
            from escalation_memory import get_escalation_memory
            mem = get_escalation_memory()
            for domain in positions:
                pos = positions[domain].get("position")
                if pos and pos != "STABLE":
                    await mem.record_exposure(user_id, domain)
            for esc in await mem.get_active_escalations(user_id):
                active_escalations.append({
                    "domain": esc.get("domain"), "position": esc.get("position"),
                    "last_user_action": esc.get("last_user_action", "unknown"),
                    "times_detected": esc.get("times_detected", 1),
                })
        except RuntimeError:
            pass

        ranked = rank_domains(
            positions, escalation_history, contradictions, pressure, freshness
        )
        primary = ranked[0] if ranked else None
        secondary = ranked[1:4] if len(ranked) > 1 else []
        collapsed = ranked[4:] if len(ranked) > 4 else []
        explainability = _derive_explainability(
            sb,
            user_id,
            primary_domain=(primary or {}).get("domain") or "business",
            primary_detail=(primary or {}).get("finding") or "",
        )

        return {
            "response": sanitise_output(raw_response.strip()),
            "escalations": active_escalations,
            "priority_compression": {
                "primary": primary,
                "secondary": secondary,
                "collapsed": collapsed,
            },
            "explainability": explainability,
        }

    except Exception as e:
        logger.error(f"[boardroom] Error: {e}")
        email_truth_response = await _build_email_truth_fallback(sb, user_id)
        if email_truth_response:
            return {"response": email_truth_response, "escalations": []}
        fallback_events = []
        try:
            fallback_events = sb.table("observation_events").select(
                "domain, signal_name, severity, executive_summary, created_at"
            ).eq("user_id", user_id).order("created_at", desc=True).limit(3).execute().data or []
        except Exception:
            fallback_events = []

        if fallback_events:
            top = fallback_events[0]
            response = (
                f"Boardroom is in resilience mode, but the current highest-pressure signal is in {top.get('domain', 'business')}. "
                f"Latest signal: {top.get('executive_summary') or top.get('signal_name') or 'live telemetry requires review'}. "
                f"Action now: assign an owner and review the next 48-hour consequence window before drift compounds."
            )
        else:
            response = "Boardroom is temporarily degraded. Use the latest BIQc priorities and verify live source health before making a decision."
        return {"response": response, "escalations": []}


@router.post("/boardroom/diagnosis")
async def boardroom_diagnosis_proxy(request: Request, payload: BoardRoomDiagnosisRequest):
    try:
        current_user = await get_current_user_from_request(request)
        user_id = current_user.get("id")
    except Exception:
        raise HTTPException(status_code=401, detail="Not authenticated")

    focus_area = (payload.focus_area or "").strip()
    if focus_area not in DIAGNOSIS_FOCUS_AREAS:
        raise HTTPException(status_code=400, detail="Invalid diagnosis focus area")

    sb = get_sb()
    truth_guard = _build_cross_integration_truth_guard(sb, user_id)
    if truth_guard:
        explainability = _derive_explainability(sb, user_id, primary_domain=focus_area, primary_detail="Truth gate active")
        return {
            "headline": "Forensic truth gate is active",
            "narrative": truth_guard,
            "what_to_watch": "Restore source verification first, then rerun diagnosis for a full strategic answer.",
            "next_action": explainability["next_action"],
            "if_ignored": "You may act on stale or historically-only business data.",
            "why_visible": explainability["why_visible"],
            "why_now": "Boardroom diagnosis is intentionally constrained because core integration truth is not live-verified.",
            "evidence_chain": explainability["evidence_chain"],
            "degraded": True,
        }

    await check_rate_limit(user_id, "boardroom_diagnosis", sb)

    auth_header = request.headers.get("authorization")
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_anon_key = os.environ.get("SUPABASE_ANON_KEY")
    if not auth_header or not supabase_url or not supabase_anon_key:
        raise HTTPException(status_code=500, detail="Boardroom diagnosis not configured")

    edge_url = f"{supabase_url}/functions/v1/boardroom-diagnosis"
    headers = {
        "Authorization": auth_header,
        "apikey": supabase_anon_key,
        "Content-Type": "application/json",
    }

    try:
        response = await _post_with_retries(
            edge_url,
            headers=headers,
            payload={"focus_area": payload.focus_area},
            timeout_seconds=45,
            retries=2,
        )
    except httpx.HTTPError as error:
        logger.error(f"[boardroom/diagnosis] Edge function request failed: {error}")
        explainability = _derive_explainability(sb, user_id, primary_domain=focus_area, primary_detail="Diagnosis service unavailable")
        return {
            "headline": "Diagnosis service is temporarily unavailable",
            "narrative": "BIQc is running in resilience mode using your latest stored telemetry while the diagnosis engine recovers.",
            "what_to_watch": "Event volume in the selected domain and escalation persistence over the next 24 hours.",
            "next_action": explainability["next_action"],
            "if_ignored": explainability["if_ignored"],
            "why_visible": explainability["why_visible"],
            "why_now": explainability["why_now"],
            "evidence_chain": explainability["evidence_chain"],
            "degraded": True,
        }

    if response.status_code >= 400:
        if response.status_code >= 500:
            explainability = _derive_explainability(sb, user_id, primary_domain=focus_area, primary_detail="Diagnosis service degraded")
            return {
                "headline": "Diagnosis service degraded",
                "narrative": "BIQc received an upstream failure and returned a fallback using current telemetry context.",
                "what_to_watch": "Domain signal severity trend and execution impact indicators.",
                "next_action": explainability["next_action"],
                "if_ignored": explainability["if_ignored"],
                "why_visible": explainability["why_visible"],
                "why_now": explainability["why_now"],
                "evidence_chain": explainability["evidence_chain"],
                "degraded": True,
            }
        raise HTTPException(status_code=response.status_code, detail=response.text[:500])

    data = response.json()
    if isinstance(data, dict):
        for field in ("headline", "narrative", "what_to_watch", "if_ignored"):
            if isinstance(data.get(field), str):
                data[field] = sanitise_output(data[field])

        explainability = _derive_explainability(sb, user_id, primary_domain=focus_area, primary_detail=data.get("headline") or "")
        data.setdefault("why_visible", explainability["why_visible"])
        data.setdefault("why_now", explainability["why_now"])
        data.setdefault("next_action", explainability["next_action"])
        data.setdefault("if_ignored", explainability["if_ignored"])
        if not data.get("evidence_chain"):
            data["evidence_chain"] = explainability["evidence_chain"]
    return data


@router.post("/war-room/respond")
async def war_room_respond_proxy(request: Request, payload: WarRoomAskRequest):
    try:
        current_user = await get_current_user_from_request(request)
        user_id = current_user.get("id")
    except Exception:
        raise HTTPException(status_code=401, detail="Not authenticated")

    sanitised = sanitise_input(payload.question.strip())
    if sanitised.get("blocked"):
        raise HTTPException(status_code=400, detail="Question rejected by safety filter")

    sb = get_sb()
    truth_guard = _build_cross_integration_truth_guard(sb, user_id)
    if truth_guard:
        explainability = _derive_explainability(
            sb,
            user_id,
            primary_domain="war-room",
            primary_detail="Truth gate active",
        )
        return {
            "answer": truth_guard,
            "why_visible": explainability["why_visible"],
            "why_now": "War Room is intentionally constrained because some integrated sources are not live-verified.",
            "next_action": "Restore source truth, then return to War Room for cross-system analysis.",
            "if_ignored": "You may interrogate stale signals as if they are current strategic truth.",
            "evidence_chain": explainability["evidence_chain"],
            "degraded": True,
        }

    await check_rate_limit(user_id, "war_room_ask", sb)

    if _is_crm_note_audit_query(sanitised.get("text") or payload.question):
        explainability = _derive_explainability(
            sb,
            user_id,
            primary_domain="crm",
            primary_detail="Current War Room context does not include contact note-history timelines from HubSpot.",
        )
        return {
            "answer": "I can’t verify the last note added to a HubSpot contact from the current War Room dataset. This console is grounded in strategic CRM telemetry like deals, pipeline, and response pressure — not contact-level note timelines yet.",
            "why_visible": explainability["why_visible"],
            "why_now": "You are asking for object-level CRM audit detail, but the active War Room scope is strategic rather than contact-timeline level.",
            "next_action": "Open the contact timeline in HubSpot for note history, or extend BIQc CRM ingestion to bring contact-note activities into the platform.",
            "if_ignored": "You may make decisions using incomplete customer activity history.",
            "evidence_chain": explainability["evidence_chain"],
            "degraded": False,
        }

    auth_header = request.headers.get("authorization")
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_anon_key = os.environ.get("SUPABASE_ANON_KEY")
    if not auth_header or not supabase_url or not supabase_anon_key:
        raise HTTPException(status_code=500, detail="War Room AI not configured")

    edge_url = f"{supabase_url}/functions/v1/strategic-console-ai"
    headers = {
        "Authorization": auth_header,
        "apikey": supabase_anon_key,
        "Content-Type": "application/json",
    }

    product_or_service = payload.product_or_service or "General business advisory"
    strategic_context = {}
    try:
        profile_row = sb.table("business_profiles").select("product_or_service, industry, value_proposition").eq("user_id", user_id).maybe_single().execute().data or {}
        candidate = profile_row.get("product_or_service") or profile_row.get("value_proposition") or profile_row.get("industry")
        if candidate:
            product_or_service = str(candidate)[:200]
        strategic_context["profile"] = {
            "industry": profile_row.get("industry"),
            "value_proposition": profile_row.get("value_proposition"),
        }
    except Exception:
        pass

    try:
        snapshot = sb.rpc('ic_generate_cognition_contract', {'p_tenant_id': user_id, 'p_tab': 'overview'}).execute().data or {}
        top_alerts = (snapshot.get('top_alerts') or [])[:2]
        strategic_context["snapshot"] = {
            "system_state": snapshot.get('system_state'),
            "executive_memo": snapshot.get('executive_memo'),
            "top_alerts": [{
                "domain": item.get('domain'),
                "detail": item.get('detail'),
                "action": item.get('action'),
            } for item in top_alerts if isinstance(item, dict)],
        }
    except Exception:
        strategic_context["snapshot"] = {}

    try:
        response = await _post_with_retries(
            edge_url,
            headers=headers,
            payload={
                "question": sanitised.get("text") or payload.question,
                "mode": "ask",
                "product_or_service": product_or_service,
                "strategic_context": strategic_context,
            },
            timeout_seconds=60,
            retries=2,
        )
    except httpx.HTTPError as error:
        logger.error(f"[war-room/respond] Edge function request failed: {error}")
        explainability = _derive_explainability(
            sb,
            user_id,
            primary_domain="war-room",
            primary_detail="War Room response service unavailable",
        )
        return {
            "answer": "War Room is temporarily operating in resilience mode. Focus on your highest-impact risk, assign one owner, and execute a 48-hour containment action.",
            "why_visible": explainability["why_visible"],
            "why_now": explainability["why_now"],
            "next_action": explainability["next_action"],
            "if_ignored": explainability["if_ignored"],
            "evidence_chain": explainability["evidence_chain"],
            "degraded": True,
        }

    if response.status_code >= 400:
        if response.status_code >= 500:
            explainability = _derive_explainability(
                sb,
                user_id,
                primary_domain="war-room",
                primary_detail="War Room service degraded",
            )
            return {
                "answer": "War Room is in degraded mode due to an upstream service issue. Use a focused owner/action checkpoint until normal response quality is restored.",
                "why_visible": explainability["why_visible"],
                "why_now": explainability["why_now"],
                "next_action": explainability["next_action"],
                "if_ignored": explainability["if_ignored"],
                "evidence_chain": explainability["evidence_chain"],
                "degraded": True,
            }
        raise HTTPException(status_code=response.status_code, detail=response.text[:500])
    data = response.json()
    if isinstance(data, dict):
        if data.get("answer"):
            data["answer"] = sanitise_output(data["answer"])
        elif data.get("response"):
            data["answer"] = sanitise_output(str(data.get("response")))
        else:
            analysis_text = _normalise_war_room_analysis_text(data)
            if analysis_text:
                sanitised_analysis_text = sanitise_output(analysis_text)
                data["answer"] = sanitised_analysis_text
                data.setdefault("response", sanitised_analysis_text)

        explainability = _derive_explainability(
            sb,
            user_id,
            primary_domain="war-room",
            primary_detail=(data.get("answer") or data.get("response") or ((data.get("analysis") or {}).get("analysis_title") if isinstance(data.get("analysis"), dict) else "") or "")[:200],
        )
        data.setdefault("why_visible", explainability["why_visible"])
        data.setdefault("why_now", explainability["why_now"])
        data.setdefault("next_action", explainability["next_action"])
        data.setdefault("if_ignored", explainability["if_ignored"])
        data.setdefault("evidence_chain", explainability["evidence_chain"])
    return data


@router.post("/boardroom/escalation-action")
async def boardroom_escalation_action(request: Request, payload: EscalationActionRequest):
    try:
        current_user = await get_current_user_from_request(request)
        user_id = current_user.get("id")
    except Exception:
        raise HTTPException(status_code=401, detail="Not authenticated")

    if payload.action not in ("acknowledged", "deferred"):
        raise HTTPException(status_code=400, detail="Action must be 'acknowledged' or 'deferred'")

    try:
        from escalation_memory import get_escalation_memory
        await get_escalation_memory().record_user_action(user_id, payload.domain, payload.action)
        return {"success": True, "domain": payload.domain, "action": payload.action}
    except RuntimeError:
        raise HTTPException(status_code=500, detail="Escalation memory not available")


from backend import boardroom_conversations as brc
from fastapi.responses import StreamingResponse
from datetime import datetime
import json


class CreateConversationRequest(BaseModel):
    mode: str
    focus_area: Optional[str] = None
    title: Optional[str] = None


class AppendMessageRequest(BaseModel):
    role: str
    content: str
    focus_area: Optional[str] = None
    explainability: Optional[Dict[str, object]] = None
    evidence_chain: Optional[List[Dict[str, object]]] = None
    priority_compression: Optional[Dict[str, object]] = None
    lineage: Optional[Dict[str, object]] = None
    confidence_score: Optional[float] = None
    degraded: Optional[bool] = False
    source_response: Optional[Dict[str, object]] = None


class UpdateConversationRequest(BaseModel):
    title: Optional[str] = None
    status: Optional[str] = None
    metadata: Optional[Dict[str, object]] = None


@router.post("/boardroom/conversations")
async def create_boardroom_conversation(
    payload: CreateConversationRequest,
    current_user: dict = Depends(get_current_user_from_request),
):
    if not current_user or not current_user.get("id"):
        raise HTTPException(status_code=401, detail="Authentication required")
    if payload.mode not in ("boardroom", "war_room"):
        raise HTTPException(status_code=400, detail="mode must be 'boardroom' or 'war_room'")
    sb = get_sb()
    try:
        conv = brc.create_conversation(
            sb,
            current_user["id"],
            payload.mode,
            payload.focus_area,
            payload.title,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not conv:
        raise HTTPException(status_code=500, detail="Failed to create conversation")
    return conv


@router.get("/boardroom/conversations")
async def list_boardroom_conversations(
    mode: str = "boardroom",
    limit: int = 50,
    status: str = "active",
    current_user: dict = Depends(get_current_user_from_request),
):
    if not current_user or not current_user.get("id"):
        raise HTTPException(status_code=401, detail="Authentication required")
    if mode not in ("boardroom", "war_room"):
        raise HTTPException(status_code=400, detail="Invalid mode")
    if status not in ("active", "archived"):
        raise HTTPException(status_code=400, detail="Invalid status")
    sb = get_sb()
    conversations = brc.list_conversations(sb, current_user["id"], mode, limit, status)
    return {"conversations": conversations}


@router.get("/boardroom/conversations/{conv_id}")
async def get_boardroom_conversation(
    conv_id: str,
    current_user: dict = Depends(get_current_user_from_request),
):
    if not current_user or not current_user.get("id"):
        raise HTTPException(status_code=401, detail="Authentication required")
    sb = get_sb()
    conv = brc.get_conversation(sb, current_user["id"], conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    messages = brc.get_messages(sb, conv_id)
    return {"conversation": conv, "messages": messages}


@router.post("/boardroom/conversations/{conv_id}/messages")
async def append_boardroom_message(
    conv_id: str,
    payload: AppendMessageRequest,
    current_user: dict = Depends(get_current_user_from_request),
):
    if not current_user or not current_user.get("id"):
        raise HTTPException(status_code=401, detail="Authentication required")
    sb = get_sb()
    conv = brc.get_conversation(sb, current_user["id"], conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    try:
        msg = brc.append_message(
            sb, conv_id, current_user["id"], payload.role, payload.content,
            focus_area=payload.focus_area, explainability=payload.explainability,
            evidence_chain=payload.evidence_chain, priority_compression=payload.priority_compression,
            lineage=payload.lineage, confidence_score=payload.confidence_score,
            degraded=payload.degraded or False, source_response=payload.source_response,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not msg:
        raise HTTPException(status_code=500, detail="Failed to append message")
    return msg


@router.patch("/boardroom/conversations/{conv_id}")
async def update_boardroom_conversation(
    conv_id: str,
    payload: UpdateConversationRequest,
    current_user: dict = Depends(get_current_user_from_request),
):
    if not current_user or not current_user.get("id"):
        raise HTTPException(status_code=401, detail="Authentication required")
    sb = get_sb()
    updates = payload.dict(exclude_unset=True)
    try:
        conv = brc.update_conversation(sb, current_user["id"], conv_id, updates)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv


async def _sse_event(event_type: str, data: Dict[str, object]) -> str:
    payload = {"type": event_type, **data}
    return f"data: {json.dumps(payload)}\n\n"


@router.post("/boardroom/diagnosis/stream")
async def stream_boardroom_diagnosis(
    payload: BoardRoomDiagnosisRequest,
    current_user: dict = Depends(get_current_user_from_request),
):
    if not current_user or not current_user.get("id"):
        raise HTTPException(status_code=401, detail="Authentication required")
    if payload.focus_area not in DIAGNOSIS_FOCUS_AREAS:
        raise HTTPException(status_code=400, detail="Invalid focus_area")
    user_id = current_user["id"]
    sb = get_sb()
    check_rate_limit(user_id, "boardroom_diagnosis", sb)

    async def generate():
        yield await _sse_event("start", {
            "focus_area": payload.focus_area,
            "timestamp": datetime.utcnow().isoformat(),
        })
        try:
            truth_guard = _build_cross_integration_truth_guard(sb, user_id)
            if truth_guard:
                yield await _sse_event("truth_gate", {
                    "message": str(truth_guard),
                    "degraded": True,
                })
            supabase_url = os.getenv("SUPABASE_URL")
            service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
            if not supabase_url or not service_key:
                yield await _sse_event("error", {"message": "Supabase configuration missing", "degraded": True})
                return
            async with httpx.AsyncClient(timeout=90) as client:
                response = await client.post(
                    f"{supabase_url}/functions/v1/boardroom-diagnosis",
                    headers={"Authorization": f"Bearer {service_key}", "Content-Type": "application/json"},
                    json={"focus_area": payload.focus_area, "user_id": user_id},
                )
            if response.status_code >= 400:
                yield await _sse_event("error", {
                    "message": f"Diagnosis service returned {response.status_code}",
                    "degraded": True,
                })
                return
            data = response.json()
            narrative = data.get("narrative") or data.get("answer") or ""
            if not narrative:
                yield await _sse_event("error", {"message": "Empty diagnosis narrative", "degraded": True})
                return
            chunk_size = 40
            for i in range(0, len(narrative), chunk_size):
                chunk = narrative[i:i + chunk_size]
                yield await _sse_event("delta", {"text": chunk})
                await asyncio.sleep(0.025)
            yield await _sse_event("complete", {
                "headline": data.get("headline"),
                "what_to_watch": data.get("what_to_watch"),
                "if_ignored": data.get("if_ignored"),
                "confidence": data.get("confidence"),
                "confidence_score": data.get("confidence_score"),
                "evidence_chain": data.get("evidence_chain", []),
                "lineage": data.get("lineage", {}),
                "data_sources_used": data.get("data_sources_used", []),
                "explainability": {
                    "why_visible": data.get("why_visible"),
                    "why_now": data.get("why_now"),
                    "next_action": data.get("next_action"),
                    "if_ignored": data.get("if_ignored"),
                },
            })
        except httpx.HTTPError as e:
            yield await _sse_event("error", {"message": f"Network error: {str(e)}", "degraded": True})
        except Exception as e:
            logger.exception("Boardroom diagnosis stream error")
            yield await _sse_event("error", {"message": str(e), "degraded": True})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/war-room/respond/stream")
async def stream_war_room_respond(
    payload: WarRoomAskRequest,
    current_user: dict = Depends(get_current_user_from_request),
):
    if not current_user or not current_user.get("id"):
        raise HTTPException(status_code=401, detail="Authentication required")
    if not payload.question or not payload.question.strip():
        raise HTTPException(status_code=400, detail="question is required")
    user_id = current_user["id"]
    sb = get_sb()
    question = sanitise_input(payload.question).get("text", payload.question)
    check_rate_limit(user_id, "war_room_ask", sb)

    async def generate():
        yield await _sse_event("start", {
            "question_preview": question[:100],
            "timestamp": datetime.utcnow().isoformat(),
        })
        try:
            truth_guard = _build_cross_integration_truth_guard(sb, user_id)
            if truth_guard:
                yield await _sse_event("truth_gate", {
                    "message": str(truth_guard),
                    "degraded": True,
                })
            supabase_url = os.getenv("SUPABASE_URL")
            service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
            if not supabase_url or not service_key:
                yield await _sse_event("error", {"message": "Supabase configuration missing", "degraded": True})
                return
            product_or_service = payload.product_or_service or "General business advisory"
            async with httpx.AsyncClient(timeout=90) as client:
                response = await client.post(
                    f"{supabase_url}/functions/v1/strategic-console-ai",
                    headers={"Authorization": f"Bearer {service_key}", "Content-Type": "application/json"},
                    json={"question": question, "mode": "ask", "product_or_service": product_or_service, "user_id": user_id},
                )
            if response.status_code >= 400:
                yield await _sse_event("error", {
                    "message": f"War room service returned {response.status_code}",
                    "degraded": True,
                })
                return
            data = response.json()
            answer = (
                data.get("answer")
                or data.get("response")
                or _normalise_war_room_analysis_text(data)
            )
            if not answer:
                yield await _sse_event("error", {"message": "Empty war room response", "degraded": True})
                return
            chunk_size = 40
            for i in range(0, len(answer), chunk_size):
                chunk = answer[i:i + chunk_size]
                yield await _sse_event("delta", {"text": chunk})
                await asyncio.sleep(0.025)
            yield await _sse_event("complete", {
                "explainability": {
                    "why_visible": data.get("why_visible"),
                    "why_now": data.get("why_now"),
                    "next_action": data.get("next_action"),
                    "if_ignored": data.get("if_ignored"),
                },
                "evidence_chain": data.get("evidence_chain", []),
                "lineage": data.get("lineage", {}),
                "data_freshness": data.get("data_freshness"),
                "confidence_score": data.get("confidence_score"),
                "data_sources": data.get("data_sources", []),
            })
        except httpx.HTTPError as e:
            yield await _sse_event("error", {"message": f"Network error: {str(e)}", "degraded": True})
        except Exception as e:
            logger.exception("War room stream error")
            yield await _sse_event("error", {"message": str(e), "degraded": True})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
