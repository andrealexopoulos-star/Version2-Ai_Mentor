"""Signup-flow diagnostic logging.

Temporary public endpoint that accepts structured error reports from the
signup frontend whenever a step fails. We never rely on browser consoles
or user screenshots to understand prod failures — the backend log is the
source of truth. Shipped 2026-04-20 after Andreas reported silent signup
stalls where confirmSetup() failed without surfacing the reason.

Delete once signup flow is stable and we trust Sentry's frontend SDK
to cover this ground.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter, Request
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()


class SignupErrorReport(BaseModel):
    step: str  # "auth" | "setup_intent" | "card_confirm" | "confirm_trial" | "other"
    message: str
    email: Optional[str] = None
    user_id: Optional[str] = None
    plan: Optional[str] = None
    customer_id: Optional[str] = None
    stripe_error_code: Optional[str] = None
    stripe_decline_code: Optional[str] = None
    stripe_error_type: Optional[str] = None
    stripe_error_param: Optional[str] = None
    raw: Optional[Dict[str, Any]] = None


@router.post("/diagnostics/signup-error")
async def log_signup_error(report: SignupErrorReport, request: Request):
    """Public endpoint — no auth, so the frontend can call it even
    pre-signin. Never echoes back the body so attackers can't use it to
    probe. Logs to the backend where Azure log-download picks it up."""
    ua = (request.headers.get("User-Agent") or "")[:200]
    ip = request.headers.get("X-Forwarded-For", request.client.host if request.client else "?")
    logger.warning(
        "[signup-diag] step=%s email=%s user_id=%s plan=%s customer=%s "
        "stripe_code=%s decline=%s type=%s param=%s msg=%r ua=%r ip=%s",
        report.step, report.email, report.user_id, report.plan, report.customer_id,
        report.stripe_error_code, report.stripe_decline_code, report.stripe_error_type,
        report.stripe_error_param, report.message[:300], ua, ip,
    )
    if report.raw:
        logger.warning("[signup-diag] raw=%r", str(report.raw)[:2000])
    return {"ok": True}
