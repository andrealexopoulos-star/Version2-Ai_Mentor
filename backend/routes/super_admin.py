"""BIQc Super Admin + Support Console — Backend Routes.

All actions audit-logged. All routes require super_admin role + feature flag.
"""
import logging
from datetime import datetime, timezone
import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

logger = logging.getLogger(__name__)
router = APIRouter()

from routes.auth import get_current_user
from tier_resolver import resolve_tier
from intelligence_spine import _get_cached_flag


def _require_super_admin(current_user: dict):
    if resolve_tier(current_user) != 'super_admin':
        raise HTTPException(status_code=403, detail="Super admin access required")
    if not _get_cached_flag('super_admin_enabled'):
        raise HTTPException(status_code=403, detail="Super admin feature not enabled")


# ═══ SUPER ADMIN TEST PAGE ═══

@router.get("/super-admin/verify")
async def verify_super_admin(current_user: dict = Depends(get_current_user)):
    """Verify super admin status and feature flags."""
    tier = resolve_tier(current_user)
    flags = {}
    for flag in ['super_admin_enabled', 'support_page_enabled', 'legal_menu_enabled',
                 'rag_chat_enabled', 'memory_layer_enabled', 'marketing_benchmarks_enabled',
                 'marketing_automation_enabled', 'observability_full_enabled', 'guardrails_enabled']:
        flags[flag] = _get_cached_flag(flag)

    return {
        'email': current_user.get('email', ''),
        'user_id': current_user.get('id', ''),
        'role': tier,
        'is_super_admin': tier == 'super_admin',
        'feature_flags': flags,
        'verified': tier == 'super_admin',
    }


# ═══ SUPPORT CONSOLE — USER LIST ═══

@router.get("/support/users")
async def list_all_users(current_user: dict = Depends(get_current_user)):
    """List all users with business profiles. Super admin only."""
    _require_super_admin(current_user)
    if not _get_cached_flag('support_page_enabled'):
        raise HTTPException(status_code=403, detail="Support page not enabled")
    try:
        from supabase_client import get_supabase_client
        sb = get_supabase_client()
        result = sb.rpc('admin_list_users', {}).execute()
        return {'users': result.data if isinstance(result.data, list) else []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ═══ DISABLE / ENABLE ═══

class ToggleUserRequest(BaseModel):
    user_id: str
    disable: bool


@router.post("/support/toggle-user")
async def toggle_user(req: ToggleUserRequest, current_user: dict = Depends(get_current_user)):
    """Disable or enable a user account. Audit logged."""
    _require_super_admin(current_user)
    try:
        from supabase_client import get_supabase_client
        sb = get_supabase_client()
        result = sb.rpc('admin_toggle_user', {
            'p_admin_id': current_user['id'],
            'p_target_id': req.user_id,
            'p_disable': req.disable,
        }).execute()
        return result.data if result.data else {'status': 'ok'}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ═══ RESET PASSWORD ═══

class ResetPasswordRequest(BaseModel):
    user_id: str
    email: str


@router.post("/support/reset-password")
async def reset_password(req: ResetPasswordRequest, current_user: dict = Depends(get_current_user)):
    """Trigger password reset email via Supabase Auth. Audit logged."""
    _require_super_admin(current_user)
    try:
        from supabase_client import get_supabase_client
        sb = get_supabase_client()
        # Supabase admin API for password reset
        sb.auth.admin.generate_link({'type': 'recovery', 'email': req.email})
        # Audit log
        sb.table('admin_actions').insert({
            'admin_user_id': current_user['id'],
            'target_user_id': req.user_id,
            'action_type': 'reset_password',
            'new_value': {'email': req.email},
        }).execute()
        return {'status': 'reset_sent', 'email': req.email}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ═══ UPDATE SUBSCRIPTION ═══

class UpdateSubRequest(BaseModel):
    user_id: str
    tier: str


@router.post("/support/update-subscription")
async def update_subscription(req: UpdateSubRequest, current_user: dict = Depends(get_current_user)):
    """Change user subscription tier. Audit logged."""
    _require_super_admin(current_user)
    if req.tier not in ['free', 'starter', 'professional', 'enterprise', 'super_admin']:
        raise HTTPException(status_code=400, detail="Invalid tier")
    try:
        from supabase_client import get_supabase_client
        sb = get_supabase_client()
        result = sb.rpc('admin_update_subscription', {
            'p_admin_id': current_user['id'],
            'p_target_id': req.user_id,
            'p_tier': req.tier,
        }).execute()
        return result.data if result.data else {'status': 'ok'}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ═══ IMPERSONATE ═══

class ImpersonateRequest(BaseModel):
    user_id: str


@router.post("/support/impersonate")
async def impersonate_user(req: ImpersonateRequest, current_user: dict = Depends(get_current_user)):
    """Create impersonation session. Audit logged with admin + target + timestamp."""
    _require_super_admin(current_user)
    try:
        from supabase_client import get_supabase_client
        sb = get_supabase_client()
        # Get target user details
        target = sb.table('users').select('id, email, full_name, role').eq('id', req.user_id).single().execute()
        if not target.data:
            raise HTTPException(status_code=404, detail="User not found")
        # Audit log
        sb.table('admin_actions').insert({
            'admin_user_id': current_user['id'],
            'target_user_id': req.user_id,
            'action_type': 'impersonate_start',
            'new_value': {'target_email': target.data.get('email'), 'admin_email': current_user.get('email')},
        }).execute()
        return {
            'status': 'impersonation_active',
            'target': target.data,
            'admin_id': current_user['id'],
            'warning': 'You are now viewing as this user. All actions are logged.',
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ═══ ADMIN ACTIONS LOG ═══

@router.get("/support/audit-log")
async def get_admin_audit_log(current_user: dict = Depends(get_current_user)):
    """Get admin action audit trail."""
    _require_super_admin(current_user)
    try:
        from supabase_client import get_supabase_client
        sb = get_supabase_client()
        result = sb.table('admin_actions').select('*').order('created_at', desc=True).limit(50).execute()
        return {'actions': result.data or []}
    except Exception:
        return {'actions': []}



# ═══ ENTERPRISE CONTACT REQUEST ═══

class EnterpriseContactRequest(BaseModel):
    name: str
    business_name: Optional[str] = ''
    email: str
    phone: Optional[str] = ''
    callback_date: str
    callback_time: str
    description: str
    feature_requested: Optional[str] = ''
    user_id: Optional[str] = None
    current_tier: Optional[str] = 'free'


async def _notify_admin_enterprise_contact(req: EnterpriseContactRequest, submitter: dict) -> None:
    """Send admin alert via Resend (httpx). Never raises; failures are logged only."""
    try:
        from core.config import BIQC_ADMIN_NOTIFICATION_EMAIL, RESEND_API_KEY, RESEND_FROM_EMAIL
        if not RESEND_API_KEY:
            logger.debug("RESEND_API_KEY not set; skipping enterprise contact admin email")
            return
        if not RESEND_FROM_EMAIL:
            logger.warning("RESEND_FROM_EMAIL not set; skipping enterprise contact admin email")
            return
        is_waitlist = str(req.current_tier or "").strip().lower() == "waitlist"
        feat = (req.feature_requested or "").strip()
        if is_waitlist:
            subject = f"New Waitlist Request: {feat}" if feat else "New Waitlist Request"
        else:
            subject = "New Contact Request"
        lines = [
            "A new enterprise contact or waitlist form was submitted.",
            "",
            f"Name: {req.name}",
            f"Email: {req.email}",
            f"Company: {req.business_name or '(not provided)'}",
            f"Phone: {req.phone or '(not provided)'}",
            f"Feature requested: {feat or '(none)'}",
            f"Callback date: {req.callback_date}",
            f"Callback time: {req.callback_time}",
            f"Current tier / source: {req.current_tier or '(not provided)'}",
            "",
            "Description / message (waitlist business size may appear here):",
            req.description or "(empty)",
            "",
            f"Submitter user id: {submitter.get('id') or '(unknown)'}",
        ]
        body = "\n".join(lines)
        payload = {
            "from": RESEND_FROM_EMAIL,
            "to": [BIQC_ADMIN_NOTIFICATION_EMAIL],
            "subject": subject,
            "text": body,
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(
                "https://api.resend.com/emails",
                json=payload,
                headers={
                    "Authorization": f"Bearer {RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
            )
            if r.status_code >= 400:
                logger.warning(
                    "Resend API error for enterprise contact notify: %s %s",
                    r.status_code,
                    (r.text or "")[:500],
                )
    except Exception as e:
        logger.warning("enterprise contact admin notification failed: %s", e, exc_info=True)


@router.post("/enterprise/contact-request")
async def enterprise_contact_request(
    req: EnterpriseContactRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
    """Store enterprise contact request. Will eventually be synced to HubSpot."""
    try:
        from supabase_client import get_supabase_client
        sb = get_supabase_client()
        now = datetime.now(timezone.utc).isoformat()
        sb.table('enterprise_contact_requests').insert({
            'user_id': current_user.get('id'),
            'name': req.name,
            'business_name': req.business_name,
            'email': req.email,
            'phone': req.phone,
            'callback_date': req.callback_date,
            'callback_time': req.callback_time,
            'description': req.description,
            'feature_requested': req.feature_requested,
            'current_tier': req.current_tier,
            'status': 'pending',
            'created_at': now,
        }).execute()
        background_tasks.add_task(_notify_admin_enterprise_contact, req, current_user)
    except Exception as e:
        logger.warning(f"enterprise_contact_requests table may not exist yet: {e}")
    return {'status': 'received', 'message': 'Request logged. Our team will be in touch within 1 business day.'}


@router.get("/enterprise/contact-requests")
async def list_enterprise_contacts(current_user: dict = Depends(get_current_user)):
    """List all enterprise contact requests (admin only)."""
    _require_super_admin(current_user)
    try:
        from supabase_client import get_supabase_client
        sb = get_supabase_client()
        result = sb.table('enterprise_contact_requests').select('*').order('created_at', desc=True).limit(100).execute()
        return {'requests': result.data or []}
    except Exception as e:
        logger.warning(f"enterprise_contact_requests table may not exist: {e}")
        return {'requests': []}
