"""Board Room routes — extracted from server.py. Zero logic changes."""
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Dict, List, Optional
from emergentintegrations.llm.chat import LlmChat, UserMessage
from routes.deps import get_current_user_from_request, get_sb, OPENAI_KEY, logger
import os

router = APIRouter()


class BoardRoomRequest(BaseModel):
    message: str
    history: Optional[List[Dict[str, str]]] = []


class EscalationActionRequest(BaseModel):
    domain: str
    action: str  # acknowledged | deferred


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

    message = payload.message.strip()
    history = payload.history or []
    if not message:
        raise HTTPException(status_code=400, detail="Message required")

    sb = get_sb()
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

        system_prompt = build_boardroom_prompt(
            watchtower_positions=positions, watchtower_findings=findings,
            intelligence_config=intel_config, calibration=calibration,
            escalation_history=escalation_history, contradictions=contradictions,
            pressure=pressure, freshness=freshness,
        )
        if facts_prompt:
            system_prompt += f"\n\nRESOLVED BUSINESS FACTS:\n{facts_prompt}\n"

        api_key = OPENAI_KEY or os.environ.get('OPENAI_API_KEY')
        chat = LlmChat(api_key=api_key, session_id=f"boardroom_{user_id}", system_message=system_prompt)
        chat.with_model("openai", "gpt-4o")

        context_block = ""
        if history:
            context_block = "PRIOR EXCHANGE:\n"
            for h in history:
                label = "OPERATOR" if h.get("role", "user") == "user" else "BOARD ROOM"
                context_block += f"[{label}]: {h.get('content', '')}\n"
            context_block += "\n---\n"

        raw_response = await chat.send_message(UserMessage(text=f"{context_block}OPERATOR INPUT: {message}"))

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

        return {"response": raw_response.strip(), "escalations": active_escalations}

    except Exception as e:
        logger.error(f"[boardroom] Error: {e}")
        return {"response": "Intelligence link disrupted. Retry.", "escalations": []}


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
