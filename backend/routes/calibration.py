"""
Calibration Routes — Status, defer, reset, init, answer, activation, brain,
lifecycle, console, enrichment, regeneration.
Extracted from server.py. Prompts loaded from Supabase system_prompts table.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
import uuid
import re
import json
import logging

import httpx
from emergentintegrations.llm.chat import LlmChat, UserMessage
from routes.deps import (
    get_current_user, get_current_user_from_request,
    get_sb, OPENAI_KEY, AI_MODEL, logger, cognitive_core,
)
from supabase_client import safe_query_single
from prompt_registry import get_prompt
from auth_supabase import get_user_by_id, get_current_user_supabase
from supabase_intelligence_helpers import get_business_profile_supabase
from regeneration_governance import request_regeneration, record_regeneration_response
from fact_resolution import resolve_facts, build_known_facts_prompt

router = APIRouter()


# ─── Models ───

class CalibrationAnswerRequest(BaseModel):
    question_id: int
    answer: str

class CalibrationBrainRequest(BaseModel):
    message: str
    history: Optional[List[Dict[str, str]]] = []

class RegenerationRequestPayload(BaseModel):
    layer: Optional[str] = None
    reason: Optional[str] = None

class RegenerationResponsePayload(BaseModel):
    proposal_id: str
    action: str

class ConsoleStateSave(BaseModel):
    current_step: int
    status: str = "IN_PROGRESS"

class WebsiteEnrichRequest(BaseModel):
    url: str
    action: str = "scan"


# ─── Constants ───

QUESTIONS_TEXT = {
    1: "What's the name of the business you're operating, and what industry does it sit in?",
    2: "Where would you place the business today - idea, early-stage, established, or enterprise - and roughly how long has it been operating?",
    3: "Where is the business primarily based? City and state is fine.",
    4: "Who do you primarily sell to, and what problem are they hiring you to solve?",
    5: "What do you actually sell today - and why do clients choose you over alternatives?",
    6: "How big is the team today, and where do you personally spend most of your time?",
    7: "In plain terms - why does this business exist, and what would success look like in three years?",
    8: "What are the most important goals for the next 12 months - and what's getting in the way right now?",
    9: "How do you expect the business to grow - new markets, new offers, partnerships, or scale?",
}

_WATCHTOWER_BRAIN_FALLBACK = (
    "You are BIQc-02, the Senior Strategic Architect. "
    "Extract the 17-Point Strategic Map. JSON output only."
)


# ─── Helpers ───

def _parse_business_identity(answer: str) -> Dict[str, Optional[str]]:
    if "," in answer:
        name, industry = [p.strip() for p in answer.split(",", 1)]
        return {"business_name": name, "industry": industry}
    if " in " in answer.lower():
        name, industry = [p.strip() for p in re.split(r"\s+in\s+", answer, maxsplit=1, flags=re.IGNORECASE)]
        return {"business_name": name, "industry": industry}
    return {"business_name": answer.strip(), "industry": None}

def _parse_business_stage(answer: str) -> Dict[str, Optional[str]]:
    stage_match = re.search(r"(idea|early[-\s]?stage|established|enterprise)", answer, re.IGNORECASE)
    stage = stage_match.group(1).lower().replace(" ", "-") if stage_match else None
    years_match = re.search(r"(\d+(?:\.\d+)?)", answer)
    years = years_match.group(1) if years_match else None
    return {"business_stage": stage, "years_operating": years}

def _parse_location(answer: str) -> Dict[str, Optional[str]]:
    parts = [p.strip() for p in answer.split(",") if p.strip()]
    if len(parts) >= 3:
        return {"location_city": parts[0], "location_state": parts[1], "location_country": parts[2]}
    if len(parts) == 2:
        return {"location_city": parts[0], "location_state": parts[1], "location_country": None}
    return {"location_city": parts[0] if parts else None, "location_state": None, "location_country": None}

def _extract_team_size(answer: str) -> Optional[int]:
    match = re.search(r"(\d+)", answer)
    return int(match.group(1)) if match else None


# ═══════════════════════════════════════════════════════════════
# ROUTE HANDLERS (extracted from server.py lines 2503-3553)
# ═══════════════════════════════════════════════════════════════

@router.get("/calibration/status")
async def get_calibration_status(current_user: dict = Depends(get_current_user)):
    """
    Calibration status with granularity for the Executive Entry Protocol.
    Returns: status (COMPLETE | IN_PROGRESS | NEEDS_CALIBRATION), calibration_step, user_name.
    """
    user_id = current_user.get("id")

    try:
        op_result = safe_query_single(
            get_sb().table("user_operator_profile").select(
                "persona_calibration_status, operator_profile"
            ).eq("user_id", user_id)
        )

        # Get user name for personalized UI
        user_name = None
        try:
            user_row = await get_user_by_id(user_id)
            user_name = user_row.get("full_name") if user_row else None
        except Exception:
            pass

        if op_result.data:
            pcs = op_result.data.get("persona_calibration_status")
            op = op_result.data.get("operator_profile") or {}
            cal_step = op.get("calibration_step", 0)

            if pcs == "complete":
                return JSONResponse(status_code=200, content={
                    "status": "COMPLETE", "user_name": user_name
                })

            if pcs in ("in_progress", "recalibrating") or cal_step > 0:
                return JSONResponse(status_code=200, content={
                    "status": "IN_PROGRESS",
                    "calibration_step": cal_step,
                    "user_name": user_name,
                    "mode": "PARTIAL"
                })

        return JSONResponse(status_code=200, content={
            "status": "NEEDS_CALIBRATION",
            "calibration_step": 0,
            "user_name": user_name,
            "mode": "NEW"
        })

    except RuntimeError as e:
        logger.error(f"FATAL: Calibration status SDK error: {e}")
        raise HTTPException(status_code=500, detail="Internal SDK error — contact support")
    except Exception as e:
        logger.error(f"Calibration status error: {e}")
        raise HTTPException(status_code=500, detail="Calibration check failed")


@router.post("/calibration/defer")
async def defer_calibration(request: Request):
    """Set calibration as deferred. Writes to user_operator_profile (authoritative) and business_profiles."""
    try:
        current_user = await get_current_user_from_request(request)
        user_id = current_user.get("id")
    except Exception:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        now_iso = datetime.now(timezone.utc).isoformat()

        # PRIMARY: Write to user_operator_profile
        try:
            existing_op = get_sb().table("user_operator_profile").select("user_id").eq("user_id", user_id).maybe_single().execute()
            if existing_op.data:
                get_sb().table("user_operator_profile").update({
                    "persona_calibration_status": "deferred"
                }).eq("user_id", user_id).execute()
            else:
                get_sb().table("user_operator_profile").insert({
                    "user_id": user_id,
                    "persona_calibration_status": "deferred",
                    "operator_profile": {}
                }).execute()
        except Exception as op_err:
            logger.warning(f"[calibration/defer] user_operator_profile write failed: {op_err}")

        # SECONDARY: business_profiles for backward compat
        profile = await get_business_profile_supabase(get_sb(), user_id)
        if not profile:
            profile_data = {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "calibration_status": "deferred",
                "created_at": now_iso,
                "updated_at": now_iso
            }
            try:
                get_sb().table("business_profiles").insert(profile_data).execute()
            except Exception:
                profile_data.pop("calibration_status", None)
                get_sb().table("business_profiles").insert(profile_data).execute()
        else:
            try:
                get_sb().table("business_profiles").update({
                    "calibration_status": "deferred",
                    "updated_at": now_iso
                }).eq("id", profile.get("id")).execute()
            except Exception:
                pass
        return {"ok": True}
    except Exception as e:
        logger.error(f"[calibration/defer] Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to defer calibration")


@router.post("/calibration/reset")
async def reset_calibration(request: Request):
    """Reset calibration — archives current persona, sets status to 'recalibrating'."""
    try:
        current_user = await get_current_user_from_request(request)
        user_id = current_user.get("id")
    except Exception:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        now_iso = datetime.now(timezone.utc).isoformat()
        existing = get_sb().table("user_operator_profile").select("*").eq("user_id", user_id).maybe_single().execute()
        if existing.data:
            archived = {
                "agent_persona": existing.data.get("agent_persona"),
                "agent_instructions": existing.data.get("agent_instructions"),
                "archived_at": now_iso,
            }
            current_profile = existing.data.get("operator_profile") or {}
            archives = current_profile.get("persona_archives", [])
            archives.append(archived)
            current_profile["persona_archives"] = archives
            get_sb().table("user_operator_profile").update({
                "persona_calibration_status": "recalibrating",
                "operator_profile": current_profile,
            }).eq("user_id", user_id).execute()
        else:
            get_sb().table("user_operator_profile").insert({
                "user_id": user_id,
                "persona_calibration_status": "recalibrating",
                "operator_profile": {},
            }).execute()
        logger.info(f"[calibration/reset] Reset for {user_id}")
        return {"ok": True, "status": "recalibrating"}
    except Exception as e:
        logger.error(f"[calibration/reset] Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to reset calibration")


@router.get("/lifecycle/state")
async def get_lifecycle_state(request: Request):
    """Returns full lifecycle state for deterministic routing."""
    try:
        current_user = await get_current_user_from_request(request)
        user_id = current_user.get("id")
    except Exception:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        calibration_complete = False
        calibration_status = "incomplete"
        try:
            op_result = safe_query_single(
                get_sb().table("user_operator_profile").select(
                    "persona_calibration_status, operator_profile, agent_persona"
                ).eq("user_id", user_id)
            )
            if op_result.data:
                calibration_status = op_result.data.get("persona_calibration_status", "incomplete")
                calibration_complete = calibration_status == "complete"
        except Exception:
            pass

        onboarding_complete = False
        onboarding_step = 0
        try:
            op_result2 = safe_query_single(
                get_sb().table("user_operator_profile").select("operator_profile").eq("user_id", user_id)
            )
            if op_result2.data:
                ob_state = (op_result2.data.get("operator_profile") or {}).get("onboarding_state", {})
                onboarding_complete = ob_state.get("completed", False)
                onboarding_step = ob_state.get("current_step", 0)
        except Exception:
            pass

        integrations_connected = 0
        integration_names = []
        try:
            int_result = get_sb().table("integration_accounts").select("provider, category").eq("user_id", user_id).execute()
            if int_result.data:
                integrations_connected = len(int_result.data)
                integration_names = [r.get("provider", "") for r in int_result.data]
        except Exception:
            pass

        has_intelligence = False
        try:
            wi_result = get_sb().table("watchtower_insights").select("id").eq("user_id", user_id).limit(1).execute()
            has_intelligence = bool(wi_result.data)
        except Exception:
            pass

        domains_enabled = []
        workspace_id = None
        try:
            bp = await get_business_profile_supabase(get_sb(), user_id)
            if bp:
                ic = bp.get("intelligence_configuration", {}) or {}
                for d, cfg in (ic.get("domains", {}) or {}).items():
                    if cfg.get("enabled"):
                        domains_enabled.append(d)
        except Exception:
            pass

        try:
            from workspace_helpers import get_user_account
            account = await get_user_account(get_sb(), user_id)
            if account:
                workspace_id = account["id"]
        except Exception:
            pass

        return {
            "calibration": {"status": calibration_status, "complete": calibration_complete},
            "onboarding": {"complete": onboarding_complete, "step": onboarding_step},
            "integrations": {"count": integrations_connected, "providers": integration_names},
            "intelligence": {"has_events": has_intelligence, "domains_enabled": domains_enabled},
            "workspace_id": workspace_id,
        }
    except Exception as e:
        logger.error(f"[lifecycle/state] Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get lifecycle state")


class ConsoleStateSave(BaseModel):
    current_step: int
    status: str = "IN_PROGRESS"


@router.post("/console/state")
async def save_console_state(request: Request, payload: ConsoleStateSave):
    """Persist console step to user_operator_profile.operator_profile.console_state."""
    try:
        current_user = await get_current_user_from_request(request)
        user_id = current_user.get("id")
    except Exception:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        existing = get_sb().table("user_operator_profile").select("operator_profile").eq("user_id", user_id).maybe_single().execute()
        op = (existing.data.get("operator_profile") if existing.data else None) or {}
        op["console_state"] = {"current_step": payload.current_step, "status": payload.status, "updated_at": datetime.now(timezone.utc).isoformat()}
        if existing.data:
            get_sb().table("user_operator_profile").update({"operator_profile": op}).eq("user_id", user_id).execute()
        else:
            get_sb().table("user_operator_profile").insert({"user_id": user_id, "operator_profile": op}).execute()
        return {"ok": True}
    except Exception as e:
        logger.error(f"[console/state] Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to save console state")


class WebsiteEnrichRequest(BaseModel):
    url: str
    action: str = "scan"  # scan | commit


@router.post("/enrichment/website")
async def website_enrichment(request: Request, payload: WebsiteEnrichRequest):
    """Draft → Review → Commit enrichment flow."""
    try:
        current_user = await get_current_user_from_request(request)
        user_id = current_user.get("id")
    except Exception:
        raise HTTPException(status_code=401, detail="Not authenticated")

    url = payload.url.strip()
    if not url.startswith("http"):
        url = f"https://{url}"

    if payload.action == "scan":
        import re as _re
        try:
            async with httpx.AsyncClient(follow_redirects=True, timeout=15.0) as client:
                resp = await client.get(url, headers={"User-Agent": "BIQC/1.0"})
                html = resp.text[:50000]
            title = ""
            desc = ""
            og_title = ""
            og_desc = ""
            import re
            t = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
            if t:
                title = t.group(1).strip()
            for m in re.finditer(r'<meta\s+[^>]*>', html, re.IGNORECASE | re.DOTALL):
                tag = m.group(0)
                name = re.search(r'(?:name|property)\s*=\s*["\']([^"\']+)["\']', tag, re.IGNORECASE)
                content = re.search(r'content\s*=\s*["\']([^"\']+)["\']', tag, re.IGNORECASE)
                if name and content:
                    n = name.group(1).lower()
                    c = content.group(1).strip()
                    if n == "description":
                        desc = c
                    elif n == "og:title":
                        og_title = c
                    elif n == "og:description":
                        og_desc = c

            def sanitize(s):
                s = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', s)
                s = re.sub(r'\s+', ' ', s).strip()
                return s[:500]

            return {
                "status": "draft",
                "url": url,
                "enrichment": {
                    "title": sanitize(og_title or title),
                    "description": sanitize(og_desc or desc),
                },
                "message": "Review the enrichment data below. Click Commit to save to Business DNA.",
            }
        except Exception as e:
            logger.error(f"[enrichment/website] Scan failed: {e}")
            return {"status": "error", "message": f"Failed to scan: {str(e)[:100]}"}

    elif payload.action == "commit":
        try:
            profile = await get_business_profile_supabase(get_sb(), user_id)
            if not profile:
                raise HTTPException(status_code=404, detail="No business profile")
            get_sb().table("business_profiles").update({
                "website": url,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", profile["id"]).execute()
            return {"status": "committed", "message": "Website data saved to Business DNA."}
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[enrichment/website] Commit failed: {e}")
            raise HTTPException(status_code=500, detail="Commit failed")



def _split_two_parts(answer: str) -> List[str]:
    parts = re.split(r"\s+and\s+|\s+—\s+|\s+–\s+|\s+-\s+", answer, maxsplit=1)
    return [p.strip() for p in parts if p.strip()]


def _parse_business_identity(answer: str) -> Dict[str, Optional[str]]:
    if "," in answer:
        name, industry = [p.strip() for p in answer.split(",", 1)]
        return {"business_name": name, "industry": industry}
    if " in " in answer.lower():
        name, industry = [p.strip() for p in re.split(r"\s+in\s+", answer, maxsplit=1, flags=re.IGNORECASE)]
        return {"business_name": name, "industry": industry}
    return {"business_name": answer.strip(), "industry": None}


def _parse_business_stage(answer: str) -> Dict[str, Optional[str]]:
    stage_match = re.search(r"(idea|early[-\s]?stage|established|enterprise)", answer, re.IGNORECASE)
    stage = stage_match.group(1).lower().replace(" ", "-") if stage_match else None
    years_match = re.search(r"(\d+(?:\.\d+)?)", answer)
    years = years_match.group(1) if years_match else None
    return {"business_stage": stage, "years_operating": years}


def _parse_location(answer: str) -> Dict[str, Optional[str]]:
    parts = [p.strip() for p in answer.split(",") if p.strip()]
    if len(parts) >= 3:
        return {"location_city": parts[0], "location_state": parts[1], "location_country": parts[2]}
    if len(parts) == 2:
        return {"location_city": parts[0], "location_state": parts[1], "location_country": None}
    if len(parts) == 1:
        return {"location_city": parts[0], "location_state": None, "location_country": None}
    return {"location_city": None, "location_state": None, "location_country": None}


def _extract_team_size(answer: str) -> Optional[int]:
    match = re.search(r"(\d+)", answer)
    return int(match.group(1)) if match else None



@router.post("/calibration/init")
async def init_calibration_session(current_user: dict = Depends(get_current_user)):
    """
    Initialize calibration: ensure business_profile shell exists.
    Called when user clicks 'Begin Calibration' — BEFORE any answers.
    """
    user_id = current_user.get("id")
    try:
        profile = await get_business_profile_supabase(get_sb(), user_id)
        if not profile:
            profile_data = {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            try:
                result = get_sb().table("business_profiles").insert(profile_data).execute()
                profile = result.data[0] if result.data else profile_data
            except Exception:
                result = get_sb().table("business_profiles").insert(profile_data).execute()
                profile = result.data[0] if result.data else profile_data
            logger.info(f"[calibration/init] Created shell business_profile for {user_id}")
        else:
            logger.info(f"[calibration/init] Profile already exists for {user_id}")
        return {"status": "ready", "profile_id": profile.get("id")}
    except Exception as e:
        logger.error(f"[calibration/init] Error: {e}")
        return JSONResponse(status_code=200, content={"status": "ready", "profile_id": None})


@router.post("/calibration/answer")
async def save_calibration_answer(request: Request, payload: CalibrationAnswerRequest):
    """Save calibration answer."""
    try:
        current_user = await get_current_user_from_request(request)
        user_id = current_user.get("id")
    except Exception:
        raise HTTPException(status_code=401, detail="Not authenticated")
    answer = payload.answer.strip()
    question_id = payload.question_id

    if not answer:
        raise HTTPException(status_code=400, detail="Answer required")

    profile = await get_business_profile_supabase(get_sb(), user_id)

    user_profile = get_sb().table("users").select("id,email,account_id,full_name").eq("id", user_id).execute().data
    user_email = user_profile[0].get("email") if user_profile else None
    account_id = user_profile[0].get("account_id") if user_profile else None

    if not profile and question_id != 1:
        raise HTTPException(status_code=400, detail="Calibration must start with question 1")

    if question_id == 1:
        identity = _parse_business_identity(answer)
        biz_name = identity.get("business_name") or answer
        industry = identity.get("industry")  # may be None — that is fine

        if not profile:
            # Build insert payload — only include columns that have values
            profile_data = {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "business_name": biz_name,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            if industry:
                profile_data["industry"] = industry
            try:
                profile_data["calibration_status"] = "in_progress"
                result = get_sb().table("business_profiles").insert(profile_data).execute()
                profile = result.data[0] if result.data else profile_data
            except Exception as insert_err:
                logger.warning(f"[calibration/answer] Insert failed, retrying minimal: {insert_err}")
                profile_data.pop("calibration_status", None)
                profile_data.pop("industry", None)
                try:
                    result = get_sb().table("business_profiles").insert(profile_data).execute()
                    profile = result.data[0] if result.data else profile_data
                except Exception as retry_err:
                    logger.error(f"[calibration/answer] Q1 insert fully failed: {retry_err}")
                    return {"status": "saved", "calibration_complete": False}

            # Account creation — non-blocking
            try:
                if biz_name and user_email:
                    from workspace_helpers import get_or_create_user_account
                    account_id = await get_or_create_user_account(get_sb(), user_id, user_email, biz_name)
                    if account_id:
                        profile_data["account_id"] = account_id
                        get_sb().table("users").update({"account_id": account_id}).eq("id", user_id).execute()
            except Exception as acct_err:
                logger.warning(f"[calibration/answer] Account creation non-critical error: {acct_err}")
        else:
            # Profile exists — update with whatever we parsed
            update_fields = {
                "business_name": biz_name,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            if industry:
                update_fields["industry"] = industry
            try:
                update_fields["calibration_status"] = "in_progress"
                get_sb().table("business_profiles").update(update_fields).eq("id", profile.get("id")).execute()
            except Exception as update_err:
                logger.warning(f"[calibration/answer] Update failed, retrying minimal: {update_err}")
                update_fields.pop("calibration_status", None)
                update_fields.pop("industry", None)
                try:
                    get_sb().table("business_profiles").update(update_fields).eq("id", profile.get("id")).execute()
                except Exception as retry_err:
                    logger.error(f"[calibration/answer] Q1 update fully failed: {retry_err}")

            # Account creation — non-blocking
            try:
                if not profile.get("account_id") and biz_name and user_email:
                    from workspace_helpers import get_or_create_user_account
                    account_id = await get_or_create_user_account(get_sb(), user_id, user_email, biz_name)
                    if account_id:
                        get_sb().table("business_profiles").update({"account_id": account_id}).eq("id", profile.get("id")).execute()
                        get_sb().table("users").update({"account_id": account_id}).eq("id", user_id).execute()
            except Exception as acct_err:
                logger.warning(f"[calibration/answer] Account update non-critical error: {acct_err}")

    if not profile:
        raise HTTPException(status_code=500, detail="Business profile unavailable")

    business_profile_id = profile.get("id")

    # ── Q2–Q6: Structured extraction (all fail-soft) ──
    if question_id == 2:
        try:
            stage_data = _parse_business_stage(answer)
            update = {"updated_at": datetime.now(timezone.utc).isoformat()}
            if stage_data.get("business_stage"):
                update["business_stage"] = stage_data["business_stage"]
            if stage_data.get("years_operating"):
                update["years_operating"] = stage_data["years_operating"]
            try:
                update["calibration_status"] = "in_progress"
                get_sb().table("business_profiles").update(update).eq("id", business_profile_id).execute()
            except Exception:
                update.pop("calibration_status", None)
                try:
                    get_sb().table("business_profiles").update(update).eq("id", business_profile_id).execute()
                except Exception as e:
                    logger.warning(f"[calibration/answer] Q2 write failed: {e}")
        except Exception as e:
            logger.warning(f"[calibration/answer] Q2 parse/write failed: {e}")

    if question_id == 3:
        try:
            location_data = _parse_location(answer)
            update = {**location_data, "updated_at": datetime.now(timezone.utc).isoformat()}
            try:
                update["calibration_status"] = "in_progress"
                get_sb().table("business_profiles").update(update).eq("id", business_profile_id).execute()
            except Exception:
                update.pop("calibration_status", None)
                try:
                    get_sb().table("business_profiles").update(update).eq("id", business_profile_id).execute()
                except Exception as e:
                    logger.warning(f"[calibration/answer] Q3 write failed: {e}")
        except Exception as e:
            logger.warning(f"[calibration/answer] Q3 parse/write failed: {e}")

    if question_id == 4:
        try:
            parts = _split_two_parts(answer)
            market = parts[0] if parts else answer
            pain = parts[1] if len(parts) > 1 else answer
            update = {"target_market": market, "customer_pain_points": pain, "updated_at": datetime.now(timezone.utc).isoformat()}
            try:
                update["ideal_customer_profile"] = market
                update["calibration_status"] = "in_progress"
                get_sb().table("business_profiles").update(update).eq("id", business_profile_id).execute()
            except Exception:
                try:
                    get_sb().table("business_profiles").update({"target_market": market, "updated_at": datetime.now(timezone.utc).isoformat()}).eq("id", business_profile_id).execute()
                except Exception as e:
                    logger.warning(f"[calibration/answer] Q4 write failed: {e}")
        except Exception as e:
            logger.warning(f"[calibration/answer] Q4 parse/write failed: {e}")

    if question_id == 5:
        try:
            parts = _split_two_parts(answer)
            products = parts[0] if parts else answer
            differentiation = parts[1] if len(parts) > 1 else answer
            update = {"products_services": products, "updated_at": datetime.now(timezone.utc).isoformat()}
            try:
                update["unique_value_proposition"] = differentiation
                update["competitive_advantages"] = differentiation
                update["calibration_status"] = "in_progress"
                get_sb().table("business_profiles").update(update).eq("id", business_profile_id).execute()
            except Exception:
                try:
                    get_sb().table("business_profiles").update({"products_services": products, "updated_at": datetime.now(timezone.utc).isoformat()}).eq("id", business_profile_id).execute()
                except Exception as e:
                    logger.warning(f"[calibration/answer] Q5 write failed: {e}")
        except Exception as e:
            logger.warning(f"[calibration/answer] Q5 parse/write failed: {e}")

    if question_id == 6:
        try:
            team_size = _extract_team_size(answer)
            update = {"founder_background": answer, "updated_at": datetime.now(timezone.utc).isoformat()}
            if team_size:
                update["team_size"] = team_size
            try:
                update["calibration_status"] = "in_progress"
                get_sb().table("business_profiles").update(update).eq("id", business_profile_id).execute()
            except Exception:
                update.pop("calibration_status", None)
                update.pop("team_size", None)
                try:
                    get_sb().table("business_profiles").update(update).eq("id", business_profile_id).execute()
                except Exception as e:
                    logger.warning(f"[calibration/answer] Q6 write failed: {e}")
        except Exception as e:
            logger.warning(f"[calibration/answer] Q6 parse/write failed: {e}")

    # ── Q7–Q9: Strategy profiles (all fail-soft) ──
    if question_id in {7, 8, 9}:
      try:
        strategy = get_sb().table("strategy_profiles").select("*").eq("business_profile_id", business_profile_id).execute().data
        strategy_profile = strategy[0] if strategy else None
        
        if not account_id and profile.get("account_id"):
            account_id = profile.get("account_id")

        if not strategy_profile:
            strategy_profile = {
                "id": str(uuid.uuid4()),
                "business_profile_id": business_profile_id,
                "user_id": user_id,
                "account_id": account_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            get_sb().table("strategy_profiles").insert(strategy_profile).execute()

        updates = {"updated_at": datetime.now(timezone.utc).isoformat(), "source": "user", "regenerable": True}
        if question_id == 7:
            parts = _split_two_parts(answer)
            mission = parts[0] if parts else answer
            vision = parts[1] if len(parts) > 1 else answer
            if not strategy_profile.get("raw_mission_input"):
                updates["raw_mission_input"] = mission
            if not strategy_profile.get("raw_vision_input"):
                updates["raw_vision_input"] = vision

        if question_id == 8:
            parts = _split_two_parts(answer)
            goals = parts[0] if parts else answer
            challenges = parts[1] if len(parts) > 1 else answer
            if not strategy_profile.get("raw_goals_input"):
                updates["raw_goals_input"] = goals
            if not strategy_profile.get("raw_challenges_input"):
                updates["raw_challenges_input"] = challenges

        if question_id == 9:
            if not strategy_profile.get("raw_growth_input"):
                updates["raw_growth_input"] = answer

        get_sb().table("strategy_profiles").update(updates).eq("id", strategy_profile.get("id")).execute()

        if question_id == 9:
          try:
            strategy_profile = get_sb().table("strategy_profiles").select("*").eq("business_profile_id", business_profile_id).execute().data
            strategy_profile = strategy_profile[0] if strategy_profile else {}
            raw_prompt = (
                "Generate JSON with keys: mission_statement, vision_statement, short_term_goals, long_term_goals, "
                "primary_challenges, growth_strategy. Keep outputs specific and grounded. Return ONLY JSON.\n\n"
                f"Mission raw: {strategy_profile.get('raw_mission_input')}\n"
                f"Vision raw: {strategy_profile.get('raw_vision_input')}\n"
                f"Goals raw: {strategy_profile.get('raw_goals_input')}\n"
                f"Challenges raw: {strategy_profile.get('raw_challenges_input')}\n"
                f"Growth raw: {strategy_profile.get('raw_growth_input')}\n"
            )

            from server import get_ai_response
            ai_text = await get_ai_response(raw_prompt, "general", f"calibration_{user_id}", user_id=user_id)
            ai_payload = {}
            try:
                ai_payload = json.loads(ai_text)
            except Exception:
                ai_payload = {
                    "mission_statement": strategy_profile.get("raw_mission_input"),
                    "vision_statement": strategy_profile.get("raw_vision_input"),
                    "short_term_goals": strategy_profile.get("raw_goals_input"),
                    "long_term_goals": strategy_profile.get("raw_goals_input"),
                    "primary_challenges": strategy_profile.get("raw_challenges_input"),
                    "growth_strategy": strategy_profile.get("raw_growth_input")
                }

            try:
                get_sb().table("strategy_profiles").update({
                    **ai_payload,
                    "source": "ai_generated",
                    "regenerable": True,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }).eq("id", strategy_profile.get("id")).execute()
            except Exception as sp_err:
                logger.warning(f"[calibration/answer] Q9 strategy_profiles AI update failed: {sp_err}")
          except Exception as q9_ai_err:
            logger.warning(f"[calibration/answer] Q9 AI generation failed: {q9_ai_err}")

          # Completion scaffolding — each part fail-soft
          if not account_id and profile.get("account_id"):
              account_id = profile.get("account_id")

          try:
            schedule_focus = [
                "Business foundation & positioning",
                "Offer clarity & pricing",
                "Pipeline build & outbound",
                "Inbound demand & content",
                "Sales conversion system",
                "Delivery quality & client success",
                "Retention & expansion",
                "Operations efficiency",
                "Team capacity & delegation",
                "Metrics & financial visibility",
                "Partnerships & channel growth",
                "Offer evolution",
                "Market expansion tests",
                "Scale systems & hiring",
                "Strategic review & next 15-week plan"
            ]

            today = datetime.now(timezone.utc).date()
            for week in range(1, 16):
                start_date = today + timedelta(days=(week - 1) * 7)
                end_date = start_date + timedelta(days=6)
                get_sb().table("working_schedules").upsert({
                    "business_profile_id": business_profile_id,
                    "user_id": user_id,
                    "account_id": account_id,
                    "week_number": week,
                    "focus_area": schedule_focus[week - 1],
                    "status": "in_progress" if week == 1 else "planned",
                    "week_start_date": start_date.isoformat(),
                    "week_end_date": end_date.isoformat()
                }, on_conflict="business_profile_id,week_number").execute()
          except Exception as sched_err:
            logger.warning(f"[calibration/answer] Q9 schedule creation failed: {sched_err}")

          try:
            default_priorities = [
                {"signal_category": "revenue_sales", "priority_rank": 1, "threshold_sensitivity": "high", "description": "Revenue and sales movement"},
                {"signal_category": "team_capacity", "priority_rank": 2, "threshold_sensitivity": "medium", "description": "Leader and team capacity"},
                {"signal_category": "strategy_drift", "priority_rank": 3, "threshold_sensitivity": "medium", "description": "Plan alignment"},
                {"signal_category": "delivery_ops", "priority_rank": 4, "threshold_sensitivity": "low", "description": "Delivery and operations"}
            ]

            for priority in default_priorities:
                get_sb().table("intelligence_priorities").upsert({
                    "business_profile_id": business_profile_id,
                    "user_id": user_id,
                    **priority
                }, on_conflict="business_profile_id,signal_category").execute()
          except Exception as prio_err:
            logger.warning(f"[calibration/answer] Q9 priorities creation failed: {prio_err}")

          try:
            get_sb().table("progress_cadence").upsert({
                "business_profile_id": business_profile_id,
                "user_id": user_id,
                "account_id": account_id,
                "cadence_type": "weekly",
                "next_check_in_date": (today + timedelta(days=7)).isoformat()
            }, on_conflict="business_profile_id").execute()
          except Exception as cad_err:
            logger.warning(f"[calibration/answer] Q9 cadence creation failed: {cad_err}")

          try:
            get_sb().table("calibration_sessions").insert({
                "business_profile_id": business_profile_id,
                "user_id": user_id,
                "questions_answered": 9,
                "completed": True,
                "completed_at": datetime.now(timezone.utc).isoformat()
            }).execute()
          except Exception as sess_err:
            logger.warning(f"[calibration/answer] Q9 session insert failed: {sess_err}")

          now_iso = datetime.now(timezone.utc).isoformat()

          # PRIMARY: Write to user_operator_profile (authoritative)
          try:
            existing_op = get_sb().table("user_operator_profile").select("user_id").eq("user_id", user_id).maybe_single().execute()
            if existing_op.data:
                get_sb().table("user_operator_profile").update({
                    "persona_calibration_status": "complete",
                    "calibration_completed_at": now_iso
                }).eq("user_id", user_id).execute()
            else:
                get_sb().table("user_operator_profile").insert({
                    "user_id": user_id,
                    "persona_calibration_status": "complete",
                    "calibration_completed_at": now_iso,
                    "operator_profile": {}
                }).execute()
            logger.info(f"[calibration/answer] user_operator_profile.persona_calibration_status = complete for {user_id}")
          except Exception as op_err:
            logger.error(f"[calibration/answer] user_operator_profile write failed: {op_err}")

          # SECONDARY: Also update business_profiles for backward compat
          try:
            get_sb().table("business_profiles").update({
                "calibration_status": "complete",
                "updated_at": now_iso,
                "account_id": account_id
            }).eq("id", business_profile_id).execute()
          except Exception as comp_err:
            logger.warning(f"[calibration/answer] Q9 calibration_status=complete failed: {comp_err}")

          return {"status": "complete", "calibration_complete": True}

      except Exception as strategy_err:
        logger.warning(f"[calibration/answer] Q{question_id} strategy block failed: {strategy_err}")
        # Still mark complete even if strategy scaffolding failed
        if question_id == 9:
          now_iso_fallback = datetime.now(timezone.utc).isoformat()
          # PRIMARY: user_operator_profile
          try:
            existing_op2 = get_sb().table("user_operator_profile").select("user_id").eq("user_id", user_id).maybe_single().execute()
            if existing_op2.data:
                get_sb().table("user_operator_profile").update({
                    "persona_calibration_status": "complete",
                    "calibration_completed_at": now_iso_fallback
                }).eq("user_id", user_id).execute()
            else:
                get_sb().table("user_operator_profile").insert({
                    "user_id": user_id,
                    "persona_calibration_status": "complete",
                    "calibration_completed_at": now_iso_fallback,
                    "operator_profile": {}
                }).execute()
          except Exception:
            pass
          # SECONDARY: business_profiles
          try:
            get_sb().table("business_profiles").update({
                "calibration_status": "complete",
                "updated_at": now_iso_fallback
            }).eq("id", business_profile_id).execute()
          except Exception:
            pass
          return {"status": "complete", "calibration_complete": True}

    # Generate Emergent Advisor calibration voice response
    advisor_response = None
    try:
        # Fetch from DB or use inline fallback
        cal_system_prompt = (
            'You are the "Emergent Advisor" (System Name: BIQc). '
            'Your status is: FAIL-SAFE | MASTER CONNECTED. '
            'You are a strategic, executive-level AI designed to "Calibrate" the user before granting them access to the "Watchtower."\n\n'
            'TONE & STYLE:\n'
            '- Concise, cryptic but helpful, high-tech, executive, encouraging.\n'
            '- Use terminology like "Syncing...", "Vector confirmed," "Strategic alignment."\n'
            '- Do not be chatty. Be precise.\n\n'
            'CRITICAL OUTPUT FORMAT:\n'
            'You must ONLY output valid JSON. Do not output markdown blocks or plain text outside the JSON.\n'
            'Structure: {"message": "Your text response to the user goes here.", "action": null}\n'
            '- Normal reply: {"message": "Input received. Clarify your project timeline.", "action": null}\n'
            '- Do NOT set action to "COMPLETE_REDIRECT" — the system handles completion separately.\n\n'
            'Rules:\n'
            '- Maximum 2-3 sentences in the message field.\n'
            '- Acknowledge the input, reflect strategic meaning, orient toward next calibration vector.\n'
            '- Do not repeat the user answer back verbatim.\n'
            '- Do not include the next question.\n'
        )
        cal_user_msg = (
            f"Question {question_id} of 9: \"{QUESTIONS_TEXT.get(question_id, '')}\"\n"
            f"User answered: \"{answer}\"\n\n"
            "Respond with JSON only."
        )
        from server import get_ai_response
        raw_ai = await get_ai_response(cal_user_msg, "general", f"calibration_{user_id}", user_id=user_id)
        if raw_ai:
            raw_ai = raw_ai.strip()
            # Strip markdown code fences if present
            if raw_ai.startswith("```"):
                raw_ai = raw_ai.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
            try:
                parsed = json.loads(raw_ai)
                advisor_response = parsed.get("message", raw_ai)
            except Exception:
                advisor_response = raw_ai.strip().strip('"')
    except Exception as ai_err:
        logger.warning(f"[calibration/answer] AI response generation failed: {ai_err}")

    return {"status": "saved", "calibration_complete": False, "advisor_response": advisor_response}


@router.get("/calibration/activation")
async def get_calibration_activation(request: Request):
    """Generate post-calibration advisor activation: focus statement, time horizon, engagement contract, integration framing, initial observation."""
    try:
        current_user = await get_current_user_from_request(request)
        user_id = current_user.get("id")
    except Exception:
        raise HTTPException(status_code=401, detail="Not authenticated")

    profile = await get_business_profile_supabase(get_sb(), user_id)
    if not profile:
        return {"focus": None, "time_horizon": None, "engagement": None, "integration_framing": None, "initial_observation": None}

    biz_name = profile.get("business_name", "your business")
    industry = profile.get("industry", "")
    stage = profile.get("business_stage", "")
    team = profile.get("team_size", "")

    context_summary = f"Business: {biz_name}. Industry: {industry or 'not specified'}. Stage: {stage or 'not specified'}. Team: {team or 'not specified'}."

    try:
        activation_prompt = (
            'You are the "Emergent Advisor" (System Name: BIQc). Status: FAIL-SAFE | MASTER CONNECTED. '
            'Calibration just completed. Generate a post-calibration activation briefing.\n\n'
            'Tone: Concise, cryptic but helpful, high-tech, executive. Use terminology like "Vectors locked", "Signal monitoring active."\n\n'
            'Generate a JSON object with exactly these keys. All values are strings:\n\n'
            '1) "focus": 3 bullet points (use • character) of strategic vectors you will monitor. '
            'Precise, no fluff. Start with "Vectors locked. Monitoring:"\n\n'
            '2) "time_horizon": One short paragraph. 7-day signal window, 30-day pattern emergence. Executive tone.\n\n'
            '3) "engagement": 1-2 sentences. The system surfaces what matters. User corrects trajectory as needed.\n\n'
            '4) "integration_framing": 2 sentences. Why email and calendar visibility matters for THIS business. Frame as signal access.\n\n'
            '5) "initial_observation": One provisional strategic observation. Mark as provisional. No actions.\n\n'
            f'Business context: {context_summary}\n\n'
            'Return ONLY valid JSON. No markdown. No explanation.'
        )
        from server import get_ai_response
        ai_text = await get_ai_response(activation_prompt, "general", f"activation_{user_id}", user_id=user_id)
        activation = json.loads(ai_text)
        return activation
    except Exception as e:
        logger.warning(f"[calibration/activation] AI generation failed: {e}")
        return {
            "focus": f"Based on what you've shared, I'll be watching:\n• financial stability and cashflow patterns\n• pressure on you as the primary operator\n• signals that it's time to systematise or delegate",
            "time_horizon": "In the next 7 days, I'll start noticing early signals. Over the next 30 days, patterns will become clearer as activity builds.",
            "engagement": "You don't need to ask me everything. I'll surface what matters when it matters — and you can correct me anytime.",
            "integration_framing": f"For {biz_name}, email and calendar help me spot early warning signs before they become problems. This isn't setup — it's giving me visibility.",
            "initial_observation": "Initial observation: Owner workload may become a constraint before revenue stabilises. I'll confirm or dismiss this once I see real activity."
        }




@router.post("/calibration/brain")
async def calibration_brain(payload: CalibrationBrainRequest, current_user: dict = Depends(get_current_user)):
    """
    Watchtower Brain — AI-driven 17-step strategic calibration.
    Replaces fixed question flow with intelligent interrogation.
    """
    user_id = current_user.get("id")

    message = payload.message.strip()
    history = payload.history or []

    if not message:
        raise HTTPException(status_code=400, detail="Message required")

    try:
        # Resolve known facts BEFORE AI call — Guard 1: no redundant questions
        from fact_resolution import resolve_facts, build_known_facts_prompt
        resolved_facts = await resolve_facts(get_sb(), user_id)
        facts_prompt = build_known_facts_prompt(resolved_facts)

        # Build messages array matching OpenAI format
        system_with_facts = await get_prompt("watchtower_brain_v1", _WATCHTOWER_BRAIN_FALLBACK)
        if facts_prompt:
            system_with_facts += f"\n\nKNOWN BUSINESS FACTS (DO NOT ask for these again):\n{facts_prompt}\nIf you need any of these facts, use the provided values. Do not re-ask.\n"

        chat = LlmChat(
            api_key=OPENAI_KEY,
            session_id=f"calibration_brain_{user_id}",
            system_message=system_with_facts
        )
        chat.with_model("openai", "gpt-4o")

        # Inject history as context in the user message
        context_block = ""
        if history:
            context_block = "CONVERSATION HISTORY:\n"
            for h in history:
                role = h.get("role", "user")
                content = h.get("content", "")
                context_block += f"[{role.upper()}]: {content}\n"
            context_block += "\n---\nNEW USER MESSAGE:\n"

        full_message = f"{context_block}{message}\n\nRespond with JSON only."
        user_msg = UserMessage(text=full_message)
        raw_response = await chat.send_message(user_msg)

        # Parse JSON from AI response
        cleaned = raw_response.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

        try:
            brain_response = json.loads(cleaned)
        except Exception:
            brain_response = {
                "message": cleaned.strip().strip('"'),
                "status": "IN_PROGRESS",
                "current_step_number": 1,
                "percentage_complete": 0
            }

        # If brain says COMPLETE, trigger calibration completion
        if brain_response.get("status") == "COMPLETE":
            now_iso = datetime.now(timezone.utc).isoformat()
            # PRIMARY: Write to user_operator_profile (authoritative)
            try:
                existing = get_sb().table("user_operator_profile").select("user_id").eq("user_id", user_id).maybe_single().execute()
                if existing.data:
                    get_sb().table("user_operator_profile").update({
                        "persona_calibration_status": "complete",
                        "calibration_completed_at": now_iso
                    }).eq("user_id", user_id).execute()
                else:
                    get_sb().table("user_operator_profile").insert({
                        "user_id": user_id,
                        "persona_calibration_status": "complete",
                        "calibration_completed_at": now_iso,
                        "operator_profile": {}
                    }).execute()
                logger.info(f"[calibration/brain] user_operator_profile.persona_calibration_status = complete for {user_id}")
            except Exception as op_err:
                logger.error(f"[calibration/brain] user_operator_profile write failed: {op_err}")

            # SECONDARY: Also update business_profiles for backward compat
            try:
                profile = await get_business_profile_supabase(get_sb(), user_id)
                if profile:
                    get_sb().table("business_profiles").update({
                        "calibration_status": "complete",
                        "updated_at": now_iso
                    }).eq("id", profile.get("id")).execute()
            except Exception as comp_err:
                logger.warning(f"[calibration/brain] business_profiles update failed: {comp_err}")

        return brain_response

    except Exception as e:
        logger.error(f"[calibration/brain] Error: {e}")
        return {
            "message": "Signal interference. Retry your last input.",
            "status": "IN_PROGRESS",
            "current_step_number": 1,
            "percentage_complete": 0
        }


@router.post("/strategy/regeneration/request")
async def queue_regeneration_request(payload: RegenerationRequestPayload, current_user: dict = Depends(get_current_user_supabase)):
    return await request_regeneration(current_user["id"], payload.layer, payload.reason, supabase_admin)


@router.post("/strategy/regeneration/response")
async def handle_regeneration_response(payload: RegenerationResponsePayload, current_user: dict = Depends(get_current_user_supabase)):
    action = payload.action.lower()
    if action not in {"accept", "refine", "keep"}:
        raise HTTPException(status_code=400, detail="Invalid response action")
    return await record_regeneration_response(current_user["id"], payload.proposal_id, action, supabase_admin)
