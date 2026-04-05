"""API Tier Guard Middleware — enforces subscription access at API layer.

Wraps FastAPI routes. Returns 403 with redirect payload if tier insufficient.
Uses ONLY tier_resolver.py for all checks. No scattered logic.
"""
import logging
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)

# Import resolver
from tier_resolver import check_api_access, resolve_tier, SUPER_ADMIN_EMAIL


class TierGuardMiddleware(BaseHTTPMiddleware):
    """Middleware that enforces tier-based API access control."""

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # Skip non-API routes (frontend, static, health)
        if not path.startswith('/api/'):
            return await call_next(request)

        # Strip /api/ prefix for matching
        api_path = path[4:]  # Remove '/api'

        # Skip auth endpoints (login, signup, callback)
        if api_path.startswith('/auth/') and any(api_path.startswith(f'/auth/{s}') for s in ['supabase/login', 'supabase/signup', 'supabase/oauth', 'supabase/me', 'check-profile', 'gmail', 'outlook']):
            return await call_next(request)

        # Skip health/warmup
        if api_path in ['/health', '/warmup', '/health/']:
            return await call_next(request)

        # Extract user from request state when already provided.
        user = getattr(request.state, 'user', None)
        if user is None:
            # Middleware runs before route dependencies; resolve bearer token here.
            auth_header = request.headers.get("authorization") or ""
            token = ""
            if auth_header.lower().startswith("bearer "):
                token = auth_header.split(" ", 1)[1].strip()
            if token:
                try:
                    from auth_supabase import verify_supabase_token
                    user = await verify_supabase_token(token)
                    request.state.user = user
                except Exception:
                    # Let route-level auth dependencies handle invalid tokens consistently.
                    user = None

        if user is None:
            # No user context yet — let endpoint auth dependencies enforce authentication.
            return await call_next(request)

        # Check access
        result = check_api_access(api_path, user)

        if not result['allowed']:
            logger.info(f"[TierGuard] BLOCKED: {user.get('email', '?')} (tier={result['tier']}) → {api_path} (needs={result.get('required_tier')})")
            return JSONResponse(
                status_code=403,
                content={
                    'error': 'subscription_required',
                    'message': f'This feature requires {result.get("required_tier", "paid")} tier or above.',
                    'redirect': result.get('redirect', '/subscribe'),
                    'current_tier': result['tier'],
                    'required_tier': result.get('required_tier'),
                    'attempted_path': api_path,
                },
            )

        return await call_next(request)
