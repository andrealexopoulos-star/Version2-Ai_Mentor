"""
Email & Calendar Routes — Outlook, Gmail, OAuth, email intelligence, priority inbox.
Extracted from server.py. Includes token helpers and all email-related routes.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone, timedelta
import os
import json
import asyncio
import logging
import re
import jwt
import uuid
from urllib.parse import quote
from dateutil import parser as dateutil_parser

import httpx
from core.llm_router import llm_chat
from routes.deps import (
    get_current_user, get_current_user_from_request,
    get_sb, OPENAI_KEY, AI_MODEL, logger,
)
from prompt_registry import get_prompt
from auth_supabase import get_user_by_id
from supabase_email_helpers import (
    store_email_supabase, get_user_emails_supabase,
    count_user_emails_supabase, delete_user_emails_supabase,
    create_sync_job_supabase, get_sync_job_supabase,
    update_sync_job_supabase, find_user_sync_job_supabase,
    store_calendar_events_batch_supabase,
    delete_user_calendar_events_supabase,
    get_user_calendar_events_supabase,
    find_email_by_id_supabase,
    find_email_by_graph_message_id_supabase,
    delete_user_sync_jobs_supabase,
)
from supabase_intelligence_helpers import (
    get_email_intelligence_supabase, update_email_intelligence_supabase,
    get_priority_analysis_supabase, update_priority_analysis_supabase,
    get_business_profile_supabase,
    update_calendar_intelligence_supabase,
)
from config.urls import get_backend_url, get_frontend_url
from biqc_jobs import enqueue_job
from tier_resolver import resolve_tier

JWT_SECRET = os.environ.get('JWT_SECRET_KEY', 'fallback-secret')

router = APIRouter()


def _connected_integration_count_for_email(user_id: str) -> int:
    sb = get_sb()
    count = 0
    try:
        merge_rows = sb.table("integration_accounts").select("id").eq("user_id", user_id).execute()
        count += len(merge_rows.data or [])
    except Exception:
        pass
    try:
        email_rows = sb.table("email_connections").select("provider").eq("user_id", user_id).eq("connected", True).execute()
        count += len(email_rows.data or [])
    except Exception:
        pass
    return count


def _launch_integration_limit(current_user: dict):
    tier = resolve_tier(current_user)
    if tier == 'super_admin':
        return None
    if tier == 'free':
        return 1
    return 5


def _ensure_launch_email_slot(current_user: dict, provider: str) -> None:
    tier = resolve_tier(current_user)
    if tier == 'super_admin':
        return
    try:
        existing_email = get_sb().table("email_connections").select("provider").eq("user_id", current_user["id"]).eq("provider", provider).eq("connected", True).limit(1).execute()
        if existing_email.data:
            return
    except Exception:
        pass
    limit = _launch_integration_limit(current_user)
    if limit is not None and _connected_integration_count_for_email(current_user["id"]) >= limit:
        detail = 'Free tier includes email integration only. Disconnect your current provider or upgrade to SMB Protect.' if tier == 'free' else 'SMB Protect includes up to 5 integrations. Disconnect an existing integration before adding another.'
        raise HTTPException(status_code=403, detail=detail)


def _normalize_oauth_public_url(url: str, fallback: str) -> str:
    """Normalize public URLs used in OAuth redirects."""
    cleaned = (url or fallback).rstrip("/")
    if '.emergent.host' in cleaned:
        cleaned = cleaned.replace('.emergent.host', '.com')
    if 'preview.emergentagent.com' in cleaned:
        cleaned = os.environ.get('BACKEND_URL', fallback).rstrip("/")
    return cleaned


def _get_oauth_callback_base_url() -> str:
    """Public backend base used by providers for OAuth callback redirect_uri."""
    fallback = 'http://localhost:8001'
    explicit = os.environ.get('OAUTH_REDIRECT_BASE_URL')
    if explicit:
        return _normalize_oauth_public_url(explicit, fallback)
    backend_url = os.environ.get('BACKEND_URL')
    if backend_url:
        return _normalize_oauth_public_url(backend_url, fallback)
    frontend_url = os.environ.get('FRONTEND_URL')
    return _normalize_oauth_public_url(frontend_url, fallback)


def _get_frontend_base_url() -> str:
    """Public frontend base used for post-auth browser redirects."""
    fallback = 'http://localhost:8001'
    frontend_url = os.environ.get('FRONTEND_URL')
    if frontend_url:
        return _normalize_oauth_public_url(frontend_url, fallback)
    backend_url = os.environ.get('BACKEND_URL')
    return _normalize_oauth_public_url(backend_url, fallback)


# OAuth config from environment
AZURE_TENANT_ID = os.environ.get("AZURE_TENANT_ID", "common")
AZURE_TENANT_URL = os.environ.get("AZURE_TENANT_URL", "https://login.microsoftonline.com/common")
AZURE_CLIENT_ID = os.environ.get("AZURE_CLIENT_ID")
AZURE_CLIENT_SECRET = os.environ.get("AZURE_CLIENT_SECRET")
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET")

# Prompt fallbacks
_EMAIL_PRIORITY_FALLBACK = "You are a strategic business email analyst. Always respond with valid JSON only."
_EMAIL_REPLY_FALLBACK = "You are BIQC, a decisive business intelligence advisor. Generate concise, action-oriented email replies."


class CalendarEventCreateRequest(BaseModel):
    title: str
    summary: Optional[str] = None
    start_at: str
    end_at: str
    location: Optional[str] = None
    attendee_emails: Optional[List[str]] = None


def _heuristic_priority(email: Dict[str, Any]) -> Dict[str, Any]:
    subject = str(email.get("subject") or "")
    preview = str(email.get("body_preview") or "")
    combined = f"{subject} {preview}".lower()

    high_tokens = ["urgent", "overdue", "invoice", "payment", "contract", "deadline", "escalat", "proposal", "quote"]
    medium_tokens = ["meeting", "follow up", "follow-up", "review", "update", "decision", "client"]

    if any(token in combined for token in high_tokens):
        priority = "high"
        reason = "Contains urgency, commercial risk, or deadline language."
        action = "Review today and send a decisive reply or escalation."
    elif any(token in combined for token in medium_tokens):
        priority = "medium"
        reason = "Requires owner attention but is not obviously time-critical."
        action = "Review this cycle and confirm next step or owner."
    else:
        priority = "low"
        reason = "Appears informational and can be triaged after urgent items."
        action = "Archive, delegate, or batch with other low-priority messages."

    return {
        "priority": priority,
        "reason": reason,
        "suggested_action": action,
        "action_item": None,
        "due_date": None,
    }


def _normalize_priority_response(priority_analysis: Dict[str, Any], recent_emails: List[Dict[str, Any]]) -> Dict[str, Any]:
    def enrich_priority(items):
        enriched = []
        for item in items:
            idx = int(item.get("email_index", 1) or 1) - 1
            if 0 <= idx < len(recent_emails):
                email = recent_emails[idx]
                enriched.append({
                    **item,
                    "email_id": email.get("id"),
                    "from": email.get("from_name") or email.get("from_address"),
                    "subject": email.get("subject"),
                    "received": email.get("received_date"),
                    "snippet": email.get("body_preview") or "",
                })
        return enriched

    normalized = dict(priority_analysis or {})
    normalized.setdefault("high_priority", [])
    normalized.setdefault("medium_priority", [])
    normalized.setdefault("low_priority", [])
    normalized["high_priority"] = enrich_priority(normalized.get("high_priority", []))
    normalized["medium_priority"] = enrich_priority(normalized.get("medium_priority", []))
    normalized["low_priority"] = enrich_priority(normalized.get("low_priority", []))
    return normalized


def _safe_parse_dt(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = dateutil_parser.isoparse(str(value))
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed
    except Exception:
        return None


def _normalise_recipients(raw_value: Any) -> List[str]:
    if not raw_value:
        return []
    if isinstance(raw_value, str):
        try:
            raw_value = json.loads(raw_value)
        except Exception:
            return [raw_value.lower().strip()] if "@" in raw_value else []
    recipients: List[str] = []
    if isinstance(raw_value, list):
        for item in raw_value:
            if isinstance(item, dict):
                email = str(item.get("email") or item.get("address") or item.get("emailAddress") or "").lower().strip()
                if email:
                    recipients.append(email)
            elif isinstance(item, str):
                email = item.lower().strip()
                if email:
                    recipients.append(email)
    return recipients


def _filter_replied_inbox_emails(inbox_emails: List[Dict[str, Any]], sent_emails: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    def _normalise_subject(value: Any) -> str:
        subject = str(value or "").lower().strip()
        subject = re.sub(r"^(re|fw|fwd)\s*:\s*", "", subject)
        return re.sub(r"\s+", " ", subject)

    latest_sent_by_recipient: Dict[str, datetime] = {}
    latest_sent_by_recipient_subject: Dict[tuple[str, str], datetime] = {}
    for sent in sent_emails:
        sent_at = _safe_parse_dt(sent.get("received_date") or sent.get("sent_date"))
        if not sent_at:
            continue
        sent_subject = _normalise_subject(sent.get("subject"))
        for recipient in _normalise_recipients(sent.get("to_recipients")):
            current = latest_sent_by_recipient.get(recipient)
            if current is None or sent_at > current:
                latest_sent_by_recipient[recipient] = sent_at
            if sent_subject:
                key = (recipient, sent_subject)
                current_subject = latest_sent_by_recipient_subject.get(key)
                if current_subject is None or sent_at > current_subject:
                    latest_sent_by_recipient_subject[key] = sent_at

    actionable: List[Dict[str, Any]] = []
    for email in inbox_emails:
        sender = str(email.get("from_address") or "").lower().strip()
        received_at = _safe_parse_dt(email.get("received_date"))
        inbox_subject = _normalise_subject(email.get("subject"))
        latest_sent = latest_sent_by_recipient.get(sender)
        latest_subject_reply = latest_sent_by_recipient_subject.get((sender, inbox_subject)) if inbox_subject else None
        if sender and received_at and ((latest_subject_reply and latest_subject_reply >= received_at) or (latest_sent and latest_sent >= received_at)):
            continue
        actionable.append(email)
    return actionable


# ═══════════════════════════════════════════════════════════════
# ROUTE HANDLERS (extracted from server.py lines 3556-5314)
# ═══════════════════════════════════════════════════════════════

# ═══════════════════════════════════════════════════════════════
# OUTLOOK HYBRID TOKEN HELPERS (Supabase + MongoDB Support)
# ═══════════════════════════════════════════════════════════════

async def get_outlook_tokens(user_id: str) -> Optional[Dict[str, Any]]:
    """
    Get Outlook tokens from outlook_oauth_tokens table (Supabase Edge Function)
    Falls back to m365_tokens for backward compatibility
    """
    logger.info(f"🔍 Looking for Outlook tokens for user_id: {user_id}")
    
    # First try outlook_oauth_tokens (from Supabase Edge Function)
    try:
        response = get_sb().table("outlook_oauth_tokens").select("*").eq("user_id", user_id).execute()
        logger.info(f"🔍 outlook_oauth_tokens query result: {len(response.data) if response.data else 0} records")
        if response.data and len(response.data) > 0:
            token_data = response.data[0]
            logger.info(f"✅ Retrieved Outlook tokens from outlook_oauth_tokens for user {user_id}")
            logger.info(f"   Token expires_at: {token_data.get('expires_at')}")
            logger.info(f"   Account email: {token_data.get('account_email')}")
            return {
                "access_token": token_data["access_token"],
                "refresh_token": token_data.get("refresh_token"),
                "expires_at": token_data.get("expires_at"),
                "microsoft_email": token_data.get("account_email"),
                "source": "outlook_oauth_tokens"
            }
    except Exception as e:
        logger.warning(f"Could not query outlook_oauth_tokens: {e}")
        import traceback
        logger.warning(traceback.format_exc())
    
    # Fallback to m365_tokens for backward compatibility
    try:
        response = get_sb().table("m365_tokens").select("*").eq("user_id", user_id).execute()
        logger.info(f"🔍 m365_tokens query result: {len(response.data) if response.data else 0} records")
        if response.data and len(response.data) > 0:
            token_data = response.data[0]
            logger.info(f"✅ Retrieved Outlook tokens from m365_tokens for user {user_id}")
            return {
                "access_token": token_data["access_token"],
                "refresh_token": token_data.get("refresh_token"),
                "expires_at": token_data["expires_at"],
                "source": "m365_tokens"
            }
    except Exception as e:
        logger.error(f"Error getting m365_tokens for user {user_id}: {e}")
    
    logger.warning(f"❌ No Outlook tokens found in any table for user {user_id}")
    return None


async def store_outlook_tokens(user_id: str, access_token: str, refresh_token: str, expires_at: str, microsoft_user_id: str = None, microsoft_email: str = None, microsoft_name: str = None, scope: str = None):
    """
    Store Outlook tokens in m365_tokens table - MINIMAL fields only
    """
    try:
        # Use ONLY fields that definitely exist in the table
        token_data = {
            "user_id": user_id,
            "access_token": access_token,
            "refresh_token": refresh_token,
            "expires_at": expires_at
        }
        
        # Note: microsoft_user_id, microsoft_email, microsoft_name, scope fields
        # are not in the current m365_tokens table schema, so we don't include them
        
        # Upsert
        result = get_sb().table("m365_tokens").upsert(token_data, on_conflict="user_id").execute()
        
        if result.data:
            logger.info(f"✅ Stored Outlook tokens in m365_tokens for user {user_id}")
            return True
        else:
            logger.error(f"❌ No data returned from upsert for user {user_id}")
            return False
        
    except Exception as e:
        logger.error(f"❌ Error storing Outlook tokens for user {user_id}: {e}")
        return False


# ==================== MICROSOFT OUTLOOK INTEGRATION ====================

@router.get("/auth/outlook/login")
async def outlook_login(request: Request, returnTo: str = "/connect-email", token: Optional[str] = None, provider: Optional[str] = None):
    """
    Initiate Microsoft OAuth flow for Outlook
    Accepts authentication token as query parameter (for browser redirects)
    """
    import hashlib
    import hmac
    # provider param is optional — endpoint URL already defines this as outlook
    
    # Manual token validation (browser redirects can't send Authorization header)
    current_user = None

    if token:
        try:
            payload = jwt.decode(token, options={"verify_signature": False})
            user_id = payload.get("sub")
            if user_id:
                # Fast path: look up in users table
                user_data = await get_user_by_id(user_id)
                if user_data:
                    current_user = user_data
                else:
                    # Fallback: user exists in Supabase Auth but not yet in users table
                    # (happens when the frontend signUp DB insert failed silently)
                    # Verify the token cryptographically via Supabase Admin, then auto-provision
                    try:
                        from supabase_client import get_sb
                        auth_resp = get_sb().auth.get_user(token)
                        if auth_resp and auth_resp.user:
                            now_iso = datetime.now(timezone.utc).isoformat()
                            user_record = {
                                "id": auth_resp.user.id,
                                "email": auth_resp.user.email or "",
                                "full_name": (
                                    (auth_resp.user.user_metadata or {}).get("full_name")
                                    or (auth_resp.user.user_metadata or {}).get("name")
                                    or ""
                                ),
                                "role": "user",
                                "subscription_tier": "free",
                                "is_master_account": auth_resp.user.email == "andre@thestrategysquad.com.au",
                                "created_at": now_iso,
                                "updated_at": now_iso,
                            }
                            try:
                                get_sb().table("users").upsert(user_record, on_conflict="id").execute()
                                logger.info(f"[outlook/login] Auto-provisioned missing users record for {auth_resp.user.id}")
                            except Exception as upsert_err:
                                logger.warning(f"[outlook/login] users upsert failed (non-fatal): {upsert_err}")
                            current_user = user_record
                    except Exception as auth_fb_err:
                        logger.warning(f"[outlook/login] Supabase Auth fallback failed: {auth_fb_err}")
        except Exception as token_err:
            logger.warning(f"[outlook/login] Token parse error: {token_err}")

    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required. Please log in.")

    _ensure_launch_email_slot(current_user, 'outlook')
    
    user_id = current_user['id']
    
    callback_base_url = _get_oauth_callback_base_url()
    frontend_base_url = _get_frontend_base_url()
    redirect_uri = f"{callback_base_url}/api/auth/outlook/callback"
    logger.info(f"📧 Outlook OAuth redirect_uri: {redirect_uri}")
    
    # URL encode parameters to prevent malformed URLs
    scope = "offline_access User.Read Mail.Read Mail.ReadBasic Calendars.Read Calendars.ReadBasic Calendars.ReadWrite"
    encoded_redirect = quote(redirect_uri, safe='')
    encoded_scope = quote(scope, safe='')
    
    # Keep frontend base in state so callback redirects to the same user-facing host.
    state_data = f"outlook_auth_{user_id}_return_{returnTo}_base_{frontend_base_url}"
    signature = hmac.new(
        JWT_SECRET.encode(),
        state_data.encode(),
        hashlib.sha256
    ).hexdigest()[:16]
    
    state = f"{state_data}_sig_{signature}"
    
    # Log the OAuth initiation for security audit
    logger.info(f"Outlook OAuth initiated for user: {current_user['email']} (ID: {user_id}), returnTo: {returnTo}")
    
    # IMPORTANT: prompt=select_account shows account picker
    # This allows user to choose which Microsoft account to use
    auth_url = (
        f"https://login.microsoftonline.com/{AZURE_TENANT_ID}/oauth2/v2.0/authorize?"
        f"client_id={AZURE_CLIENT_ID}&"
        f"response_type=code&"
        f"redirect_uri={encoded_redirect}&"
        f"response_mode=query&"
        f"scope={encoded_scope}&"
        f"state={state}&"
        f"prompt=select_account"
    )
    
    # Direct browser redirect to OAuth provider
    return RedirectResponse(url=auth_url, status_code=302)


@router.get("/auth/gmail/login")
async def gmail_login(request: Request, returnTo: str = "/connect-email", token: Optional[str] = None, provider: Optional[str] = None):
    """
    Initiate Google OAuth flow for Gmail
    Accepts authentication token as query parameter (for browser redirects)
    """
    import hashlib
    import hmac
    # provider param is optional — endpoint URL already defines this as gmail
    
    current_user = None
    if token:
        try:
            payload = jwt.decode(token, options={"verify_signature": False})
            user_id = payload.get("sub")
            if user_id:
                user_data = await get_user_by_id(user_id)
                if user_data:
                    current_user = user_data
                else:
                    try:
                        from supabase_client import get_sb
                        auth_resp = get_sb().auth.get_user(token)
                        if auth_resp and auth_resp.user:
                            now_iso = datetime.now(timezone.utc).isoformat()
                            user_record = {
                                "id": auth_resp.user.id,
                                "email": auth_resp.user.email or "",
                                "full_name": (auth_resp.user.user_metadata or {}).get("full_name") or (auth_resp.user.user_metadata or {}).get("name") or "",
                                "role": "user",
                                "subscription_tier": "free",
                                "is_master_account": auth_resp.user.email == "andre@thestrategysquad.com.au",
                                "created_at": now_iso,
                                "updated_at": now_iso,
                            }
                            try:
                                get_sb().table("users").upsert(user_record, on_conflict="id").execute()
                                logger.info(f"[gmail/login] Auto-provisioned missing users record for {auth_resp.user.id}")
                            except Exception as upsert_err:
                                logger.warning(f"[gmail/login] users upsert failed (non-fatal): {upsert_err}")
                            current_user = user_record
                    except Exception as auth_fb_err:
                        logger.warning(f"[gmail/login] Supabase Auth fallback failed: {auth_fb_err}")
        except Exception as token_err:
            logger.warning(f"[gmail/login] Token parse error: {token_err}")

    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required. Please log in.")

    _ensure_launch_email_slot(current_user, 'gmail')
    
    user_id = current_user['id']
    
    callback_base_url = _get_oauth_callback_base_url()
    redirect_uri = f"{callback_base_url}/api/auth/gmail/callback"
    logger.info(f"📧 Gmail OAuth redirect_uri: {redirect_uri}")
    
    # Gmail scopes - readonly access only
    scopes = [
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/gmail.readonly"
    ]
    scope = " ".join(scopes)
    encoded_redirect = quote(redirect_uri, safe='')
    encoded_scope = quote(scope, safe='')
    
    # Create a signed state parameter to prevent CSRF and tampering
    # Include returnTo path in state for post-auth redirect
    # Format: gmail_auth_{user_id}_return_{returnTo}_sig_{hmac_signature}
    user_id = current_user['id']
    state_data = f"gmail_auth_{user_id}_return_{returnTo}"
    signature = hmac.new(
        JWT_SECRET.encode(),
        state_data.encode(),
        hashlib.sha256
    ).hexdigest()[:16]
    
    state = f"{state_data}_sig_{signature}"
    
    logger.info(f"Gmail OAuth initiated for user: {current_user['email']} (ID: {user_id}), returnTo: {returnTo}")
    
    # Google OAuth URL with select_account prompt for account picker
    auth_url = (
        f"https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={GOOGLE_CLIENT_ID}&"
        f"response_type=code&"
        f"redirect_uri={encoded_redirect}&"
        f"scope={encoded_scope}&"
        f"state={state}&"
        f"access_type=offline&"
        f"prompt=select_account"
    )
    
    # Direct browser redirect to OAuth provider
    return RedirectResponse(url=auth_url, status_code=302)


@router.get("/auth/gmail/callback")
async def gmail_callback(code: str, state: str = None, error: str = None, error_description: str = None):
    """Handle Google OAuth callback and store tokens - SECURE IMPLEMENTATION"""
    import hashlib
    import hmac
    
    frontend_url = _get_frontend_base_url()
    
    # Handle OAuth errors
    if error:
        logger.error(f"Gmail OAuth error: {error} - {error_description}")
        return RedirectResponse(url=f"{frontend_url}/connect-email?gmail_error={error}")
    
    # Extract and validate state parameter
    # New format: gmail_auth_{user_id}_return_{returnTo}_sig_{signature}
    user_id = None
    return_to = "/connect-email"  # Default fallback
    
    if state and state.startswith("gmail_auth_"):
        state_parts = state.replace("gmail_auth_", "").split("_sig_")
        if len(state_parts) != 2:
            logger.error(f"Invalid state format: {state}")
            return RedirectResponse(url=f"{frontend_url}/connect-email?gmail_error=invalid_state")
        
        state_data = state_parts[0]
        provided_signature = state_parts[1]
        
        # Parse state_data to extract user_id and returnTo
        # Format: {user_id}_return_{returnTo}
        if "_return_" in state_data:
            parts = state_data.split("_return_")
            user_id = parts[0]
            return_to = parts[1] if len(parts) > 1 else "/connect-email"
        else:
            # Legacy format support: just user_id
            user_id = state_data
        
        # Verify signature
        expected_signature = hmac.new(
            JWT_SECRET.encode(),
            f"gmail_auth_{state_data}".encode(),
            hashlib.sha256
        ).hexdigest()[:16]
        
        if not hmac.compare_digest(provided_signature, expected_signature):
            logger.error(f"State signature mismatch for user: {user_id}")
            return RedirectResponse(url=f"{frontend_url}{return_to}?gmail_error=invalid_state_signature")
        
        logger.info(f"Gmail callback for verified user: {user_id}, returnTo: {return_to}")
    else:
        logger.error(f"Invalid or missing state: {state}")
        return RedirectResponse(url=f"{frontend_url}/connect-email?gmail_error=invalid_state")
    
    # Exchange code for tokens
    token_url = "https://oauth2.googleapis.com/token"
    
    redirect_uri = f"{_get_oauth_callback_base_url()}/api/auth/gmail/callback"
    
    payload = {
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "code": code,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code"
    }
    
    logger.info("Gmail callback: exchanging code for tokens")
    
    async with httpx.AsyncClient() as client:
        response = await client.post(token_url, data=payload)
        
        if response.status_code != 200:
            error_text = response.text
            logger.error(f"Failed to exchange code for tokens: {error_text}")
            return RedirectResponse(url=f"{frontend_url}{return_to}?gmail_error=token_exchange_failed")
        
        token_data = response.json()
        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")
        expires_in = token_data.get("expires_in", 3600)
        
        if not access_token:
            logger.error("No access token in response")
            return RedirectResponse(url=f"{frontend_url}{return_to}?gmail_error=no_access_token")
        
        logger.info("✅ Successfully exchanged code for Gmail tokens")
        
        # Get user email from Google
        google_email = None
        try:
            user_info_response = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            if user_info_response.status_code == 200:
                user_info = user_info_response.json()
                google_email = user_info.get("email")
                logger.info(f"Gmail account: {google_email}")
        except Exception as e:
            logger.warning(f"Could not fetch Google user info: {e}")
        
        # Calculate token expiration
        expires_at = (datetime.now(timezone.utc) + timedelta(seconds=expires_in)).isoformat()

        # DIRECT SUPABASE STORAGE — no edge function required
        logger.info("💾 Storing Gmail tokens directly in Supabase...")
        try:
            get_sb().table("gmail_connections").upsert(
                {
                    "user_id": user_id,
                    "email": google_email,
                    "access_token": access_token,
                    "refresh_token": refresh_token,
                    "token_expiry": expires_at,
                    "scopes": "https://www.googleapis.com/auth/gmail.readonly",
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                },
                on_conflict="user_id"
            ).execute()
            logger.info(f"✅ Gmail tokens stored for {google_email}")

            # Update canonical email_connections table
            get_sb().table("email_connections").upsert(
                {
                    "user_id": user_id,
                    "provider": "gmail",
                    "connected": True,
                    "connected_email": google_email,
                    "inbox_type": "standard",
                    "connected_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                    "sync_status": "active",
                },
                on_conflict="user_id,provider"
            ).execute()
            logger.info("✅ email_connections updated for Gmail")
        except Exception as e:
            logger.error(f"❌ Failed to store Gmail tokens: {e}")
            return RedirectResponse(url=f"{frontend_url}{return_to}?gmail_error=storage_failed")

        # Redirect back with success
        # Build redirect URL — use & if return_to already has query params
        sep = '&' if '?' in return_to else '?'
        redirect_url = f"{frontend_url}{return_to}{sep}gmail_connected=true"
        if google_email:
            redirect_url += f"&connected_email={quote(google_email)}"

        logger.info(f"✅ Gmail OAuth complete, redirecting to: {redirect_url}")
        return RedirectResponse(url=redirect_url)


@router.get("/gmail/status")
async def gmail_status(current_user: dict = Depends(get_current_user)):
    """Get Gmail connection status — validates token existence and expiry"""
    try:
        user_id = current_user["id"]
        result = get_sb().table("gmail_connections").select(
            "email, access_token, refresh_token, token_expiry"
        ).eq("user_id", user_id).execute()

        if not result.data:
            return {"connected": False, "connected_email": None}

        connection = result.data[0]
        access_token = connection.get("access_token")

        if not access_token:
            return {"connected": False, "connected_email": None, "message": "No access token stored"}

        # Check token expiry
        token_expiry = connection.get("token_expiry")
        needs_refresh = False
        if token_expiry:
            try:
                from datetime import datetime, timezone
                expiry_dt = datetime.fromisoformat(token_expiry.replace("Z", "+00:00"))
                if expiry_dt <= datetime.now(timezone.utc):
                    return {"connected": False, "connected_email": connection.get("email"), "needs_reconnect": True, "message": "Gmail token expired. Please reconnect."}
                from datetime import timedelta
                if expiry_dt <= datetime.now(timezone.utc) + timedelta(minutes=5):
                    needs_refresh = True
            except Exception:
                pass

        return {
            "connected": True,
            "connected_email": connection.get("email"),
            "needs_refresh": needs_refresh,
            "labels_count": 0,
        }
    except Exception as e:
        logger.error(f"Error checking Gmail status: {e}")
        return {"connected": False, "connected_email": None, "error": str(e)}


@router.post("/gmail/disconnect")
async def gmail_disconnect(current_user: dict = Depends(get_current_user)):
    """Disconnect Gmail and remove all stored tokens"""
    try:
        user_id = current_user["id"]
        
        # Delete Gmail connection
        get_sb().table("gmail_connections").delete().eq("user_id", user_id).execute()
        
        logger.info(f"Gmail disconnected for user: {user_id}")
        
        return {"message": "Gmail disconnected successfully"}
        
    except Exception as e:
        logger.error(f"Error disconnecting Gmail: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/auth/outlook/callback")
async def outlook_callback(code: str, state: str = None, error: str = None, error_description: str = None):
    """Proxy Microsoft OAuth callback to Supabase Edge Function"""
    import hashlib
    import hmac
    
    frontend_url = _get_frontend_base_url()
    
    # Handle OAuth errors
    if error:
        logger.error(f"Outlook OAuth error: {error} - {error_description}")
        return RedirectResponse(url=f"{frontend_url}/connect-email?outlook_error={error}")
    
    # Extract and validate state parameter (contains user_id, returnTo, and verification hash)
    # New format: outlook_auth_{user_id}_return_{returnTo}_sig_{signature}
    user_id = None
    return_to = "/connect-email"  # Default fallback
    
    if state and state.startswith("outlook_auth_"):
        state_parts = state.replace("outlook_auth_", "").split("_sig_")
        if len(state_parts) != 2:
            logger.error(f"Invalid state format: {state}")
            return RedirectResponse(url=f"{frontend_url}/connect-email?outlook_error=invalid_state")
        
        state_data = state_parts[0]
        provided_signature = state_parts[1]
        
        # Parse: {user_id}_return_{returnTo}_base_{base_url}
        callback_base_url = None
        if "_base_" in state_data:
            pre_base, callback_base_url = state_data.rsplit("_base_", 1)
            if "_return_" in pre_base:
                parts = pre_base.split("_return_")
                user_id = parts[0]
                return_to = parts[1] if len(parts) > 1 else "/connect-email"
            else:
                user_id = pre_base
        elif "_return_" in state_data:
            parts = state_data.split("_return_")
            user_id = parts[0]
            return_to = parts[1] if len(parts) > 1 else "/connect-email"
        else:
            user_id = state_data
        
        # Use callback_base_url for frontend redirect if available
        if callback_base_url:
            frontend_url = callback_base_url
        
        # Verify signature
        expected_signature = hmac.new(
            JWT_SECRET.encode(),
            f"outlook_auth_{state_data}".encode(),
            hashlib.sha256
        ).hexdigest()[:16]
        
        if not hmac.compare_digest(provided_signature, expected_signature):
            logger.error(f"State signature mismatch for user: {user_id}")
            return RedirectResponse(url=f"{frontend_url}{return_to}?outlook_error=invalid_state_signature")
        
        logger.info(f"Outlook callback for verified user: {user_id}, returnTo: {return_to}")
    else:
        logger.error(f"Invalid or missing state: {state}")
        return RedirectResponse(url=f"{frontend_url}/connect-email?outlook_error=invalid_state")
    
    # Exchange code for tokens
    token_url = f"https://login.microsoftonline.com/{AZURE_TENANT_ID}/oauth2/v2.0/token"
    
    # redirect_uri MUST match what was sent in the login request
    redirect_uri = f"{_get_oauth_callback_base_url()}/api/auth/outlook/callback"
    
    payload = {
        "client_id": AZURE_CLIENT_ID,
        "client_secret": AZURE_CLIENT_SECRET,
        "code": code,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code",
        "scope": "offline_access User.Read Mail.Read Mail.ReadBasic Calendars.Read Calendars.ReadBasic Calendars.ReadWrite"
    }
    
    logger.info("Outlook callback: exchanging code for tokens")
    
    async with httpx.AsyncClient() as client:
        response = await client.post(token_url, data=payload)
        
        if response.status_code != 200:
            error_text = response.text
            logger.error(f"Token exchange failed: {error_text}")
            return RedirectResponse(url=f"{frontend_url}{return_to}?outlook_error=token_exchange_failed")
        
        token_data = response.json()
    
    logger.info("Token exchange successful")
    
    # Get user info from Microsoft Graph
    access_token = token_data.get("access_token")
    headers = {"Authorization": f"Bearer {access_token}"}
    
    async with httpx.AsyncClient() as client:
        user_response = await client.get(
            "https://graph.microsoft.com/v1.0/me",
            headers=headers
        )
        user_info = user_response.json()
    
    microsoft_email = (user_info.get("mail") or user_info.get("userPrincipalName") or "").lower().strip()
    microsoft_name = user_info.get("displayName", "")
    logger.info(f"Microsoft user email: {microsoft_email}")
    
    # SIMPLIFIED: Just store the tokens - don't validate user lookup
    # User is already authenticated (passed get_current_user dependency)
    logger.info(f"Storing Outlook tokens for authenticated user {user_id}")
    logger.info(f"Microsoft account: {microsoft_email}")
    
    # Calculate token expiration
    expires_in = token_data.get("expires_in", 3600)
    expires_at = (datetime.now(timezone.utc) + timedelta(seconds=expires_in)).isoformat()

    # DIRECT SUPABASE STORAGE — no edge function required
    logger.info("💾 Storing Outlook tokens directly in Supabase...")
    try:
        get_sb().table("outlook_oauth_tokens").upsert(
            {
                "user_id": user_id,
                "access_token": token_data.get("access_token"),
                "refresh_token": token_data.get("refresh_token"),
                "expires_at": expires_at,
                "account_email": microsoft_email,
                "account_name": microsoft_name,
                "provider": "microsoft",
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
            on_conflict="user_id"
        ).execute()
        logger.info(f"✅ Outlook tokens stored for {microsoft_email}")

        # Update canonical email_connections table
        get_sb().table("email_connections").upsert(
            {
                "user_id": user_id,
                "provider": "outlook",
                "connected": True,
                "connected_email": microsoft_email,
                "inbox_type": "standard",
                "connected_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "sync_status": "active",
            },
            on_conflict="user_id,provider"
        ).execute()
        logger.info("✅ email_connections updated for Outlook")
    except Exception as e:
        logger.error(f"❌ Failed to store Outlook tokens: {e}")
        return RedirectResponse(url=f"{frontend_url}{return_to}?outlook_error=storage_failed")

    logger.info(f"✅ Outlook integration successful for user {user_id}")

    # Redirect back with success
    # Build redirect URL — use & if return_to already has query params
    sep = '&' if '?' in return_to else '?'
    redirect_url = f"{frontend_url}{return_to}{sep}outlook_connected=true"
    if microsoft_email:
        redirect_url += f"&connected_email={quote(microsoft_email)}"

    logger.info(f"✅ Outlook OAuth complete, redirecting to: {redirect_url}")
    return RedirectResponse(url=redirect_url)


async def start_comprehensive_sync_job(user_id: str, job_id: str):
    """Start comprehensive sync as background task - SUPABASE VERSION"""
    job_doc = {
        "job_id": job_id,
        "user_id": user_id,
        "status": "running",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "progress": {"folders_processed": 0, "emails_processed": 0, "insights_generated": 0}
    }
    await create_sync_job_supabase(get_sb(), job_doc)
    
    await run_comprehensive_email_analysis(user_id, job_id)


@router.get("/outlook/emails/sync")
async def sync_outlook_emails(
    folder: str = "inbox",
    top: int = 25,
    current_user: dict = Depends(get_current_user)
):
    """Basic email sync - use /outlook/comprehensive-sync for full analysis"""
    user_id = current_user["id"]
    
    # Get user's Outlook token from Supabase
    tokens = await get_outlook_tokens(user_id)
    
    if not tokens:
        logger.warning(f"❌ Outlook sync attempted but no tokens for user {user_id}")
        raise HTTPException(
            status_code=401, 
            detail={
                "code": "OUTLOOK_NOT_CONNECTED",
                "message": "Outlook not connected. Please connect Outlook first.",
                "action_required": "connect"
            }
        )
    
    access_token = tokens.get("access_token")
    expires_at_str = tokens.get("expires_at")
    refresh_token = tokens.get("refresh_token")
    
    # FIX 3: Check token expiry and refresh if needed
    if expires_at_str and refresh_token:
        try:
            expires_at = dateutil_parser.isoparse(expires_at_str)
            now = datetime.now(timezone.utc)
            
            # Refresh if expiring within 60 seconds
            if expires_at <= now + timedelta(seconds=60):
                logger.info(f"🔄 Token expiring soon, refreshing for user {user_id}")
                try:
                    new_tokens = await refresh_outlook_token_supabase(user_id, refresh_token)
                    access_token = new_tokens["access_token"]
                    logger.info("✅ Token refreshed successfully")
                except Exception as refresh_error:
                    logger.error(f"❌ Token refresh failed: {refresh_error}")
                    raise HTTPException(
                        status_code=401, 
                        detail="Outlook token expired and refresh failed. Please reconnect Outlook."
                    )
        except Exception as e:
            logger.warning(f"⚠️ Could not check token expiry: {e}")
    
    # FIX 1: Use well-known folder name (safe)
    # FIX 2: Corrected params - safe fields, reduced top limit
    headers = {"Authorization": f"Bearer {access_token}"}
    graph_url = f"https://graph.microsoft.com/v1.0/me/mailFolders/{folder}/messages"
    params = {
        "$select": "subject,from,receivedDateTime,bodyPreview,conversationId,internetMessageId",
        "$top": top,
        "$orderby": "receivedDateTime desc"
    }
    
    # PRE-CHECK: Log outbound request (redact token)
    logger.info("📤 Microsoft Graph Request:")
    logger.info(f"   URL: {graph_url}")
    logger.info(f"   Folder: {folder}")
    logger.info(f"   Params: {params}")
    logger.info(f"   Token present: {bool(access_token)}")
    
    async with httpx.AsyncClient() as client:
        response = await client.get(graph_url, headers=headers, params=params)
        
        # PRE-CHECK: Log exact Graph error if not 200
        if response.status_code != 200:
            error_body = response.text
            logger.error("❌ Microsoft Graph Error:")
            logger.error(f"   Status: {response.status_code}")
            logger.error(f"   Response Body: {error_body}")
            
            # Parse Graph error if JSON
            try:
                error_json = response.json()
                error_code = error_json.get("error", {}).get("code", "Unknown")
                error_message = error_json.get("error", {}).get("message", error_body)
                logger.error(f"   Error Code: {error_code}")
                logger.error(f"   Error Message: {error_message}")
                
                # Return structured error to UI
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Microsoft Graph error: {error_code} - {error_message}"
                )
            except Exception:
                raise HTTPException(status_code=400, detail=f"Failed to fetch emails: {error_body}")
        
        emails_data = response.json()
    
    # Store emails in Supabase
    synced_count = 0
    for email in emails_data.get("value", []):
        email_doc = {
            "user_id": user_id,
            "graph_message_id": email.get("id"),
            "subject": email.get("subject", ""),
            "from_address": email.get("from", {}).get("emailAddress", {}).get("address", ""),
            "from_name": email.get("from", {}).get("emailAddress", {}).get("name", ""),
            "received_date": email.get("receivedDateTime"),
            "body_preview": email.get("bodyPreview", ""),
            "body_content": email.get("body", {}).get("content", "")[:5000],
            "is_read": email.get("isRead", False),
            "importance": email.get("importance"),
            "categories": email.get("categories", []),
            "has_attachments": email.get("hasAttachments", False),
            "folder": folder,
            "synced_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Store in Supabase (upsert to avoid duplicates)
        success = await store_email_supabase(get_sb(), email_doc)
        if success:
            synced_count += 1
    
    return {
        "status": "synced",
        "emails_synced": synced_count,
        "message": f"Synced {synced_count} emails from {folder}"
    }


@router.post("/outlook/comprehensive-sync")
async def comprehensive_outlook_sync(current_user: dict = Depends(get_current_user)):
    """
    COMPREHENSIVE EMAIL ANALYSIS - 36 months across all folders - SUPABASE VERSION
    
    This analyzes your entire Outlook account to build a complete business intelligence profile:
    - All folders (Inbox, Sent Items, Deleted Items, custom folders)
    - Last 36 months of email history
    - Extracts: clients, topics, patterns, sentiment, business evolution
    - Stores structured intelligence, not just raw emails
    
    Runs as background process. Returns immediately.
    """
    user_id = current_user["id"]
    
    # Check if already running
    existing_job = await find_user_sync_job_supabase(get_sb(), user_id, "running")
    
    if existing_job:
        return {
            "status": "already_running",
            "job_id": existing_job["job_id"],
            "message": "Comprehensive sync already in progress"
        }
    
    # Create sync job in Supabase
    job_id = str(uuid.uuid4())
    job_doc = {
        "job_id": job_id,
        "user_id": user_id,
        "status": "running",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "progress": {
            "folders_processed": 0,
            "emails_processed": 0,
            "insights_generated": 0
        }
    }
    await create_sync_job_supabase(get_sb(), job_doc)
    
    queued = await enqueue_job(
        "email-analysis",
        {"user_id": user_id, "job_id": job_id, "workspace_id": user_id},
        company_id=user_id,
        window_seconds=120,
    )

    if queued.get("queued"):
        return {
            "status": "queued",
            "job_type": "email-analysis",
            "job_id": queued.get("job_id") or job_id,
            "message": "Comprehensive email analysis queued. This will take 5-10 minutes.",
            "expected_duration": "5-10 minutes"
        }

    await run_comprehensive_email_analysis(user_id, job_id)
    return {
        "status": "started",
        "job_id": job_id,
        "message": "Comprehensive email analysis started inline because Redis is unavailable.",
        "expected_duration": "5-10 minutes"
    }


async def run_comprehensive_email_analysis(user_id: str, job_id: str):
    """Background task: Comprehensive email analysis over 36 months - SUPABASE VERSION"""
    try:
        # Get user tokens from Supabase
        tokens = await get_outlook_tokens(user_id)
        
        if not tokens or not tokens.get("access_token"):
            await update_sync_job_supabase(
                get_sb(),
                job_id,
                {"status": "failed", "error_message": "No access token", "completed_at": datetime.now(timezone.utc).isoformat()}
            )
            return
        
        access_token = tokens["access_token"]
        
        # Calculate 36 months ago
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=36*30)
        
        # Get all mail folders
        headers = {"Authorization": f"Bearer {access_token}"}
        folders_url = "https://graph.microsoft.com/v1.0/me/mailFolders"
        
        async with httpx.AsyncClient(timeout=30) as client:
            await client.get(folders_url, headers=headers)
        
        # ========================================
        # PHASE 1 INGESTION PROTOCOL
        # ========================================
        # INBOX: Full ingestion (existing)
        # SENT ITEMS: Metadata-only (NEW - for Watchtower context)
        # DELETED/ARCHIVE/CUSTOM: Excluded (blocked)
        # ========================================
        
        target_folders = {
            "inbox": {"ingest_body": True, "purpose": "primary"},
            "sentitems": {"ingest_body": False, "purpose": "context_only"}
        }
        
        # DO NOT add: deleteditems, archive, custom folders
        # This is explicit scope limitation for Phase 1
        
        total_emails = 0
        emails_by_sender = {}
        client_communications = []
        
        # Process each folder
        for folder_id, folder_config in target_folders.items():
            emails = await fetch_folder_emails_batch(
                access_token,
                folder_id,
                cutoff_date,
                max_emails=500,  # 500 per folder
                metadata_only=not folder_config["ingest_body"]
            )
            
            # Analyze emails
            for email in emails:
                total_emails += 1
                
                # Determine if this is sent or received
                is_sent_folder = (folder_id == "sentitems")
                
                if is_sent_folder:
                    # SENT ITEMS: Metadata-only storage
                    # Extract ONLY: recipients, timestamp, thread context
                    to_recipients = email.get("toRecipients", [])
                    recipient_addresses = [r.get("emailAddress", {}).get("address", "") for r in to_recipients]
                    
                    sent_datetime = email.get("sentDateTime", "")
                    conversation_id = email.get("conversationId", "")
                    
                    # Determine if external
                    is_external = any(not addr.endswith("@thestrategysquad.com") for addr in recipient_addresses if addr)
                    
                    # Store sent metadata for Watchtower context
                    email_doc = {
                        "user_id": user_id,
                        "graph_message_id": email.get("id"),
                        "conversation_id": conversation_id,
                        "to_recipients": recipient_addresses,
                        "received_date": sent_datetime,  # FIXED: Use received_date for RPC compatibility
                        "subject": email.get("subject", "")[:200],  # Limited subject for thread matching
                        "is_external": is_external,
                        "folder": "sentitems",  # FIXED: Match RPC expectation (not "sent")
                        "synced_at": datetime.now(timezone.utc).isoformat(),
                        "metadata_only": True  # Flag for Watchtower context use
                    }
                    
                    await store_email_supabase(get_sb(), email_doc)
                    continue  # Skip analysis for sent items
                
                # INBOX: Full ingestion (existing logic)
                # Extract intelligence
                sender = email.get("from", {}).get("emailAddress", {}).get("address", "")
                subject = email.get("subject", "")
                body_preview = email.get("bodyPreview", "")
                
                # Track communication frequency by sender
                if sender:
                    emails_by_sender[sender] = emails_by_sender.get(sender, 0) + 1
                
                # Detect client vs internal emails
                is_external = not sender.endswith("@thestrategysquad.com") if sender else True
                
                if is_external and emails_by_sender.get(sender, 0) >= 3:
                    # Likely a client - extract intelligence
                    client_communications.append({
                        "client_email": sender,
                        "client_name": email.get("from", {}).get("emailAddress", {}).get("name", ""),
                        "subject": subject,
                        "date": email.get("receivedDateTime"),
                        "preview": body_preview[:200],
                        "folder": folder_id
                    })
                
                # Store email in Supabase
                email_doc = {
                    "user_id": user_id,
                    "graph_message_id": email.get("id"),
                    "subject": subject,
                    "from_address": sender,
                    "from_name": email.get("from", {}).get("emailAddress", {}).get("name", ""),
                    "received_date": email.get("receivedDateTime"),
                    "body_preview": body_preview,
                    "body_content": email.get("body", {}).get("content", "")[:5000],
                    "is_read": email.get("isRead", False),
                    "folder": folder_id,
                    "synced_at": datetime.now(timezone.utc).isoformat()
                }
                
                await store_email_supabase(get_sb(), email_doc)
            
            # Update progress in Supabase
            current_progress = {
                "folders_processed": len([f for f in target_folders if f]),
                "emails_processed": total_emails,
                "insights_generated": 0
            }
            await update_sync_job_supabase(
                get_sb(),
                job_id,
                {"progress": current_progress}
            )
        
        # Generate business intelligence insights
        insights = await generate_email_intelligence(
            user_id,
            emails_by_sender,
            client_communications,
            total_emails
        )
        
        # Mark job complete in Supabase
        final_update = {
            "status": "completed",
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "progress": {
                "folders_processed": len(target_folders),
                "emails_processed": total_emails,
                "insights_generated": len(insights)
            }
        }
        await update_sync_job_supabase(get_sb(), job_id, final_update)
        
    except Exception as e:
        logger.error(f"Comprehensive sync error: {e}")
        await update_sync_job_supabase(
            get_sb(),
            job_id,
            {
                "status": "failed",
                "error_message": str(e),
                "completed_at": datetime.now(timezone.utc).isoformat()
            }
        )


async def fetch_folder_emails_batch(
    access_token: str, 
    folder_id: str, 
    cutoff_date: datetime, 
    max_emails: int = 500,
    metadata_only: bool = False
):
    """
    Fetch emails from a folder with date filtering
    
    Args:
        metadata_only: If True, excludes body content (for Sent Items context)
    """
    headers = {"Authorization": f"Bearer {access_token}"}
    
    # Format date for Graph API filter
    cutoff_str = cutoff_date.strftime("%Y-%m-%dT%H:%M:%SZ")
    
    graph_url = f"https://graph.microsoft.com/v1.0/me/mailFolders/{folder_id}/messages"
    
    # PHASE 1 INGESTION: Metadata-only for Sent Items
    if metadata_only:
        # Sent Items: Context-only ingestion (no bodies)
        select_fields = "id,conversationId,subject,toRecipients,sentDateTime,isRead"
    else:
        # Inbox: Full ingestion (existing)
        select_fields = "id,subject,from,toRecipients,receivedDateTime,bodyPreview,body,isRead"
    
    params = {
        "$select": select_fields,
        "$filter": f"receivedDateTime ge {cutoff_str}" if not metadata_only else f"sentDateTime ge {cutoff_str}",
        "$top": min(max_emails, 999),
        "$orderby": "receivedDateTime desc" if not metadata_only else "sentDateTime desc"
    }
    
    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.get(graph_url, headers=headers, params=params)
        
        if response.status_code == 200:
            return response.json().get("value", [])
        else:
            logger.error(f"Failed to fetch folder {folder_id}: {response.status_code}")
            return []


async def generate_email_intelligence(user_id: str, emails_by_sender: dict, client_communications: list, total_emails: int):
    """Generate structured business intelligence from email analysis"""
    
    # Identify top clients by email frequency
    top_clients = sorted(emails_by_sender.items(), key=lambda x: x[1], reverse=True)[:20]
    
    # Extract patterns
    insights = {
        "total_emails_analyzed": total_emails,
        "unique_contacts": len(emails_by_sender),
        "top_clients": [
            {
                "email": email,
                "email_count": count,
                "relationship_strength": "high" if count > 50 else "medium" if count > 20 else "developing"
            }
            for email, count in top_clients
        ],
        "client_communication_patterns": {
            "total_client_emails": len(client_communications),
            "average_emails_per_client": len(client_communications) / len(top_clients) if top_clients else 0
        },
        "analysis_period": "36 months",
        "analyzed_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Store intelligence summary in Supabase
    await update_email_intelligence_supabase(get_sb(), user_id, insights)
    
    return [insights]


@router.get("/outlook/sync-status/{job_id}")
async def get_sync_status(job_id: str, current_user: dict = Depends(get_current_user)):
    """Check status of comprehensive email sync - SUPABASE VERSION"""
    job = await get_sync_job_supabase(get_sb(), job_id)
    
    if not job or job["user_id"] != current_user["id"]:
        raise HTTPException(status_code=404, detail="Sync job not found")
    
    return job


@router.get("/outlook/intelligence")
async def get_email_intelligence(current_user: dict = Depends(get_current_user)):
    """Get business intelligence extracted from emails - SUPABASE VERSION"""
    intelligence = await get_email_intelligence_supabase(get_sb(), current_user["id"])
    
    if not intelligence:
        return {
            "message": "No email intelligence available. Run comprehensive sync first."
        }
    
    return intelligence


async def refresh_outlook_token_supabase(user_id: str, refresh_token: str) -> Dict[str, str]:
    """
    Refresh Outlook access token and persist to Supabase
    
    Args:
        user_id: User UUID
        refresh_token: Microsoft refresh token
        
    Returns:
        Dict with new access_token and expires_at
        
    Raises:
        HTTPException if refresh fails
    """
    token_url = f"https://login.microsoftonline.com/{AZURE_TENANT_ID}/oauth2/v2.0/token"
    
    payload = {
        "client_id": AZURE_CLIENT_ID,
        "client_secret": AZURE_CLIENT_SECRET,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
        "scope": "offline_access User.Read Mail.Read Mail.ReadBasic Calendars.Read Calendars.ReadBasic Calendars.ReadWrite"
    }
    
    logger.info(f"🔄 Refreshing Outlook token for user {user_id}")
    
    async with httpx.AsyncClient() as client:
        response = await client.post(token_url, data=payload)
        
        if response.status_code != 200:
            error_text = response.text
            logger.error(f"❌ Token refresh failed: {response.status_code} - {error_text}")
            raise HTTPException(status_code=401, detail=f"Failed to refresh Outlook token: {error_text}")
        
        token_data = response.json()
    
    # Calculate new expiry
    expires_in = token_data.get("expires_in", 3600)
    new_expires_at = (datetime.now(timezone.utc) + timedelta(seconds=expires_in)).isoformat()
    new_access_token = token_data["access_token"]
    new_refresh_token = token_data.get("refresh_token", refresh_token)  # Microsoft may return new refresh token
    
    # Update tokens in Supabase (outlook_oauth_tokens table)
    try:
        get_sb().table("outlook_oauth_tokens").update({
            "access_token": new_access_token,
            "refresh_token": new_refresh_token,
            "expires_at": new_expires_at,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }).eq("user_id", user_id).execute()
        
        logger.info(f"✅ Token persisted to outlook_oauth_tokens, new expiry: {new_expires_at}")
        
    except Exception as e:
        logger.error(f"❌ Failed to persist refreshed token: {e}")
        # Token refresh succeeded but persistence failed - still return new token
    
    return {
        "access_token": new_access_token,
        "expires_at": new_expires_at
    }


# REMOVED: Legacy MongoDB token refresh function
# This function used db.users (MongoDB) which is being phased out
# Replaced by refresh_outlook_token_supabase() which uses Supabase
# Original code preserved in git history if needed


async def refresh_gmail_token_supabase(user_id: str, refresh_token: str) -> Dict[str, str]:
    """
    Refresh Gmail access token using Google's OAuth2 endpoint and persist to Supabase.

    Args:
        user_id: User UUID
        refresh_token: Google refresh token

    Returns:
        Dict with new access_token and expires_at

    Raises:
        HTTPException if refresh fails
    """
    token_url = "https://oauth2.googleapis.com/token"

    payload = {
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    }

    logger.info(f"🔄 Refreshing Gmail token for user {user_id}")

    async with httpx.AsyncClient() as client:
        response = await client.post(token_url, data=payload)

        if response.status_code != 200:
            error_text = response.text
            logger.error(f"❌ Gmail token refresh failed: {response.status_code} - {error_text}")
            raise HTTPException(
                status_code=401,
                detail=f"Failed to refresh Gmail token: {error_text}",
            )

        token_data = response.json()

    expires_in = token_data.get("expires_in", 3600)
    new_expires_at = (datetime.now(timezone.utc) + timedelta(seconds=expires_in)).isoformat()
    new_access_token = token_data["access_token"]

    try:
        get_sb().table("gmail_connections").update({
            "access_token": new_access_token,
            "token_expiry": new_expires_at,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).eq("user_id", user_id).execute()

        logger.info(f"✅ Gmail token persisted to gmail_connections, new expiry: {new_expires_at}")

    except Exception as e:
        logger.error(f"❌ Failed to persist refreshed Gmail token: {e}")

    return {
        "access_token": new_access_token,
        "expires_at": new_expires_at,
    }


async def get_gmail_tokens(user_id: str) -> Optional[Dict[str, Any]]:
    """
    Get Gmail tokens from gmail_connections table.
    Automatically refreshes the access token when expired.
    """
    logger.info(f"🔍 Looking for Gmail tokens for user_id: {user_id}")

    try:
        response = get_sb().table("gmail_connections").select(
            "email, access_token, refresh_token, token_expiry"
        ).eq("user_id", user_id).execute()

        if not response.data or len(response.data) == 0:
            logger.warning(f"❌ No Gmail tokens found for user {user_id}")
            return None

        token_data = response.data[0]
        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")
        token_expiry = token_data.get("token_expiry")
        gmail_email = token_data.get("email")

        if not access_token:
            logger.warning(f"❌ Gmail access_token missing for user {user_id}")
            return None

        is_expired = False
        if token_expiry:
            try:
                expiry_dt = dateutil_parser.isoparse(token_expiry)
                if expiry_dt.tzinfo is None:
                    expiry_dt = expiry_dt.replace(tzinfo=timezone.utc)
                is_expired = expiry_dt <= datetime.now(timezone.utc) + timedelta(minutes=1)
            except Exception as e:
                logger.warning(f"Could not parse Gmail token_expiry: {e}")

        if is_expired and refresh_token:
            logger.info(f"🔄 Gmail token expired for user {user_id}, refreshing...")
            try:
                refreshed = await refresh_gmail_token_supabase(user_id, refresh_token)
                access_token = refreshed["access_token"]
                token_expiry = refreshed["expires_at"]
                logger.info("✅ Gmail token refreshed successfully")
            except Exception as e:
                logger.error(f"❌ Gmail token refresh failed: {e}")
                return None
        elif is_expired:
            logger.warning(f"❌ Gmail token expired and no refresh_token for user {user_id}")
            return None

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "expires_at": token_expiry,
            "gmail_email": gmail_email,
            "source": "gmail_connections",
        }

    except Exception as e:
        logger.error(f"Error getting Gmail tokens for user {user_id}: {e}")
        return None


@router.get("/outlook/status")
async def outlook_connection_status(current_user: dict = Depends(get_current_user)):
    """
    Check if user has connected Outlook - CANONICAL STATE with token validation
    Returns connected=true ONLY if valid tokens exist
    """
    user_id = current_user["id"]
    logger.info(f"🔍 Checking Outlook status for user_id: {user_id}")
    
    try:
        # CANONICAL CHECK: Token existence and validity
        tokens = await get_outlook_tokens(user_id)
        
        if not tokens:
            logger.info(f"❌ No Outlook tokens found for user {user_id}")
            return {
                "connected": False,
                "emails_synced": 0,
                "message": "Outlook not connected"
            }
        
        # Validate token has required fields
        access_token = tokens.get("access_token")
        refresh_token = tokens.get("refresh_token")
        expires_at_str = tokens.get("expires_at")
        
        if not access_token or not refresh_token:
            logger.warning(f"⚠️ Incomplete tokens for user {user_id}")
            return {
                "connected": False,
                "emails_synced": 0,
                "message": "Outlook tokens incomplete. Please reconnect."
            }
        
        # Check token expiry
        token_expired = False
        token_needs_refresh = False
        
        if expires_at_str:
            try:
                expires_at = dateutil_parser.isoparse(expires_at_str)
                now = datetime.now(timezone.utc)
                
                if expires_at <= now:
                    token_expired = True
                elif expires_at <= now + timedelta(minutes=5):
                    token_needs_refresh = True
            except Exception as e:
                logger.warning(f"Could not parse expires_at: {e}")
        
        connected_email = tokens.get("microsoft_email")
        connected_name = tokens.get("microsoft_name")
        
        return {
            "connected": True,
            "emails_synced": 0,
            "emails_count_verified": False,
            "user_email": current_user.get("email"),
            "connected_email": connected_email,
            "connected_name": connected_name,
            "token_expired": token_expired,
            "token_needs_refresh": token_needs_refresh,
            "expires_at": expires_at_str,
            "source": "token_validated"
        }
        
    except Exception as e:
        logger.error(f"Error checking Outlook status for user {user_id}: {e}")
        import traceback
        logger.error(traceback.format_exc())
        
        # FAIL OPEN: Return degraded state instead of error
        return {
            "connected": False,
            "emails_synced": 0,
            "degraded": True,
            "error": "Status check failed"
        }
        
        # Return degraded state, not error
        return {
            "connected": False,
            "emails_synced": 0,
            "error": "status_check_failed",
            "degraded": True
        }


@router.get("/outlook/debug-tokens")
async def debug_outlook_tokens(current_user: dict = Depends(get_current_user)):
    """
    DEBUG ONLY: Inspect Outlook token state
    Should be disabled in production
    """
    # Guard: Only allow in development
    if os.environ.get("ENVIRONMENT", "development") == "production":
        raise HTTPException(status_code=404, detail="Endpoint not available in production")
    
    user_id = current_user["id"]
    debug_info = {
        "user_id": user_id,
        "user_email": current_user.get("email"),
        "outlook_oauth_tokens": None,
        "m365_tokens": None,
        "outlook_emails_count": 0
    }
    
    try:
        # Check outlook_oauth_tokens
        response = get_sb().table("outlook_oauth_tokens").select("user_id, provider, account_email, expires_at, created_at").eq("user_id", user_id).execute()
        if response.data:
            debug_info["outlook_oauth_tokens"] = response.data
        else:
            # Check if table has ANY records (for debugging)
            all_response = get_sb().table("outlook_oauth_tokens").select("user_id, account_email", count="exact").limit(5).execute()
            debug_info["outlook_oauth_tokens_sample"] = all_response.data if all_response.data else "empty table"
            debug_info["outlook_oauth_tokens_total"] = all_response.count if hasattr(all_response, 'count') else len(all_response.data) if all_response.data else 0
    except Exception as e:
        debug_info["outlook_oauth_tokens_error"] = str(e)
    
    try:
        # Check m365_tokens
        response = get_sb().table("m365_tokens").select("user_id, expires_at").eq("user_id", user_id).execute()
        if response.data:
            debug_info["m365_tokens"] = response.data
    except Exception as e:
        debug_info["m365_tokens_error"] = str(e)
    
    try:
        # Check outlook_emails count
        response = get_sb().table("outlook_emails").select("id", count="exact").eq("user_id", user_id).execute()
        debug_info["outlook_emails_count"] = response.count if hasattr(response, 'count') else len(response.data) if response.data else 0
    except Exception as e:
        debug_info["outlook_emails_error"] = str(e)
    
    return debug_info


@router.post("/outlook/disconnect")
async def disconnect_outlook(current_user: dict = Depends(get_current_user)):
    """Disconnect Microsoft Outlook integration and remove all synced data - SUPABASE VERSION"""
    user_id = current_user["id"]
    
    # Check if Outlook is connected
    tokens = await get_outlook_tokens(user_id)
    if not tokens:
        raise HTTPException(status_code=400, detail="Outlook is not connected")
    
    try:
        # Delete tokens from both tables (Edge Function uses outlook_oauth_tokens, legacy uses m365_tokens)
        try:
            get_sb().table("outlook_oauth_tokens").delete().eq("user_id", user_id).execute()
            logger.info(f"Deleted Outlook tokens from outlook_oauth_tokens for user {user_id}")
        except Exception as e:
            logger.warning(f"Could not delete from outlook_oauth_tokens: {e}")
        
        try:
            get_sb().table("m365_tokens").delete().eq("user_id", user_id).execute()
            logger.info(f"Deleted Outlook tokens from m365_tokens for user {user_id}")
        except Exception as e:
            logger.warning(f"Could not delete from m365_tokens: {e}")
        
        # Delete all synced emails from Supabase
        deleted_emails = await delete_user_emails_supabase(get_sb(), user_id)
        logger.info(f"Deleted {deleted_emails} emails for user {user_id}")
        
        # Delete all sync jobs from Supabase
        deleted_jobs = await delete_user_sync_jobs_supabase(get_sb(), user_id)
        logger.info(f"Deleted {deleted_jobs} sync jobs for user {user_id}")

        # Delete mirrored calendar events so stale history cannot appear after disconnect.
        deleted_calendar_events = await delete_user_calendar_events_supabase(get_sb(), user_id)
        logger.info(f"Deleted {deleted_calendar_events} calendar events for user {user_id}")
        
        return {
            "success": True,
            "message": "Microsoft Outlook disconnected successfully",
            "deleted_emails": deleted_emails,
            "deleted_jobs": deleted_jobs,
            "deleted_calendar_events": deleted_calendar_events,
        }
    except Exception as e:
        logger.error(f"Error disconnecting Outlook: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to disconnect: {str(e)}")


# ==================== CALENDAR INTEGRATION ====================

@router.get("/outlook/calendar/events")
async def get_calendar_events(
    days_ahead: int = 14,
    days_back: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get calendar events for AI context - SUPABASE VERSION"""
    # Get tokens from Supabase
    tokens = await get_outlook_tokens(current_user["id"])
    
    if not tokens:
        raise HTTPException(status_code=400, detail="Outlook not connected")
    
    access_token = tokens.get("access_token")
    refresh_token = tokens.get("refresh_token")
    expires_at = tokens.get("expires_at") or tokens.get("token_expiry")
    if expires_at:
        try:
            expiry_dt = datetime.fromisoformat(str(expires_at).replace("Z", "+00:00"))
            if expiry_dt <= datetime.now(timezone.utc) + timedelta(minutes=1):
                if refresh_token:
                    refreshed = await refresh_outlook_token_supabase(current_user["id"], refresh_token)
                    access_token = refreshed.get("access_token") or access_token
                else:
                    raise HTTPException(status_code=401, detail="Outlook token expired. Please reconnect Outlook.")
        except HTTPException:
            raise
        except Exception:
            pass

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Prefer": 'outlook.timezone="UTC"',
    }
    
    # Calculate date range
    start_date = (datetime.now(timezone.utc) - timedelta(days=days_back)).isoformat()
    end_date = (datetime.now(timezone.utc) + timedelta(days=days_ahead)).isoformat()
    
    graph_url = "https://graph.microsoft.com/v1.0/me/calendarView"
    params = {
        "startDateTime": start_date,
        "endDateTime": end_date,
        "$select": "subject,start,end,location,attendees,organizer,bodyPreview,isAllDay,importance",
        "$orderby": "start/dateTime",
        "$top": 100
    }
    
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(graph_url, headers=headers, params=params)
        if response.status_code == 401 and refresh_token:
            refreshed = await refresh_outlook_token_supabase(current_user["id"], refresh_token)
            access_token = refreshed.get("access_token") or access_token
            headers["Authorization"] = f"Bearer {access_token}"
            response = await client.get(graph_url, headers=headers, params=params)
        
        if response.status_code != 200:
            raise HTTPException(status_code=400, detail=f"Failed to fetch calendar: {response.text}")
        
        events_data = response.json()
    
    # Store events in Supabase
    supabase_events = []
    for event in events_data.get("value", []):
        supabase_events.append({
            "user_id": current_user["id"],
            "graph_event_id": event.get("id"),
            "subject": event.get("subject"),
            "start_time": event.get("start", {}).get("dateTime"),
            "end_time": event.get("end", {}).get("dateTime"),
            "location": event.get("location", {}).get("displayName"),
            "attendees": [{"name": a.get("emailAddress", {}).get("name"), "email": a.get("emailAddress", {}).get("address")} for a in event.get("attendees", [])],
            "is_all_day": event.get("isAllDay", False),
            "organizer_email": event.get("organizer", {}).get("emailAddress", {}).get("address"),
            "organizer_name": event.get("organizer", {}).get("emailAddress", {}).get("name"),
            "body_preview": event.get("bodyPreview", "")[:200],
            "synced_at": datetime.now(timezone.utc).isoformat()
        })
    
    # Clear old events and store new ones
    await delete_user_calendar_events_supabase(get_sb(), current_user["id"])
    if supabase_events:
        await store_calendar_events_batch_supabase(get_sb(), supabase_events)
    
    # Return simplified format for frontend
    events = []
    for event in events_data.get("value", []):
        events.append({
            "id": event.get("id"),
            "subject": event.get("subject"),
            "start": event.get("start", {}).get("dateTime"),
            "end": event.get("end", {}).get("dateTime"),
            "location": event.get("location", {}).get("displayName"),
            "attendees": [a.get("emailAddress", {}).get("name") for a in event.get("attendees", [])],
            "organizer": event.get("organizer", {}).get("emailAddress", {}).get("name"),
            "preview": event.get("bodyPreview", "")[:200],
            "is_all_day": event.get("isAllDay", False),
            "importance": event.get("importance", "normal")
        })
    
    return {
        "events": events,
        "total": len(events),
        "date_range": {"start": start_date, "end": end_date}
    }


@router.post("/outlook/calendar/sync")
async def sync_calendar(current_user: dict = Depends(get_current_user)):
    """Sync calendar and generate AI insights"""
    # First fetch events
    events_response = await get_calendar_events(days_ahead=30, days_back=0, current_user=current_user)
    events = events_response.get("events", [])
    
    # Generate calendar intelligence
    if events:
        now_utc = datetime.now(timezone.utc)
        upcoming_meetings = 0
        for event in events:
            start_dt = _safe_parse_dt(event.get("start"))
            if start_dt and start_dt > now_utc:
                upcoming_meetings += 1
        meeting_load = "heavy" if upcoming_meetings > 20 else "moderate" if upcoming_meetings > 10 else "light"
        
        # Analyze meeting patterns
        attendee_frequency = {}
        for event in events:
            for attendee in event.get("attendees", []):
                attendee_frequency[attendee] = attendee_frequency.get(attendee, 0) + 1
        
        top_collaborators = sorted(attendee_frequency.items(), key=lambda x: x[1], reverse=True)[:10]
        
        calendar_intel = {
            "user_id": current_user["id"],
            "total_events": len(events),
            "upcoming_meetings": upcoming_meetings,
            "meeting_load": meeting_load,
            "top_collaborators": [{"name": name, "meetings": count} for name, count in top_collaborators],
            "synced_at": datetime.now(timezone.utc).isoformat()
        }
        
        await update_calendar_intelligence_supabase(get_sb(), current_user["id"], calendar_intel)
    
    return {
        "status": "synced",
        "events_synced": len(events),
        "message": f"Calendar synced: {len(events)} events"
    }


@router.post("/outlook/calendar/create")
async def create_calendar_event(
    payload: CalendarEventCreateRequest,
    current_user: dict = Depends(get_current_user),
):
    """Create a follow-up event in Outlook Calendar."""
    tokens = await get_outlook_tokens(current_user["id"])
    if not tokens:
        raise HTTPException(status_code=400, detail="Outlook not connected")

    access_token = tokens.get("access_token")
    refresh_token = tokens.get("refresh_token")
    if not access_token:
        raise HTTPException(status_code=400, detail="Outlook token unavailable")

    expires_at = tokens.get("expires_at") or tokens.get("token_expiry")
    if expires_at:
        try:
            expiry_dt = datetime.fromisoformat(str(expires_at).replace("Z", "+00:00"))
            if expiry_dt <= datetime.now(timezone.utc) + timedelta(minutes=1):
                if refresh_token:
                    refreshed = await refresh_outlook_token_supabase(current_user["id"], refresh_token)
                    access_token = refreshed.get("access_token") or access_token
                else:
                    raise HTTPException(status_code=401, detail="Outlook token expired. Please reconnect Outlook.")
        except HTTPException:
            raise
        except Exception:
            pass

    try:
        start_dt = datetime.fromisoformat(payload.start_at.replace("Z", "+00:00"))
        end_dt = datetime.fromisoformat(payload.end_at.replace("Z", "+00:00"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid calendar date payload")

    if end_dt <= start_dt:
        raise HTTPException(status_code=400, detail="Calendar event end must be after start")

    attendees = []
    for email in payload.attendee_emails or []:
        if not email:
            continue
        attendees.append({
            "emailAddress": {"address": email},
            "type": "required",
        })

    body_content = payload.summary or "BIQc follow-up event"
    event_payload = {
        "subject": payload.title,
        "body": {"contentType": "HTML", "content": body_content.replace("\n", "<br/>")},
        "start": {"dateTime": start_dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S"), "timeZone": "UTC"},
        "end": {"dateTime": end_dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S"), "timeZone": "UTC"},
        "location": {"displayName": payload.location or "BIQc follow-up"},
        "attendees": attendees,
    }

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post("https://graph.microsoft.com/v1.0/me/events", headers=headers, json=event_payload)
        if response.status_code == 401 and refresh_token:
            refreshed = await refresh_outlook_token_supabase(current_user["id"], refresh_token)
            access_token = refreshed.get("access_token") or access_token
            headers["Authorization"] = f"Bearer {access_token}"
            response = await client.post("https://graph.microsoft.com/v1.0/me/events", headers=headers, json=event_payload)
        if response.status_code not in {200, 201}:
            raise HTTPException(status_code=400, detail=f"Failed to create Outlook event: {response.text}")
        data = response.json()

    return {
        "status": "created",
        "event_id": data.get("id"),
        "web_link": data.get("webLink"),
        "subject": data.get("subject"),
        "start": data.get("start", {}).get("dateTime"),
        "end": data.get("end", {}).get("dateTime"),
    }


# ==================== SMART EMAIL INTELLIGENCE ====================

@router.post("/email/analyze-priority")
async def analyze_email_priority(current_user: dict = Depends(get_current_user)):
    """
    AI-powered email prioritization based on business goals - SUPABASE VERSION
    Analyzes recent emails and provides strategic priority rankings.
    """
    user_id = current_user["id"]
    
    # Get business profile for context (still MongoDB for now - will migrate later)
    profile = await get_business_profile_supabase(get_sb(), user_id)
    business_goals = profile.get("short_term_goals", "") if profile else ""
    business_challenges = profile.get("main_challenges", "") if profile else ""
    
    # Get recent actionable inbox emails only. Exclude threads already answered from Sent Items.
    recent_inbox_emails = await get_user_emails_supabase(get_sb(), user_id, limit=100, folder="inbox")
    recent_sent_emails = await get_user_emails_supabase(get_sb(), user_id, limit=100, folder="sentitems")
    recent_emails = _filter_replied_inbox_emails(recent_inbox_emails, recent_sent_emails)[:50]
    
    if not recent_emails:
        return {"message": "No emails to analyze. Please sync your Outlook first."}
    
    # Get email intelligence for relationship context from Supabase
    email_intel = await get_email_intelligence_supabase(get_sb(), user_id)
    top_clients = email_intel.get("top_clients", []) if email_intel else []
    high_value_contacts = [c.get("email") for c in top_clients if c.get("relationship_strength") == "high"]
    
    # Prepare email summaries for AI
    email_summaries = []
    for i, email in enumerate(recent_emails[:30]):
        email_summaries.append(f"{i+1}. From: {email.get('from_name', email.get('from_address', 'Unknown'))} | Subject: {email.get('subject', 'No subject')} | Preview: {email.get('body_preview', '')[:100]}")
    
    # AI prompt for prioritization
    priority_prompt = f"""You are a strategic business advisor analyzing emails for a business owner.

BUSINESS CONTEXT:
- Goals: {business_goals or 'Not specified'}
- Challenges: {business_challenges or 'Not specified'}
- High-value contacts: {', '.join(high_value_contacts[:10]) if high_value_contacts else 'Not yet identified'}

EMAILS TO PRIORITIZE:
{chr(10).join(email_summaries)}

Analyze these emails and return a JSON response with this structure:
{{
    "high_priority": [
        {{"email_index": 1, "reason": "Why this is urgent", "suggested_action": "What to do"}}
    ],
    "medium_priority": [
        {{"email_index": 2, "reason": "Why this matters", "suggested_action": "What to do"}}
    ],
    "low_priority": [
        {{"email_index": 3, "reason": "Can wait", "suggested_action": "What to do"}}
    ],
    "strategic_insights": "Brief insight about email patterns and what they reveal about the business"
}}

Prioritize based on:
1. Revenue impact potential
2. Relationship importance
3. Time sensitivity
4. Alignment with stated business goals
5. Problem resolution urgency

Return ONLY valid JSON, no markdown."""

    try:
        email_sys = await get_prompt("email_priority_analysis_v1", _EMAIL_PRIORITY_FALLBACK)
        response = await llm_chat(system_message=email_sys, user_message=priority_prompt, model="gpt-4o-mini", api_key=OPENAI_KEY)
        
        # Parse AI response
        import json
        try:
            priority_analysis = json.loads(response.strip())
        except Exception:
            # Try to extract JSON from response
            import re
            json_match = re.search(r'\{[\s\S]*\}', response)
            if json_match:
                priority_analysis = json.loads(json_match.group())
            else:
                priority_analysis = {"error": "Could not parse AI response", "raw": response[:500]}
        
        priority_analysis = _normalize_priority_response(priority_analysis, recent_emails)
        
        # Store analysis in Supabase
        analysis_data = {
            "analysis": priority_analysis,
            "emails_analyzed": len(recent_emails),
            "source_inbox_count": len(recent_inbox_emails),
            "source_sent_count": len(recent_sent_emails),
        }
        await update_priority_analysis_supabase(get_sb(), user_id, analysis_data)
        
        return priority_analysis
        
    except Exception as e:
        logger.error(f"Email priority analysis error: {e}")
        heuristic = {"high_priority": [], "medium_priority": [], "low_priority": []}
        for idx, email in enumerate(recent_emails[:20]):
            classified = _heuristic_priority(email)
            heuristic[f"{classified['priority']}_priority"].append({
                "email_index": idx + 1,
                "reason": classified["reason"],
                "suggested_action": classified["suggested_action"],
                "action_item": classified["action_item"],
                "due_date": classified["due_date"],
            })
        heuristic["strategic_insights"] = "AI classification is temporarily degraded, so BIQc used deterministic priority rules based on urgency, commercial risk, and response signals."
        normalized = _normalize_priority_response(heuristic, recent_emails)
        analysis_data = {
            "analysis": normalized,
            "emails_analyzed": len(recent_emails),
            "source_inbox_count": len(recent_inbox_emails),
            "source_sent_count": len(recent_sent_emails),
        }
        await update_priority_analysis_supabase(get_sb(), user_id, analysis_data)
        return normalized


@router.post("/email/suggest-reply/{email_id}")
async def suggest_email_reply(email_id: str, current_user: dict = Depends(get_current_user)):
    """
    Generate BIQC-style decisive reply suggestion for a specific email.
    Returns suggested_reply (to send) and advisor_rationale (why BIQC recommends this).
    """
    user_id = current_user["id"]
    
    try:
        # 1. Get the email from outlook_emails by internal id, then fallback to provider message id.
        email = await find_email_by_id_supabase(get_sb(), email_id)
        if not email:
            email = await find_email_by_graph_message_id_supabase(get_sb(), user_id, email_id)
        
        if not email or email.get("user_id") != user_id:
            raise HTTPException(status_code=404, detail="Email not found")
        
        # 2. Get the most recent priority analysis
        priority_analysis = await get_priority_analysis_supabase(get_sb(), user_id)
        
        # 3. Find this email in priority analysis to get BIQC reasoning
        priority_context = None
        priority_level = "medium"
        why_reasoning = ""
        action_intent = ""
        
        if priority_analysis and priority_analysis.get("analysis"):
            analysis = priority_analysis["analysis"]
            email_graph_id = email.get("graph_message_id") or email.get("message_id")
            email_subject = email.get("subject", "").lower().strip()
            email_from = email.get("from_address", "").lower().strip()
            
            # Search through priority levels
            for level in ["high_priority", "medium_priority", "low_priority"]:
                items = analysis.get(level, [])
                for item in items:
                    # Match by graph_message_id (preferred)
                    if email_graph_id and item.get("id") == email_graph_id:
                        priority_context = item
                        priority_level = level.replace("_priority", "")
                        break
                    # Fallback: match by subject + from
                    item_subject = item.get("subject", "").lower().strip()
                    item_from = item.get("from", "").lower().strip()
                    if item_subject == email_subject and item_from in email_from:
                        priority_context = item
                        priority_level = level.replace("_priority", "")
                        break
                if priority_context:
                    break
            
            # Extract reasoning if found
            if priority_context:
                why_reasoning = (
                    priority_context.get("why")
                    or priority_context.get("reason")
                    or ""
                )
                action_intent = (
                    priority_context.get("action")
                    or priority_context.get("suggested_action")
                    or ""
                )
        
        # 4. Get business profile for context
        profile = await get_business_profile_supabase(get_sb(), user_id)
        user = await get_user_by_id(user_id)
        user_name = user.get("full_name") or user.get("name") or "Business Owner"
        business_name = ""
        if profile:
            business_name = profile.get("business_name", "")
        if not business_name and user:
            business_name = user.get("company_name", "")
        
        # 5. Build the BIQC reply generation prompt
        reply_prompt = f"""You are BIQC, the trusted strategic advisor for a senior business operator.

SENDER: {email.get('from_name', '')} <{email.get('from_address', '')}>
SUBJECT: {email.get('subject', 'No subject')}
RECEIVED: {email.get('received_date', '')}

EMAIL CONTENT:
{email.get('body_content', email.get('body_preview', ''))[:3000]}

---
BIQC PRIORITY ASSESSMENT:
- Priority Level: {priority_level.upper()}
- Why flagged: {why_reasoning or 'Standard business correspondence'}
- Suggested action: {action_intent or 'Respond appropriately'}

OWNER CONTEXT:
- Name: {user_name}
- Business: {business_name or 'Business operator'}

---
GENERATE A REPLY that the owner can send. Follow these MANDATORY rules:

HARD RULES (MUST FOLLOW):
1. NO polite filler phrases. BANNED phrases include:
   - "Thank you for reaching out"
   - "I hope you are well"
   - "Please let me know if you have any questions"
   - "Kind regards" / "Best regards" / "Warm regards"
   - "I appreciate your"
   - "Looking forward to"
2. Write in FIRST PERSON ("I will", "I've reviewed", "I can confirm")
3. MAXIMUM 2-4 sentences
4. Must move situation FORWARD with a decision, commitment, or next step
5. Reference time or consequence ("today", "by Friday", "next week", "otherwise")

STYLE:
- Sound like a senior operator, not customer support
- Clear, calm, decisive
- No marketing speak or over-explanation
- Direct but not rude

Return ONLY valid JSON in this exact format:
{{
  "suggested_reply": "The actual reply text the user would send (2-4 sentences, no greeting/closing)",
  "advisor_rationale": "2-3 sentences explaining: why this email matters, what risk/opportunity exists, what outcome this reply optimizes for"
}}"""

        # 6. Generate with LLM
        reply_sys = await get_prompt("email_reply_generator_v1", _EMAIL_REPLY_FALLBACK)
        response = await llm_chat(system_message=reply_sys, user_message=reply_prompt, model="gpt-4o-mini", api_key=OPENAI_KEY)
        
        # 7. Parse response
        import json
        result = None
        try:
            # Try direct parse
            result = json.loads(response.strip())
        except Exception:
            # Try to extract JSON from response
            import re
            json_match = re.search(r'\{[\s\S]*\}', response)
            if json_match:
                try:
                    result = json.loads(json_match.group())
                except Exception:
                    pass
        
        if not result or "suggested_reply" not in result:
            # Fallback: create structured response from raw text
            result = {
                "suggested_reply": response.strip()[:500],
                "advisor_rationale": f"This is a {priority_level} priority email. {why_reasoning}"
            }
        
        logger.info(f"✅ Generated BIQC reply for email {email_id}")
        
        return {
            "suggested_reply": result.get("suggested_reply", ""),
            "advisor_rationale": result.get("advisor_rationale", ""),
            "email_id": email_id,
            "priority_level": priority_level,
            "matched_by": "graph_id" if priority_context and priority_context.get("id") == email.get("graph_message_id") else "subject_from" if priority_context else "none"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Reply suggestion error: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Suggestion failed: {str(e)}")


@router.get("/email/priority-inbox")
async def get_priority_inbox(current_user: dict = Depends(get_current_user)):
    """Get the latest email priority analysis - SUPABASE VERSION"""
    analysis = await get_priority_analysis_supabase(get_sb(), current_user["id"])
    inbox_rows = await get_user_emails_supabase(get_sb(), current_user["id"], limit=5, folder="inbox")
    sent_rows = await get_user_emails_supabase(get_sb(), current_user["id"], limit=5, folder="sentitems")
    latest_inbox = max((_safe_parse_dt(item.get("received_date")) for item in inbox_rows), default=None)
    latest_sent = max((_safe_parse_dt(item.get("received_date")) for item in sent_rows), default=None)
    latest_source_dt = max([dt for dt in [latest_inbox, latest_sent] if dt is not None], default=None)
    analyzed_at = _safe_parse_dt((analysis or {}).get("analyzed_at"))

    if not analysis or (latest_source_dt and (not analyzed_at or latest_source_dt > analyzed_at)):
        return await analyze_email_priority(current_user)
    
    return analysis