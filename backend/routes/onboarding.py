"""Onboarding, Invites, Website Enrichment, Business Profile Context Routes."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
import uuid
import re
import httpx
import logging

from routes.deps import get_current_user, get_sb, logger, require_owner_or_admin, get_current_account
from supabase_client import safe_query_single
from auth_supabase import get_user_by_id
from services.demo_seeder import seed_demo_account
from services.signal_enricher import enrich_insight, backfill_unenriched
import services.signal_enricher as signal_enricher
from supabase_intelligence_helpers import (
    get_business_profile_supabase, update_business_profile_supabase,
)
from supabase_remaining_helpers import (
    get_onboarding_supabase, update_onboarding_supabase,
    create_invite_supabase, get_invite_supabase, delete_invite_supabase,
)
from core.helpers import get_email_domain, hash_password, verify_password, create_token

router = APIRouter()

# ─── Models needed at module level for response_model= ───

class InviteCreateRequest(BaseModel):
    email: EmailStr
    name: str
    role: str = "member"

class InviteAcceptRequest(BaseModel):
    token: str
    temp_password: str
    new_password: str

class InviteResponse(BaseModel):
    invite_link: str
    temp_password: str
    expires_at: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    business_name: Optional[str] = None
    industry: Optional[str] = None
    role: str = "user"
    subscription_tier: Optional[str] = None
    is_master_account: Optional[bool] = False
    is_admin: Optional[bool] = False
    features: Optional[Dict[str, bool]] = None
    created_at: str = ""

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# Import shared dependencies — now from core modules
def _get_deps():
    from core.helpers import (
        get_email_domain, hash_password, verify_password, create_token,
    )
    from server import require_owner_or_admin, get_current_account
    from core.models import InviteResponse, TokenResponse, UserResponse, InviteCreateRequest, InviteAcceptRequest
    return {
        "require_owner_or_admin": require_owner_or_admin,
        "get_current_account": get_current_account,
        "get_email_domain": get_email_domain,
        "hash_password": hash_password,
        "verify_password": verify_password,
        "create_token": create_token,
    }



# ==================== INVITES (ENTERPRISE ONLY) ====================

def _normalize_tier_for_seats(tier: Optional[str]) -> str:
    value = (tier or "free").lower().strip()
    if value in {"growth", "foundation", "trial", "starter"}:
        return "starter"
    if value in {"professional", "pro"}:
        return "pro"
    if value in {"custom", "custom_build"}:
        return "custom_build"
    if value in {"superadmin", "super_admin"}:
        return "super_admin"
    return value


def seat_limit_for_tier(tier: Optional[str]) -> Optional[int]:
    normalized = _normalize_tier_for_seats(tier)
    if normalized == "starter":
        return 1
    if normalized == "pro":
        return 5
    if normalized == "business":
        return 12
    if normalized in {"enterprise", "custom_build", "super_admin"}:
        return None
    return 1


def tier_allows_seats(account: dict) -> bool:
    # Launch policy: all paid plans include team seats by capacity.
    seat_limit = seat_limit_for_tier(account.get("subscription_tier"))
    return seat_limit is None or seat_limit > 1


def generate_temp_password() -> str:
    # Simple temp password (shown once)
    return f"Temp!{uuid.uuid4().hex[:10]}"


@router.post("/account/users/invite", response_model=InviteResponse)
async def invite_user(req: InviteCreateRequest, current_user: dict = Depends(require_owner_or_admin), account: dict = Depends(get_current_account)):
    seat_limit = seat_limit_for_tier(account.get("subscription_tier"))
    if seat_limit == 1:
        raise HTTPException(status_code=403, detail="Growth includes 1 seat. Upgrade to Pro or higher to invite teammates.")

    # Backend seat enforcement:
    # count active account users + pending invites before issuing a new invite.
    current_users_count = 0
    pending_invites_count = 0
    try:
        users_res = get_sb().table("users").select("id").eq("account_id", account["id"]).execute()
        current_users_count = len(users_res.data or [])
    except Exception as e:
        logger.error(f"Error counting current users for account {account.get('id')}: {e}")
        raise HTTPException(status_code=503, detail="Seat check unavailable. Please retry.")
    try:
        invites_res = get_sb().table("invites").select("id").eq("account_id", account["id"]).execute()
        pending_invites_count = len(invites_res.data or [])
    except Exception:
        pending_invites_count = 0

    if seat_limit is not None and (current_users_count + pending_invites_count) >= seat_limit:
        raise HTTPException(
            status_code=403,
            detail=f"Seat limit reached for your plan ({seat_limit}). Upgrade to add more users.",
        )

    # Enforce same-domain (enterprise policy)
    owner_domain = get_email_domain(account.get("email"))
    invite_domain = get_email_domain(req.email)
    if owner_domain and invite_domain and owner_domain != invite_domain:
        raise HTTPException(status_code=400, detail="Invited user must use the same email domain as the account")

    # Check if email already exists in Supabase
    try:
        existing_user = get_sb().table("users").select("id, email").eq("email", req.email.lower().strip()).execute()
        if existing_user.data and len(existing_user.data) > 0:
            raise HTTPException(status_code=400, detail="Email already exists")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error checking existing user: {e}")
        # Continue - allow creation attempt

    now = datetime.now(timezone.utc)
    token = uuid.uuid4().hex
    temp_password = generate_temp_password()

    invite = {
        "id": str(uuid.uuid4()),
        "account_id": account["id"],
        "email": req.email.lower().strip(),
        "name": req.name,
        "role": req.role if req.role in {"member", "admin"} else "member",
        "token": token,
        "temp_password_hash": hash_password(temp_password),
        "expires_at": (now + timedelta(days=7)).isoformat(),
        "created_at": now.isoformat(),
    }
    await create_invite_supabase(get_sb(), invite)

    invite_link = f"/invite/accept?token={token}"
    return InviteResponse(invite_link=invite_link, temp_password=temp_password, expires_at=invite["expires_at"])


@router.post("/account/users/accept", response_model=TokenResponse)
async def accept_invite(req: InviteAcceptRequest):
    invite = await get_invite_supabase(get_sb(), req.token)
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")

    now = datetime.now(timezone.utc)
    try:
        exp = datetime.fromisoformat(invite["expires_at"])
        if exp < now:
            raise HTTPException(status_code=400, detail="Invite expired")
    except Exception:
        raise HTTPException(status_code=400, detail="Invite expired")

    if not verify_password(req.temp_password, invite["temp_password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid temporary password")

    if len(req.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    user_id = str(uuid.uuid4())
    created_at = now.isoformat()
    user_doc = {
        "id": user_id,
        "email": invite["email"],
        "password": hash_password(req.new_password),
        "name": invite.get("name") or "User",
        "business_name": None,
        "industry": None,
        # 2026-04-19: no free tier. Invited user → 14-day Growth trial.
        "subscription_tier": "trial",
        "subscription_started_at": created_at,
        "role": invite.get("role") or "member",
        "account_id": invite["account_id"],
        "is_active": True,
        "created_at": created_at,
        "updated_at": created_at,
        "auth_provider": "invite",
    }

    user_profile = {
        "id": user_id,
        "email": invite["email"],
        "full_name": invite.get("name") or "User",
        "company_name": None,
        "industry": None,
        "role": invite.get("role") or "member",
        # 2026-04-19: no free tier — invited user profile defaults to trial.
        "subscription_tier": "trial",
        "subscription_started_at": created_at,
        "account_id": invite["account_id"],
        "is_master_account": False,
        "created_at": created_at,
        "updated_at": created_at
    }

    insert_result = get_sb().table("users").insert(user_profile).execute()
    if not insert_result.data:
        raise HTTPException(status_code=500, detail="Failed to create user profile")

    # Consume invite
    await delete_invite_supabase(get_sb(), invite["token"])

    access_token = create_token(user_id, user_doc["email"], user_doc["role"], account_id=user_doc.get("account_id"))
    return TokenResponse(
        access_token=access_token,
        user=UserResponse(
            id=user_id,
            email=user_doc["email"],
            name=user_doc["name"],
            business_name=None,
            industry=None,
            role=user_doc["role"],
            subscription_tier=user_doc.get("subscription_tier"),
            created_at=user_doc["created_at"],
        ),
    )

# ==================== ONBOARDING MODELS ====================

class OnboardingSave(BaseModel):
    current_step: int
    business_stage: Optional[str] = None
    data: Dict[str, Any]
    completed: bool = False

class OnboardingStatusResponse(BaseModel):
    completed: bool
    current_step: Optional[int] = None
    business_stage: Optional[str] = None
    data: Optional[Dict[str, Any]] = None

# ==================== ONBOARDING ROUTES ====================

async def _read_onboarding_state(user_id: str) -> dict:
    """Read onboarding state from user_operator_profile.operator_profile.onboarding_state (authoritative).
    Falls back to onboarding table for migration, then writes back to user_operator_profile."""
    # PRIMARY: Read from user_operator_profile
    try:
        op_result = get_sb().table("user_operator_profile").select(
            "operator_profile"
        ).eq("user_id", user_id).maybe_single().execute()
        
        if op_result.data:
            op = op_result.data.get("operator_profile") or {}
            ob_state = op.get("onboarding_state")
            if ob_state is not None:
                return ob_state
    except Exception as e:
        logger.warning(f"[onboarding] user_operator_profile read failed: {e}")
    
    # FALLBACK: Read from legacy onboarding table, then migrate
    onboarding = await get_onboarding_supabase(get_sb(), user_id)
    if onboarding:
        state = {
            "completed": onboarding.get("completed", False),
            "current_step": onboarding.get("current_step", 0),
            "business_stage": onboarding.get("business_stage"),
            "data": onboarding.get("onboarding_data", {})
        }
        # Migrate to user_operator_profile
        await _write_onboarding_state(user_id, state)
        return state
    
    return None


async def _write_onboarding_state(user_id: str, state: dict):
    """Write onboarding state to user_operator_profile.operator_profile.onboarding_state."""
    try:
        op_result = get_sb().table("user_operator_profile").select(
            "operator_profile"
        ).eq("user_id", user_id).maybe_single().execute()
        
        if op_result.data:
            existing_op = op_result.data.get("operator_profile") or {}
            existing_op["onboarding_state"] = state
            get_sb().table("user_operator_profile").update({
                "operator_profile": existing_op,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }).eq("user_id", user_id).execute()
        else:
            get_sb().table("user_operator_profile").insert({
                "user_id": user_id,
                "operator_profile": {"onboarding_state": state},
                "persona_calibration_status": "incomplete"
            }).execute()
    except Exception as e:
        logger.error(f"[onboarding] user_operator_profile write failed: {e}")
    
    # Also keep onboarding table in sync for backward compat
    try:
        await update_onboarding_supabase(get_sb(), user_id, {
            "current_step": state.get("current_step", 0),
            "business_stage": state.get("business_stage"),
            "onboarding_data": state.get("data", {}),
            "completed": state.get("completed", False)
        })
    except Exception:
        pass


@router.get("/onboarding/status", response_model=OnboardingStatusResponse)
async def get_onboarding_status(current_user: dict = Depends(get_current_user)):
    """Check if user has completed onboarding.
    Priority: strategic_console_state.is_complete → user_operator_profile → fallback."""
    user_id = current_user["id"]

    # PRIORITY 1: strategic_console_state (authoritative)
    try:
        scs = get_sb().table("strategic_console_state").select(
            "is_complete"
        ).eq("user_id", user_id).maybe_single().execute()
        if scs.data and scs.data.get("is_complete"):
            return OnboardingStatusResponse(completed=True, current_step=14, business_stage=None, data={})
    except Exception:
        pass

    # PRIORITY 2: user_operator_profile
    state = await _read_onboarding_state(user_id)
    
    if not state or not state.get("completed", False):
        # Check if calibration is complete — auto-complete onboarding
        try:
            op = get_sb().table("user_operator_profile").select(
                "persona_calibration_status, operator_profile"
            ).eq("user_id", user_id).maybe_single().execute()
            if op.data and op.data.get("persona_calibration_status") == "complete":
                op_profile = op.data.get("operator_profile") or {}
                op_profile["onboarding_state"] = {
                    "completed": True, "current_step": 14,
                    "completed_at": datetime.now(timezone.utc).isoformat()
                }
                get_sb().table("user_operator_profile").update(
                    {"operator_profile": op_profile}
                ).eq("user_id", user_id).execute()
                return OnboardingStatusResponse(completed=True, current_step=14, business_stage=None, data={})
        except Exception:
            pass
    
    if not state:
        return OnboardingStatusResponse(completed=False, current_step=0, business_stage=None, data={})
    
    return OnboardingStatusResponse(
        completed=state.get("completed", False),
        current_step=state.get("current_step", 0),
        business_stage=state.get("business_stage"),
        data=state.get("data", {})
    )

@router.post("/onboarding/save")
async def save_onboarding_progress(
    request: OnboardingSave,
    current_user: dict = Depends(get_current_user)
):
    """Save onboarding progress to user_operator_profile (authoritative).
    Also persists answered fields to the fact_ledger and business_profiles."""
    from fact_resolution import persist_facts_batch, ONBOARDING_FIELD_TO_FACT
    
    user_id = current_user["id"]
    
    # Read current state to enforce anti-regression
    current_state = await _read_onboarding_state(user_id)
    current_step_saved = current_state.get("current_step", 0) if current_state else 0
    
    new_step = request.current_step
    if new_step < current_step_saved and new_step != 0:
        new_step = current_step_saved
    
    new_state = {
        "current_step": new_step,
        "business_stage": request.business_stage,
        "data": request.data,
        "completed": request.completed
    }
    
    await _write_onboarding_state(user_id, new_state)
    
    if request.data:
        # Persist to business_profiles
        profile_fields = {}
        field_mapping = {
            "business_name": "business_name",
            "industry": "industry",
            "business_stage": None,
            "abn": "abn",
            "website": "website",
            "products_services": "products_services",
            "business_model": "business_model",
            "target_customer": "ideal_customer_profile",
            "unique_value": "unique_value_proposition",
            "team_size": "team_size",
            "hiring_status": "hiring_status",
            "revenue_range": "revenue_range",
            "customer_count": "customer_count",
            "growth_challenge": "main_challenges",
            "years_operating": "years_operating",
            "location": "location",
            "geographic_focus": "geographic_focus",
            "product_description": "products_services",
            "problem_statement": "mission_statement",
            "growth_goals": "short_term_goals",
            "funding_status": "funding_status",
            "funding_stage": "funding_stage",
        }
        
        for src_field, dest_field in field_mapping.items():
            if dest_field and src_field in request.data and request.data[src_field]:
                val = request.data[src_field]
                if isinstance(val, list):
                    val = ", ".join(val)
                profile_fields[dest_field] = val
        
        if request.business_stage:
            profile_fields["business_stage"] = request.business_stage
        
        if profile_fields:
            await update_business_profile_supabase(get_sb(), user_id, profile_fields)
        
        # Persist to fact_ledger — every answered field becomes a confirmed fact
        fact_map = {}
        for form_field, value in request.data.items():
            if value and form_field in ONBOARDING_FIELD_TO_FACT:
                fact_map[ONBOARDING_FIELD_TO_FACT[form_field]] = value
        if fact_map:
            await persist_facts_batch(get_sb(), user_id, fact_map, source="onboarding")
    
    return {"status": "saved", "current_step": new_step}

@router.post("/onboarding/complete")
async def complete_onboarding(current_user: dict = Depends(get_current_user)):
    """
    Mark onboarding as completed.
    Writes to user_operator_profile (authoritative) and onboarding table (compat).
    """
    from workspace_helpers import get_or_create_user_account
    
    user_id = current_user["id"]
    user_email = current_user.get("email")
    
    # Mark onboarding complete in user_operator_profile (authoritative)
    now_iso = datetime.now(timezone.utc).isoformat()
    current_state = await _read_onboarding_state(user_id) or {}
    current_state["completed"] = True
    current_state["completed_at"] = now_iso
    await _write_onboarding_state(user_id, current_state)

    # LOOP-BREAKER: Write to strategic_console_state (authoritative for routing)
    try:
        get_sb().table("strategic_console_state").upsert({
            "user_id": user_id,
            "status": "COMPLETED",
            "current_step": 17,
            "is_complete": True,
            "updated_at": now_iso
        }, on_conflict="user_id").execute()
        logger.info(f"[onboarding/complete] strategic_console_state = COMPLETED for {user_id}")
    except Exception as scs_err:
        logger.warning(f"[onboarding/complete] strategic_console_state write failed: {scs_err}")

    # FIX: Set persona_calibration_status = 'complete' on user_operator_profile
    # This is what auth/check-profile reads to determine needs_onboarding
    try:
        existing_op = get_sb().table("user_operator_profile").select("user_id").eq("user_id", user_id).execute()
        if existing_op.data:
            get_sb().table("user_operator_profile").update({
                "persona_calibration_status": "complete",
                "updated_at": now_iso
            }).eq("user_id", user_id).execute()
        else:
            get_sb().table("user_operator_profile").insert({
                "user_id": user_id,
                "persona_calibration_status": "complete",
                "updated_at": now_iso
            }).execute()
        logger.info(f"[onboarding/complete] persona_calibration_status = complete for {user_id}")
    except Exception as op_err:
        logger.warning(f"[onboarding/complete] user_operator_profile update failed: {op_err}")
    
    # Get business profile created during onboarding
    profile = await get_business_profile_supabase(get_sb(), user_id)
    business_profile_id = profile.get("id") if profile else None
    company_name = profile.get("business_name") if profile else None
    
    # STEP 1: CREATE PARENT ACCOUNT (if doesn't exist)
    try:
        account = await get_or_create_user_account(
            supabase_admin, 
            user_id, 
            user_email, 
            company_name
        )
        account_id = account["id"]
        
        logger.info(f"✅ Parent account ensured for user {user_id}: {account_id}")
        
        # STEP 2: Link business profile to account (if exists)
        if business_profile_id:
            try:
                # Update business_profile with account_id if not already set
                profile_update = await get_business_profile_supabase(get_sb(), user_id)
                
                if profile_update and not profile_update.get('account_id'):
                    await update_business_profile_supabase(
                        supabase_admin,
                        user_id,
                        {"account_id": account_id}
                    )
                    logger.info(f"✅ Business profile linked to account {account_id}")
                    
            except Exception as e:
                logger.error(f"⚠️ Failed to link business profile to account: {e}")
                # Non-blocking - continue with completion
        
    except Exception as e:
        logger.error(f"❌ Failed to create/get parent account: {e}")
        # Non-blocking - onboarding completion continues
        account_id = None
        business_profile_id = None
    
    # STEP 3: Create calibration schedule (if account + profile exist)
    if account_id and business_profile_id:
        try:
            now = datetime.now(timezone.utc)
            next_weekly = now + timedelta(days=7)
            next_quarterly = now + timedelta(days=90)
            
            schedule_data = {
                "business_profile_id": business_profile_id,
                "user_id": user_id,
                "account_id": account_id,
                "schedule_status": "active",
                "weekly_pulse_enabled": True,
                "quarterly_calibration_enabled": True,
                "created_at": now.isoformat(),
                "next_weekly_due_at": next_weekly.isoformat(),
                "next_quarterly_due_at": next_quarterly.isoformat(),
                "weekly_completion_count": 0,
                "quarterly_completion_count": 0
            }
            
            # UPSERT: Prevent duplicates
            result = get_sb().table("calibration_schedules").upsert(
                schedule_data,
                on_conflict="business_profile_id"
            ).execute()
            
            if result.data:
                logger.info(f"✅ Calibration schedule created")
            else:
                logger.warning(f"⚠️ Calibration schedule upsert returned no data")
                
        except Exception as e:
            # Non-blocking: Log error but don't fail onboarding completion
            logger.error(f"❌ Failed to create calibration schedule: {e}")
    
    return {"status": "completed"}


# ==================== WEBSITE ENRICHMENT ====================

class WebsiteEnrichRequest(BaseModel):
    url: str

@router.post("/website/enrich")
async def enrich_website(request: WebsiteEnrichRequest, current_user: dict = Depends(get_current_user)):
    """Fetch website metadata and infer business details from a URL"""
    url = request.url.strip()
    if not url.startswith("http"):
        url = f"https://{url}"
    
    result = {"url": url, "title": None, "description": None, "inferred_name": None, "inferred_category": None}
    
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0 BIQC-Bot/1.0"})
            html = resp.text[:50000]  # limit to first 50KB
            
            # Extract title
            title_match = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
            if title_match:
                result["title"] = title_match.group(1).strip()[:200]
            
            # Extract meta description
            desc_match = re.search(r'<meta[^>]+name=["\']description["\'][^>]+content=["\'](.*?)["\']', html, re.IGNORECASE)
            if not desc_match:
                desc_match = re.search(r'<meta[^>]+content=["\'](.*?)["\'][^>]+name=["\']description["\']', html, re.IGNORECASE)
            if desc_match:
                result["description"] = desc_match.group(1).strip()[:500]
            
            # Infer business name from title (before separator)
            if result["title"]:
                for sep in [" | ", " - ", " – ", " — ", " :: "]:
                    if sep in result["title"]:
                        result["inferred_name"] = result["title"].split(sep)[0].strip()
                        break
                if not result["inferred_name"]:
                    result["inferred_name"] = result["title"]
            
            # Extract og:type or keywords for category hint
            og_match = re.search(r'<meta[^>]+property=["\']og:type["\'][^>]+content=["\'](.*?)["\']', html, re.IGNORECASE)
            if og_match:
                result["inferred_category"] = og_match.group(1).strip()
            
    except Exception as e:
        logger.warning(f"Website enrichment failed for {url}: {e}")
        result["error"] = str(e)
    
    return result


@router.post("/onboarding/enrich-signals")
async def enrich_signals(current_user: dict = Depends(get_current_user)):
    """Backfill LLM enrichment for the current user's unenriched watchtower_insights rows."""
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(status_code=400, detail="User id missing")
    sb = get_sb()
    return await backfill_unenriched(
        sb, signal_enricher.llm_caller, 25, user_id=user_id
    )


@router.post("/onboarding/enrich-all")
async def enrich_all_endpoint(current_user: dict = Depends(require_owner_or_admin)):
    from services.signal_enricher import backfill_unenriched, llm_caller

    user_id = current_user.get("id")
    return await backfill_unenriched(get_sb(), llm_caller, limit=500, user_id=user_id)


@router.post("/onboarding/group-signals")
async def group_signals_endpoint(current_user: dict = Depends(require_owner_or_admin)):
    from services.signal_grouper import group_insight

    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(status_code=400, detail="User id missing")
    sb = get_sb()
    recent = (
        sb.table("watchtower_insights")
        .select("id")
        .eq("user_id", user_id)
        .is_("signal_group_id", "null")
        .not_.is_("explanation", "null")
        .order("detected_at", desc=True)
        .limit(100)
        .execute()
    )
    results = []
    for row in recent.data or []:
        results.append(await group_insight(sb, row["id"]))
    return {"processed": len(results), "results": results}


@router.get("/business-profile/context")
async def get_business_profile_context(current_user: dict = Depends(get_current_user)):
    """Get existing business profile + onboarding state + resolved facts.
    Onboarding state reads from user_operator_profile (authoritative).
    Facts resolved from all Supabase sources."""
    from fact_resolution import resolve_facts, resolve_onboarding_fields
    
    user_id = current_user["id"]
    
    profile = await get_business_profile_supabase(get_sb(), user_id)
    ob_state = await _read_onboarding_state(user_id)
    
    # Resolve all known facts
    facts = await resolve_facts(get_sb(), user_id)
    resolved_fields = resolve_onboarding_fields(facts)
    
    # Get intelligence baseline if it exists
    baseline = None
    try:
        bl_result = get_sb().table("intelligence_baseline").select("*").eq("user_id", user_id).maybe_single().execute()
        baseline = bl_result.data if bl_result.data else None
    except Exception:
        pass
    
    # Get calibration status
    calibration_status = "incomplete"
    try:
        op_result = get_sb().table("user_operator_profile").select(
            "persona_calibration_status"
        ).eq("user_id", user_id).maybe_single().execute()
        if op_result.data:
            calibration_status = op_result.data.get("persona_calibration_status", "incomplete")
    except Exception:
        pass
    
    return {
        "profile": profile or {},
        "onboarding": {
            "completed": ob_state.get("completed", False) if ob_state else False,
            "current_step": ob_state.get("current_step", 0) if ob_state else 0,
            "business_stage": ob_state.get("business_stage") if ob_state else None,
            "data": ob_state.get("data", {}) if ob_state else {}
        },
        "resolved_fields": resolved_fields,
        "intelligence_baseline": baseline,
        "calibration_status": calibration_status
    }


@router.post("/onboarding/seed-demo")
async def seed_demo_data(current_user: dict = Depends(get_current_user)):
    """Seed demo data for a user only when they have no existing events."""
    user_id = current_user["id"]
    result = seed_demo_account(get_sb(), user_id)
    return result


# ==================== PROGRESSIVE ONBOARDING CHECKLIST (Sprint B #12) ====================
# Retention lever — users who complete more checklist items retain at ~3x rate per
# typical SaaS benchmarks. Logic lives in services/onboarding_progress.py so it
# can be unit-tested with a mocked Supabase client.

from services.onboarding_progress import evaluate_onboarding_progress


@router.get("/onboarding/progress")
async def get_onboarding_progress(current_user: dict = Depends(get_current_user)):
    """Progressive onboarding checklist (Sprint B #12).

    Returns the six-step journey from signup → first action closed, each step's
    done-state evaluated against the live state of the respective table.
    Frontend renders this as a horizontal step strip above the Advisor KPI row
    whenever percent_complete < 100.
    """
    user_id = current_user["id"]
    return evaluate_onboarding_progress(get_sb(), user_id)

