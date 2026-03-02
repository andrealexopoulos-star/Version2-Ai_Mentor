"""BIQc Super Admin + Support Console — Backend Routes.

All actions audit-logged. All routes require super_admin role + feature flag.
"""
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
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
