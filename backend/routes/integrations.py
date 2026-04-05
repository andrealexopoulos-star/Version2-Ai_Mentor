"""
Integrations Routes — Merge.dev, CRM, Google Drive, Intelligence cold-read/ingest/watchtower.
Extracted from server.py.
"""
from fastapi import APIRouter, Depends, HTTPException, Request, Form, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
import os
import uuid
import json
import asyncio
import logging
import base64

import httpx
from routes.deps import (
    get_current_user, get_current_user_from_request,
    get_sb, OPENAI_KEY, AI_MODEL, cognitive_core, logger,
)
from supabase_client import safe_query_single
from auth_supabase import get_user_by_id
from supabase_intelligence_helpers import get_business_profile_supabase
from intelligence_live_truth import (
    email_row_is_connected,
    get_connector_truth_summary,
    get_live_integration_truth,
    get_recent_observation_events,
    build_watchtower_events,
    merge_row_is_connected,
    normalize_category,
)
from supabase_drive_helpers import (
    store_merge_integration, get_user_merge_integrations,
    get_merge_integration_by_token, update_merge_integration_sync,
    store_drive_file, store_drive_files_batch,
    get_user_drive_files, count_user_drive_files,
)
from biqc_jobs import enqueue_job
from integration_status_cache import (
    get_cached_integration_status,
    set_cached_integration_status,
    invalidate_cached_integration_status,
)
from tier_resolver import resolve_tier

router = APIRouter()
EDGE_PROXY_ALLOWLIST = {
    "biqc-insights-cognitive",
    "calibration-psych",
    "calibration_psych",
    "calibration-sync",
    "calibration-engine",
    "calibration-business-dna",
    "scrape-business-profile",
    "business-identity-lookup",
    "social-enrichment",
    "deep-web-recon",
    "competitor-monitor",
    "query-integrations-data",
    "checkin-manager",
    "warm-cognitive-engine",
    "gmail_prod",
    "market-analysis-ai",
    "market-signal-scorer",
    "browse-ai-reviews",
    "semrush-domain-intel",
}


def _classify_rpc_failure(exc: Exception) -> str:
    text = str(exc or "").lower()
    if any(marker in text for marker in ("does not exist", "undefined function", "pgrst202", "not find the function")):
        return "RPC_MISSING"
    if any(marker in text for marker in ("permission denied", "not authorized", "forbidden", "42501")):
        return "RPC_PERMISSION_DENIED"
    if any(marker in text for marker in ("timeout", "timed out", "deadline exceeded")):
        return "RPC_TIMEOUT"
    if any(marker in text for marker in ("network", "connection", "dns", "socket")):
        return "RPC_TRANSPORT_FAILURE"
    return "RPC_RUNTIME_FAILURE"


def _watchtower_degraded_payload(
    user_id: str,
    *,
    rpc_reason_code: str,
    rpc_error: Exception,
    events: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    events = list(events or [])
    now_iso = datetime.now(timezone.utc).isoformat()
    return {
        "status": "degraded",
        "has_data": bool(events),
        "positions": {},
        "events": events,
        "count": len(events),
        "computed_at": now_iso,
        "canonical_available": False,
        "message": "Canonical watchtower SQL is temporarily unavailable. BIQc is serving resilient observation-event fallback.",
        "degraded_reason_code": rpc_reason_code,
        "degraded_contract_version": "watchtower-degraded-v2",
        **_semantic_contract(
            data_status="degraded" if events else "empty",
            confidence_score=0.55 if events else 0.35,
            confidence_reason=(
                "Watchtower SQL unavailable; fallback events are available from observation stream."
                if events
                else "Watchtower SQL unavailable and no recent observation events are available."
            ),
            coverage_end=events[0].get("created_at") if events else None,
            freshness_hours=None,
            source_lineage=[{"connector": "watchtower_fallback", "endpoint": "/intelligence/watchtower"}],
            next_best_actions=[
                "Restore canonical watchtower SQL function permissions in production.",
                "Run watchtower analysis refresh after SQL restoration.",
            ],
            backfill_state="degraded",
            missing_periods=[
                f"Canonical watchtower positions unavailable ({rpc_reason_code}).",
            ],
        ),
        "lineage": {
            "fallback_mode": "observation_events_only",
            "sources": ["observation_events"],
            "workspace_id": user_id,
        },
        "recovery_actions": [
            "Restore `compute_watchtower_positions` in production schema.",
            "Validate RPC grants and rerun live watchtower probes.",
            "Confirm watchtower position computation resumes without degraded mode.",
        ],
    }


def _semantic_contract(
    *,
    data_status: str,
    confidence_score: float,
    confidence_reason: str,
    coverage_start: Optional[str] = None,
    coverage_end: Optional[str] = None,
    freshness_hours: Optional[int] = None,
    source_lineage: Optional[List[Dict[str, Any]]] = None,
    next_best_actions: Optional[List[str]] = None,
    lookback_days_target: int = 365,
    lookback_days_effective: Optional[int] = None,
    backfill_state: str = "none",
    missing_periods: Optional[List[str]] = None,
) -> Dict[str, Any]:
    if lookback_days_effective is None:
        lookback_days_effective = 0
        start_dt = _safe_parse_dt(coverage_start)
        end_dt = _safe_parse_dt(coverage_end)
        if start_dt and end_dt:
            lookback_days_effective = max(0, min(lookback_days_target, (end_dt - start_dt).days))

    gaps = list(missing_periods or [])
    if lookback_days_effective < lookback_days_target:
        gaps.append(f"Lookback depth below target ({lookback_days_effective}/{lookback_days_target} days).")

    return {
        "data_status": data_status,
        "confidence_score": round(max(0.0, min(1.0, float(confidence_score))), 3),
        "confidence_reason": confidence_reason,
        "coverage_window": {
            "start": coverage_start,
            "end": coverage_end,
            "freshness_hours": freshness_hours,
        },
        "lookback_days_target": int(lookback_days_target),
        "lookback_days_effective": int(max(0, lookback_days_effective)),
        "backfill_state": backfill_state,
        "missing_periods": gaps,
        "source_lineage": source_lineage or [],
        "next_best_actions": next_best_actions or [],
    }


def _safe_parse_dt(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return None


class EdgeProxyRequest(BaseModel):
    payload: Dict[str, Any] = {}


@router.post("/edge/functions/{function_name}")
async def proxy_edge_function(
    function_name: str,
    request: Request,
    body: EdgeProxyRequest,
    current_user: dict = Depends(get_current_user),
):
    """Proxy selected edge functions to avoid exposing provider URLs to clients."""
    def _ok_envelope(
        *,
        ok: bool,
        code: str,
        error: str = "",
        stage: str = "proxy",
        payload: Optional[Dict[str, Any]] = None,
        http_status: int = 200,
        function_name_value: str = "",
    ) -> JSONResponse:
        body: Dict[str, Any] = payload if isinstance(payload, dict) else {}
        body.setdefault("ok", ok)
        body.setdefault("code", code)
        body.setdefault("stage", stage)
        if error:
            body.setdefault("error", error)
        body.setdefault("_http_status", http_status)
        body.setdefault("_proxy", {})
        body["_proxy"]["request_id"] = proxy_request_id
        body["_proxy"]["function_name"] = function_name_value
        return JSONResponse(status_code=http_status, content=body)

    proxy_request_id = str(uuid.uuid4())
    name = (function_name or "").strip()
    if name not in EDGE_PROXY_ALLOWLIST:
        return _ok_envelope(
            ok=False,
            code="EDGE_FUNCTION_NOT_ALLOWED",
            error="Edge function not allowed",
            stage="validation",
            http_status=403,
            function_name_value=name,
        )
    resolved_name = "calibration-psych" if name == "calibration_psych" else name

    supabase_url = (os.environ.get("SUPABASE_URL") or "").strip().rstrip("/")
    if not supabase_url:
        return _ok_envelope(
            ok=False,
            code="EDGE_PROXY_UNAVAILABLE",
            error="Edge proxy unavailable",
            stage="proxy",
            http_status=503,
            function_name_value=resolved_name,
        )
    anon_key = (os.environ.get("SUPABASE_ANON_KEY") or "").strip()
    if not anon_key:
        return _ok_envelope(
            ok=False,
            code="EDGE_PROXY_UNAVAILABLE",
            error="Edge proxy unavailable",
            stage="proxy",
            http_status=503,
            function_name_value=resolved_name,
        )

    # Enforce backend-mediated service-role forwarding so edge reliability
    # does not depend on client JWT audience/scope differences.
    service_role = (
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        or os.environ.get("SUPABASE_KEY")
        or ""
    ).strip()
    if not service_role:
        return _ok_envelope(
            ok=False,
            code="EDGE_PROXY_UNAVAILABLE",
            error="Edge proxy unavailable",
            stage="proxy",
            http_status=503,
            function_name_value=resolved_name,
        )
    outbound_auth = f"Bearer {service_role}"
    outbound_apikey = service_role

    endpoint = f"{supabase_url}/functions/v1/{resolved_name}"
    calibration_run_id = (request.headers.get("X-Calibration-Run-Id") or "").strip()
    calibration_step = (request.headers.get("X-Calibration-Step") or "").strip()
    edge_payload = dict(body.payload or {})
    if current_user and current_user.get("id"):
        # Never trust caller-supplied tenant/user identifiers on proxied edge calls.
        # The proxy enforces principal scope to the authenticated user.
        user_scope_id = current_user["id"]
        edge_payload["user_id"] = user_scope_id
        if "tenant_id" in edge_payload:
            edge_payload["tenant_id"] = user_scope_id
    try:
        async with httpx.AsyncClient(timeout=90) as client:
            edge_res = await client.post(
                endpoint,
                json=edge_payload,
                headers={
                    "Authorization": outbound_auth,
                    "apikey": outbound_apikey,
                    "Content-Type": "application/json",
                    "X-Calibration-Run-Id": calibration_run_id,
                    "X-Calibration-Step": calibration_step,
                    "X-Proxy-Request-Id": proxy_request_id,
                },
            )
        content_type = edge_res.headers.get("content-type", "")
        if "application/json" in content_type:
            try:
                payload = edge_res.json()
            except Exception:
                payload = {
                    "code": "EDGE_INVALID_PAYLOAD",
                    "error": "Invalid edge response payload",
                    "stage": "proxy",
                }
        else:
            # Some utility functions intentionally return 204/empty body.
            if edge_res.status_code < 400:
                payload = {
                    "ok": True,
                    "code": "OK",
                    "stage": "edge_function",
                    "message": "Edge function completed without JSON payload",
                }
            else:
                payload = {
                    "code": "EDGE_NON_JSON_RESPONSE",
                    "error": "Edge function returned a non-JSON response",
                    "stage": "proxy",
                }

        if edge_res.status_code >= 400 and isinstance(payload, dict):
            payload.setdefault("code", "EDGE_FUNCTION_FAILED")
            payload.setdefault("stage", "edge_function")
            payload.setdefault("error", payload.get("detail") or "Edge function request failed")

        if not isinstance(payload, dict):
            payload = {"data": payload}

        payload.setdefault("ok", edge_res.status_code < 400 and payload.get("error") in (None, ""))
        payload.setdefault("code", "OK" if payload.get("ok") else "EDGE_FUNCTION_FAILED")
        payload.setdefault("stage", "edge_function")
        payload.setdefault("_http_status", edge_res.status_code)
        payload.setdefault("_proxy", {})
        payload["_proxy"]["request_id"] = proxy_request_id
        payload["_proxy"]["function_name"] = resolved_name
        if calibration_run_id:
            payload["_proxy"]["calibration_run_id"] = calibration_run_id
        if calibration_step:
            payload["_proxy"]["calibration_step"] = calibration_step

        return JSONResponse(status_code=edge_res.status_code, content=payload)
    except HTTPException:
        return _ok_envelope(
            ok=False,
            code="EDGE_PROXY_FAILURE",
            error="Edge proxy unavailable",
            stage="proxy",
            http_status=502,
            function_name_value=resolved_name,
        )
    except httpx.TimeoutException:
        return _ok_envelope(
            ok=False,
            code="EDGE_FUNCTION_TIMEOUT",
            error="Edge function timed out",
            stage="proxy",
            http_status=504,
            function_name_value=resolved_name,
        )
    except httpx.HTTPError:
        return _ok_envelope(
            ok=False,
            code="EDGE_FUNCTION_UNAVAILABLE",
            error="Edge function unavailable",
            stage="proxy",
            http_status=502,
            function_name_value=resolved_name,
        )
    except Exception as exc:
        logger.warning(f"[edge-proxy] {name} failed for user {current_user.get('id')}: {exc}")
        return _ok_envelope(
            ok=False,
            code="EDGE_PROXY_FAILURE",
            error="Edge function unavailable",
            stage="proxy",
            http_status=502,
            function_name_value=resolved_name,
        )


def _connected_integration_count(user_id: str) -> int:
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


def _launch_integration_limit(current_user: dict) -> Optional[int]:
    tier = resolve_tier(current_user)
    if tier == 'super_admin':
        return None
    if tier == 'free':
        return 1
    return 5


def _enforce_launch_integration_limit(current_user: dict, *, merge_only: bool = False) -> None:
    tier = resolve_tier(current_user)
    if tier == 'super_admin':
        return
    if tier == 'free' and merge_only:
        raise HTTPException(
            status_code=403,
            detail='Free tier supports email integration only. Upgrade to SMB Protect to connect CRM, accounting, and other systems.',
        )

    limit = _launch_integration_limit(current_user)
    if limit is None:
        return
    if _connected_integration_count(current_user["id"]) >= limit:
        raise HTTPException(
            status_code=403,
            detail=(
                'Free tier includes 1 email integration only. Disconnect the current provider or upgrade to SMB Protect.'
                if tier == 'free'
                else 'SMB Protect includes up to 5 integrations. Disconnect an existing connection before adding another.'
            ),
        )


# ─── Models ───

class MergeLinkTokenRequest(BaseModel):
    categories: Optional[List[str]] = None
    integration: Optional[str] = None  # Pre-select specific integration (e.g. "Stripe", "HubSpot")


class DelegateWorkflowRequest(BaseModel):
    decision_id: Optional[str] = None
    decision_title: str
    decision_summary: Optional[str] = None
    domain: Optional[str] = None
    severity: Optional[str] = None
    provider_preference: Optional[str] = "auto"
    assignee_name: Optional[str] = None
    assignee_email: Optional[str] = None
    assignee_remote_id: Optional[str] = None
    due_at: Optional[str] = None
    collection_remote_id: Optional[str] = None
    create_calendar_event: Optional[bool] = False


class DecisionFeedbackRequest(BaseModel):
    decision_key: str
    helpful: bool
    reason: Optional[str] = None


class CustomConnectorRequest(BaseModel):
    name: str
    details: str


def _normalize_provider(provider: Optional[str]) -> str:
    return str(provider or "").strip().lower()


def _severity_to_priority(severity: Optional[str]) -> str:
    sev = _normalize_provider(severity)
    if sev in ("critical", "high"):
        return "HIGH"
    if sev in ("low", "info"):
        return "LOW"
    return "NORMAL"


def _provider_matches_ticketing(provider_preference: str, ticketing_provider: str) -> bool:
    pref = _normalize_provider(provider_preference)
    ticket = _normalize_provider(ticketing_provider)
    if pref in ("", "auto", "merge-ticketing"):
        return True
    if pref in ("jira", "asana"):
        return pref in ticket
    return False


async def _get_ticketing_integration(user_id: str) -> Optional[Dict[str, Any]]:
    try:
        result = get_sb().table("integration_accounts").select(
            "provider, category, account_token, connected_at"
        ).eq("user_id", user_id).eq("category", "ticketing").order("connected_at", desc=True).limit(1).execute()
        if result.data:
            return result.data[0]
    except Exception:
        pass
    return None


async def _get_outlook_access_token(user_id: str) -> Optional[str]:
    from routes.email import get_outlook_tokens, refresh_outlook_token_supabase

    try:
        tokens = await get_outlook_tokens(user_id)
        if not tokens:
            return None

        access_token = tokens.get("access_token")
        refresh_token = tokens.get("refresh_token")
        expires_at_value = tokens.get("expires_at")

        if not access_token:
            return None

        # If no expiry is present, use token as-is.
        if not expires_at_value:
            return access_token

        try:
            expiry = datetime.fromisoformat(str(expires_at_value).replace("Z", "+00:00"))
            if expiry > datetime.now(timezone.utc):
                return access_token
        except Exception:
            # On parse errors, fail open with current token.
            return access_token

        # Token is expired. Attempt refresh if refresh token exists.
        if refresh_token:
            try:
                refreshed = await refresh_outlook_token_supabase(user_id, refresh_token)
                return refreshed.get("access_token")
            except Exception as refresh_error:
                logger.warning(f"[delegate/outlook] token refresh failed for {user_id}: {refresh_error}")

    except Exception as e:
        logger.warning(f"[delegate/outlook] token lookup failed for {user_id}: {e}")

    return None


async def _has_gmail_connection(user_id: str) -> bool:
    try:
        row = get_sb().table("gmail_connections").select("id").eq("user_id", user_id).limit(1).execute()
        return bool(row.data)
    except Exception:
        return False


def _auto_delegate_provider(
    provider_preference: str,
    ticketing_provider: Optional[str],
    has_outlook: bool,
    has_google_workspace: bool,
    task_preference: Optional[str] = None,
    calendar_preference: Optional[str] = None,
) -> str:
    pref = _normalize_provider(provider_preference)
    ticketing = _normalize_provider(ticketing_provider)
    task_pref = _normalize_provider(task_preference)
    cal_pref = _normalize_provider(calendar_preference)

    if pref in ("jira", "asana") and _provider_matches_ticketing(pref, ticketing):
        return pref
    if pref == "manual":
        return "manual"
    if pref in ("merge-ticketing", "ticketing") and ticketing:
        return ticketing
    if pref in ("outlook", "exchange", "outlook-exchange", "microsoft") and has_outlook:
        return "outlook-exchange"
    if pref in ("google", "google-calendar") and has_google_workspace:
        return "google-calendar"

    if task_pref in ("jira", "asana") and _provider_matches_ticketing(task_pref, ticketing):
        return task_pref
    if ticketing:
        if "jira" in ticketing:
            return "jira"
        if "asana" in ticketing:
            return "asana"
        return "merge-ticketing"

    if cal_pref in ("outlook", "exchange", "outlook-exchange") and has_outlook:
        return "outlook-exchange"
    if cal_pref in ("google", "google-calendar") and has_google_workspace:
        return "google-calendar"

    if has_outlook:
        return "outlook-exchange"
    if has_google_workspace:
        return "google-calendar"

    return "manual"


# ==================== MERGE.DEV INTEGRATION ====================

@router.post("/integrations/merge/link-token")
async def create_merge_link_token(
    payload: Optional[MergeLinkTokenRequest] = None,
    current_user: dict = Depends(get_current_user)
):
    """Generate Merge.dev link token for workspace (P0: workspace-scoped)"""
    from workspace_helpers import get_or_create_user_account

    _enforce_launch_integration_limit(current_user, merge_only=True)
    
    merge_api_key = os.environ.get("MERGE_API_KEY")
    
    if not merge_api_key or merge_api_key in ("CONFIGURED_IN_AZURE", ""):
        logger.error("❌ MERGE_API_KEY not configured")
        raise HTTPException(status_code=503, detail="Integration service not configured. Please contact support.")
    
    user_id = current_user["id"]
    user_email = current_user.get("email", "user@biqc.com")
    company_name = current_user.get("company_name") or current_user.get("business_name")
    
    # Get or create workspace for user (with fallback to user_id)
    account = await get_or_create_user_account(get_sb(), user_id, user_email, company_name)
    account_id = account["id"]
    account_name = account["name"]
    logger.info(f"🔗 Creating Merge link token for workspace: {account_name} ({account_id})")
    
    try:
        async with httpx.AsyncClient() as client:
            requested_categories = payload.categories if payload and payload.categories else None
            categories = requested_categories or ["accounting", "crm", "hris", "ats"]
            # Build Merge API body — categories only (no integration field, Merge handles selection in modal)
            merge_body = {
                "end_user_origin_id": account_id,
                "end_user_organization_name": account_name,
                "end_user_email_address": user_email,
                "categories": categories
            }
            logger.info(f"🔗 Creating Merge link token — categories: {categories}")

            response = await client.post(
                "https://api.merge.dev/api/integrations/create-link-token",
                headers={
                    "Authorization": f"Bearer {merge_api_key}",
                    "Content-Type": "application/json"
                },
                json=merge_body
            )
            
            logger.info(f"📊 Merge create-link-token response status: {response.status_code}")
            
            if response.status_code != 200:
                error_detail = response.text
                logger.error(f"❌ Merge.dev API error: Status {response.status_code}, Response: {error_detail}")
                raise HTTPException(status_code=response.status_code, detail=error_detail)
            
            data = response.json()
            link_token = data.get("link_token")
            
            if not link_token:
                logger.error("❌ No link_token in Merge API response")
                raise HTTPException(status_code=500, detail="No link_token in response")
            
            logger.info(f"✅ Link token created for workspace {account_name}")
            return {"link_token": link_token}
            
    except httpx.HTTPError as e:
        logger.error(f"❌ HTTP error calling Merge API: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Network error: {str(e)}")
    except Exception as e:
        logger.error(f"❌ Unexpected error creating link token: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Link token creation failed: {str(e)}")


@router.post("/integrations/merge/exchange-account-token")
async def exchange_merge_account_token(
    public_token: str = Form(...),
    category: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    """Exchange Merge public_token for account_token and persist (P0: workspace-scoped)"""
    from workspace_helpers import get_user_account
    
    _enforce_launch_integration_limit(current_user, merge_only=True)

    merge_api_key = os.environ.get("MERGE_API_KEY")
    
    if not merge_api_key or merge_api_key in ("CONFIGURED_IN_AZURE", ""):
        logger.error("❌ MERGE_API_KEY not configured")
        raise HTTPException(status_code=503, detail="Integration service not configured.")
    
    user_id = current_user["id"]
    user_email = current_user.get("email", "unknown")
    
    # Get user's workspace (fallback to user_id if accounts table unavailable)
    from workspace_helpers import get_user_account, _synthetic_account
    try:
        account = await get_user_account(get_sb(), user_id)
        if not account:
            account = _synthetic_account(user_id, user_email)
        account_id = account["id"]
        account_name = account["name"]
        logger.info(f"🔄 Exchanging Merge token for workspace: {account_name} ({account_id}), category: {category}")
    except Exception as e:
        logger.warning(f"⚠️ Workspace lookup failed, using user_id as workspace: {e}")
        account_id = user_id
        account_name = user_email
    
    # Exchange public_token for account_token
    try:
        async with httpx.AsyncClient() as client:
            exchange_url = f"https://api.merge.dev/api/integrations/account-token/{public_token}"
            logger.info(f"📡 Calling Merge API: {exchange_url}")
            
            response = await client.get(
                exchange_url,
                headers={"Authorization": f"Bearer {merge_api_key}"}
            )
            
            logger.info(f"📊 Merge API response status: {response.status_code}")
            
            if response.status_code != 200:
                error_text = response.text
                logger.error(f"❌ Merge API error ({response.status_code}): {error_text}")
                raise HTTPException(
                    status_code=response.status_code, 
                    detail=f"Merge API error: {error_text}"
                )
            
            data = response.json()
            logger.info(f"📦 Merge API response: {data}")
            
            account_token = data.get("account_token")
            integration_info = data.get("integration", {})
            integration_name = integration_info.get("name", "unknown")
            merge_account_id = data.get("id")  # FIX: ID is at root level, not in integration object
            
            # VALIDATE CATEGORY from Merge API response
            merge_categories = integration_info.get("categories", [])
            validated_category = merge_categories[0] if merge_categories else category
            if validated_category != category:
                logger.warning(f"⚠️ Category mismatch detected: frontend='{category}', Merge API='{validated_category}' - using Merge's category")
                category = validated_category
            
            if not account_token:
                logger.error("❌ No account_token in Merge API response")
                raise HTTPException(status_code=500, detail="No account_token in response")
            
            logger.info(f"✅ Received account_token for integration: {integration_name} (category: {category})")
            if merge_account_id:
                logger.info(f"✅ Merge account ID: {merge_account_id}")
            else:
                logger.warning(f"⚠️ No merge_account_id in response - this may cause issues")
    
    except httpx.HTTPError as e:
        logger.error(f"❌ HTTP error calling Merge API: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Network error: {str(e)}")
    except Exception as e:
        logger.error(f"❌ Unexpected error during token exchange: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Token exchange failed: {str(e)}")
    
    # P0 FIX: Store integration at workspace level (not user level)
    try:
        logger.info(f"💾 Storing integration for workspace: {account_name}")
        logger.info(f"   provider={integration_name}, category={category}, connected_by={user_email}")
        
        # Store integration — try workspace-level constraint, fall back to user-level
        integration_data = {
            "account_id": account_id,
            "user_id": user_id,
            "provider": integration_name,
            "category": category,
            "account_token": account_token,
            "merge_account_id": merge_account_id,
            "connected_at": datetime.now(timezone.utc).isoformat()
        }
        
        result = None
        try:
            result = get_sb().table("integration_accounts").upsert(
                integration_data,
                on_conflict="user_id,category"
            ).execute()
        except Exception:
            pass
        
        if not result or not result.data:
            # Fallback: try account_id,category (if that constraint exists)
            try:
                result = get_sb().table("integration_accounts").upsert(
                    integration_data,
                    on_conflict="account_id,category"
                ).execute()
            except Exception:
                result = get_sb().table("integration_accounts").insert(integration_data).execute()
        
        if not result or not result.data:
            logger.error("❌ Failed to store account_token in Supabase")
            raise HTTPException(status_code=500, detail="Failed to store account_token")
        
        logger.info(f"✅ Integration account stored successfully")
        
        # GOVERNANCE: Record integration connection as a governance event
        try:
            integration_type = 'crm' if category in ('crm', 'hris') else 'accounting' if category == 'accounting' else 'marketing' if category == 'marketing' else category
            # Update workspace_integrations table
            get_sb().table("workspace_integrations").upsert({
                "workspace_id": user_id,
                "integration_type": integration_type,
                "status": "connected",
                "connected_at": datetime.now(timezone.utc).isoformat(),
                "last_sync_at": datetime.now(timezone.utc).isoformat(),
            }, on_conflict="workspace_id,integration_type").execute()
            # Emit governance event via SQL function
            get_sb().rpc("emit_governance_event", {
                "p_workspace_id": user_id,
                "p_event_type": f"integration_connected_{integration_name}",
                "p_source_system": integration_type,
                "p_signal_reference": merge_account_id or integration_name,
                "p_confidence_score": 1.0,
            }).execute()
            logger.info(f"✅ Governance event emitted: integration_connected_{integration_name}")
        except Exception as gov_err:
            logger.warning(f"⚠️ Governance event emission failed (non-blocking): {gov_err}")

        # Trigger background record count sync via Redis queue
        try:
            await enqueue_job(
                "integration-count-sync",
                {"user_id": user_id, "category": category, "workspace_id": user_id},
                company_id=user_id,
                window_seconds=120,
            )
        except Exception:
            pass
        await invalidate_cached_integration_status(user_id)

        return {
            "success": True,
            "provider": integration_name,
            "category": category
        }
        
    except Exception as e:
        logger.error(f"❌ Database error storing integration: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


async def _sync_category_counts(sb, user_id: str, category: str):
    """Background: Fetch initial record counts after integration connects."""
    try:
        from workspace_helpers import get_user_account, get_merge_account_token
        from merge_client import get_merge_client
        account = await get_user_account(sb, user_id)
        if not account:
            return
        account_id = account["id"]
        token = await get_merge_account_token(sb, account_id, category)
        if not token:
            return
        merge = get_merge_client()
        count = 0
        record_type = "records"
        if category == "crm":
            data = await merge.get_deals(account_token=token, page_size=100)
            count = len(data.get("results", []))
            record_type = "deals"
        elif category == "accounting":
            data = await merge.get_invoices(account_token=token, page_size=100)
            count = len(data.get("results", []))
            record_type = "invoices"
        prow = sb.table("integration_accounts").select("provider").eq(
            "user_id", user_id).eq("category", category).maybe_single().execute()
        provider = (prow.data or {}).get("provider", category)
        await _upsert_integration_status(sb, user_id, provider, category,
            connected=True, provider=provider,
            records_count=count, record_type=record_type)
    except Exception as e:
        logger.warning(f"[bg-sync] count sync failed for {user_id}/{category}: {e}")
class MergeDisconnectRequest(BaseModel):
    provider: str
    category: str
    provider_hint: Optional[str] = None
    integration_slug: Optional[str] = None


@router.post("/merge/disconnect")
async def disconnect_merge_integration(request: Request, payload: MergeDisconnectRequest):
    """Disconnect a Merge.dev integration — removes from integration_accounts."""
    try:
        current_user = await get_current_user_from_request(request)
        user_id = current_user.get("id")
    except Exception:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        sb = get_sb()

        requested_category = normalize_category(payload.category, payload.provider, payload.integration_slug)
        candidate_tokens = {
            str(payload.provider or "").strip().lower(),
            str(payload.provider_hint or "").strip().lower(),
            str(payload.integration_slug or "").strip().lower(),
        }

        expanded_tokens = set()
        for token in candidate_tokens:
            if not token:
                continue
            expanded_tokens.add(token)
            if ":" in token:
                expanded_tokens.add(token.split(":", 1)[1])
            expanded_tokens.add(token.replace("-", " "))
            expanded_tokens.add(token.replace("_", " "))

        rows_result = sb.table("integration_accounts").select("*").eq("user_id", user_id).execute()

        rows = rows_result.data or []
        rows_to_delete = []

        for row in rows:
            row_category = normalize_category(row.get("category"), row.get("provider"), row.get("integration_slug"))
            if requested_category and row_category != requested_category:
                continue

            provider_norm = str(row.get("provider") or "").strip().lower()
            slug_norm = str(row.get("integration_slug") or "").strip().lower()
            provider_spaced = provider_norm.replace("-", " ").replace("_", " ")
            slug_spaced = slug_norm.replace("-", " ").replace("_", " ")

            matched = (
                provider_norm in expanded_tokens
                or slug_norm in expanded_tokens
                or provider_spaced in expanded_tokens
                or slug_spaced in expanded_tokens
                or any(token and token in {provider_norm, slug_norm, provider_spaced, slug_spaced} for token in expanded_tokens)
            )

            if matched:
                rows_to_delete.append(row)

        if not rows_to_delete:
            return {
                "success": True,
                "message": "Integration already disconnected",
                "rows_deleted": 0,
            }

        row_ids = [row["id"] for row in rows_to_delete if row.get("id")]
        if row_ids:
            sb.table("integration_accounts").delete().in_("id", row_ids).execute()
        else:
            for row in rows_to_delete:
                provider_value = row.get("provider")
                category_value = row.get("category")
                if provider_value:
                    delete_query = sb.table("integration_accounts").delete().eq("user_id", user_id).eq("provider", provider_value)
                    if category_value:
                        delete_query = delete_query.eq("category", category_value)
                    delete_query.execute()

        # Also mark integration_status disconnected so downstream UI updates immediately.
        for row in rows_to_delete:
            provider_label = row.get("provider") or row.get("integration_slug") or payload.provider
            category_label = normalize_category(row.get("category"), row.get("provider"), row.get("integration_slug"))
            try:
                await _upsert_integration_status(
                    sb,
                    user_id,
                    provider_label,
                    category_label,
                    connected=False,
                    provider=provider_label,
                    records_count=0,
                    record_type="records",
                    error_message="Disconnected by user",
                )
            except Exception:
                pass

        logger.info(f"[merge/disconnect] Disconnected {len(rows_to_delete)} integration record(s) for {user_id}")
        
        # GOVERNANCE: Record disconnection
        try:
            integration_type = 'crm' if payload.category in ('crm', 'hris') else 'accounting' if payload.category == 'accounting' else payload.category
            get_sb().table("workspace_integrations").upsert({
                "workspace_id": user_id,
                "integration_type": integration_type,
                "status": "disconnected",
            }, on_conflict="workspace_id,integration_type").execute()
            get_sb().rpc("emit_governance_event", {
                "p_workspace_id": user_id,
                "p_event_type": f"integration_disconnected_{payload.provider}",
                "p_source_system": integration_type,
                "p_signal_reference": payload.provider,
                "p_confidence_score": 1.0,
            }).execute()
        except Exception as gov_err:
            logger.warning(f"⚠️ Governance disconnect event failed: {gov_err}")
        await invalidate_cached_integration_status(user_id)
        return {"ok": True, "provider": payload.provider, "deleted_count": len(rows_to_delete)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[merge/disconnect] Error: {e}")
        raise HTTPException(status_code=500, detail="Disconnect failed")


@router.post("/integrations/merge/refresh-token")
async def refresh_merge_token(request: Request, payload: dict = None):
    """
    Refreshes a stale Merge integration token by deleting and re-prompting re-link.
    Called when Xero or other Merge integrations show as stale/expired.
    """
    try:
        current_user = await get_current_user_from_request(request)
        user_id = current_user.get("id")
    except Exception:
        raise HTTPException(status_code=401, detail="Not authenticated")

    body = payload or {}
    provider = body.get("provider", "")
    category = body.get("category", "")

    try:
        # Mark token as needing refresh in integration_accounts
        get_sb().table("integration_accounts").update({
            "sync_status": "token_expired",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).eq("user_id", user_id).eq("provider", provider).execute()

        logger.info(f"[merge/refresh-token] Marked {provider} for re-auth for {user_id}")
        await invalidate_cached_integration_status(user_id)
        return {"ok": True, "action": "relink_required", "provider": provider}
    except Exception as e:
        logger.error(f"[merge/refresh-token] Error: {e}")
        raise HTTPException(status_code=500, detail="Refresh failed")


@router.get("/integrations/merge/connected")
async def get_connected_merge_integrations(current_user: dict = Depends(get_current_user)):
    """Get connected integrations from canonical live-truth resolver."""
    try:
        user_id = current_user["id"]
        live_truth = get_live_integration_truth(get_sb(), user_id)
        integrations = {}

        for item in (live_truth.get("integrations") or []):
            provider = item.get("provider") or item.get("integration_name") or "unknown"
            category = normalize_category(item.get("category"), provider)
            key = f"{category}:{str(provider).lower()}"
            integrations[key] = {
                "provider": provider,
                "category": category,
                "connected": bool(item.get("connected")),
                "connected_at": item.get("connected_at"),
                "merge_account_id": item.get("merge_account_id"),
                "account_token": item.get("account_token"),
                "connected_email": item.get("connected_email"),
                "truth_state": item.get("truth_state"),
                "truth_reason": item.get("truth_reason"),
                "last_verified_at": item.get("last_verified_at"),
            }

        observation_state = get_recent_observation_events(get_sb(), user_id, limit=1)
        signal_count = observation_state.get("count", 0)
        last_signal = observation_state.get("last_signal_at")

        logger.info(f"Found {len(integrations)} integrations for user {user_id}")
        return {
            "integrations": integrations,
            "canonical_truth": {
                **(live_truth.get("canonical_truth") or {}),
                "live_signal_count": signal_count,
                "last_signal_at": last_signal,
            }
        }
        
    except Exception as e:
        logger.error(f"Error fetching integrations: {str(e)}")
        return {"integrations": {}}


# ==================== MERGE.DEV CRM DATA ACCESS ====================
# Authoritative pattern: All CRM access via Merge Unified API
# BIQC never authenticates directly with HubSpot/Salesforce/etc.


@router.get("/integrations/crm/contacts")
async def get_crm_contacts(
    cursor: Optional[str] = None,
    page_size: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """
    Get CRM contacts via Merge.dev (workspace-scoped)
    
    Works with: HubSpot, Salesforce, Pipedrive, etc.
    All OAuth and tokens managed by Merge.dev
    """
    from merge_client import get_merge_client
    from workspace_helpers import get_user_account, get_merge_account_token
    
    user_id = current_user["id"]
    
    # Get user's workspace
    account = await get_user_account(get_sb(), user_id)
    if not account:
        raise HTTPException(
            status_code=400,
            detail="User workspace not initialized"
        )
    
    account_id = account["id"]
    account_name = account["name"]
    
    # Get Merge account token for this workspace's CRM integration
    account_token = await get_merge_account_token(get_sb(), account_id, "crm")
    
    if not account_token:
        logger.warning(f"⚠️  Workspace {account_name} has no CRM integration")
        raise HTTPException(
            status_code=409,
            detail="IntegrationNotConnected: No CRM integration found for workspace. Please connect HubSpot, Salesforce, or another CRM."
        )
    
    logger.info(f"📇 Fetching CRM contacts for workspace: {account_name}")
    
    # Call Merge Unified API
    merge_client = get_merge_client()
    
    try:
        data = await merge_client.get_contacts(
            account_token=account_token,
            cursor=cursor,
            page_size=page_size
        )
        
        logger.info(f"✅ Retrieved {len(data.get('results', []))} contacts")
        return data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error fetching contacts: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/integrations/crm/companies")
async def get_crm_companies(
    cursor: Optional[str] = None,
    page_size: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """
    Get CRM companies via Merge.dev (workspace-scoped)
    
    Works with: HubSpot, Salesforce, Pipedrive, etc.
    """
    from merge_client import get_merge_client
    from workspace_helpers import get_user_account, get_merge_account_token
    
    user_id = current_user["id"]
    
    account = await get_user_account(get_sb(), user_id)
    if not account:
        raise HTTPException(status_code=400, detail="User workspace not initialized")
    
    account_id = account["id"]
    account_name = account["name"]
    
    account_token = await get_merge_account_token(get_sb(), account_id, "crm")
    
    if not account_token:
        raise HTTPException(
            status_code=409,
            detail="IntegrationNotConnected: No CRM integration connected"
        )
    
    logger.info(f"🏢 Fetching CRM companies for workspace: {account_name}")
    
    merge_client = get_merge_client()
    
    try:
        data = await merge_client.get_companies(
            account_token=account_token,
            cursor=cursor,
            page_size=page_size
        )
        
        logger.info(f"✅ Retrieved {len(data.get('results', []))} companies")
        return data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error fetching companies: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/integrations/crm/company")
async def get_crm_company_alias(
    cursor: Optional[str] = None,
    page_size: int = 100,
    current_user: dict = Depends(get_current_user),
):
    """Compatibility alias for singular company endpoint used by older clients."""
    return await get_crm_companies(cursor=cursor, page_size=page_size, current_user=current_user)


@router.get("/integrations/crm/deals")
async def get_crm_deals(
    cursor: Optional[str] = None,
    page_size: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """
    Get CRM deals/opportunities via Merge.dev (workspace-scoped)
    
    Works with: HubSpot, Salesforce, Pipedrive, etc.
    """
    from merge_client import get_merge_client
    from workspace_helpers import get_user_account, get_merge_account_token
    
    user_id = current_user["id"]
    
    account = await get_user_account(get_sb(), user_id)
    if not account:
        raise HTTPException(status_code=400, detail="User workspace not initialized")
    
    account_id = account["id"]
    account_name = account["name"]
    
    account_token = await get_merge_account_token(get_sb(), account_id, "crm")
    
    if not account_token:
        raise HTTPException(
            status_code=409,
            detail="IntegrationNotConnected: No CRM integration connected"
        )
    
    logger.info(f"💼 Fetching CRM deals for workspace: {account_name}")
    
    merge_client = get_merge_client()
    
    try:
        data = await merge_client.get_deals(
            account_token=account_token,
            cursor=cursor,
            page_size=page_size
        )
        
        deals = data.get('results', [])
        logger.info(f"✅ Retrieved {len(deals)} deals")
        
        # GOVERNANCE: Emit events for significant deal signals
        try:
            for deal in deals:
                deal_status = (deal.get('status') or '').upper()
                deal_name = deal.get('name', 'Unknown')
                deal_amount = deal.get('amount')
                
                # Detect recently won deals
                if deal_status == 'WON':
                    get_sb().rpc("emit_governance_event", {
                        "p_workspace_id": user_id,
                        "p_event_type": "deal_won",
                        "p_source_system": "crm",
                        "p_signal_reference": deal.get('id', deal_name),
                        "p_confidence_score": 0.95,
                    }).execute()
                
                # Detect lost deals
                elif 'LOST' in deal_status:
                    get_sb().rpc("emit_governance_event", {
                        "p_workspace_id": user_id,
                        "p_event_type": "deal_lost",
                        "p_source_system": "crm",
                        "p_signal_reference": deal.get('id', deal_name),
                        "p_confidence_score": 0.95,
                    }).execute()
                
                # Detect stalled deals (>7 days no update)
                elif deal.get('last_modified_at'):
                    from datetime import datetime, timezone
                    try:
                        last_mod = datetime.fromisoformat(deal['last_modified_at'].replace('Z', '+00:00'))
                        days_stalled = (datetime.now(timezone.utc) - last_mod).days
                        if days_stalled > 7:
                            get_sb().rpc("emit_governance_event", {
                                "p_workspace_id": user_id,
                                "p_event_type": "deal_stalled",
                                "p_source_system": "crm",
                                "p_signal_reference": deal.get('id', deal_name),
                                "p_confidence_score": 0.7,
                            }).execute()
                    except Exception:
                        pass
        except Exception as gov_err:
            logger.warning(f"⚠️ Deal governance events failed (non-blocking): {gov_err}")
        
        return data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error fetching deals: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/integrations/crm/owners")
async def get_crm_owners(
    cursor: Optional[str] = None,
    page_size: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """
    Get CRM users/owners via Merge.dev (workspace-scoped)
    
    Works with: HubSpot, Salesforce, Pipedrive, etc.
    """
    from merge_client import get_merge_client
    from workspace_helpers import get_user_account, get_merge_account_token
    
    user_id = current_user["id"]
    
    account = await get_user_account(get_sb(), user_id)
    if not account:
        raise HTTPException(status_code=400, detail="User workspace not initialized")
    
    account_id = account["id"]
    account_name = account["name"]
    
    account_token = await get_merge_account_token(get_sb(), account_id, "crm")
    
    if not account_token:
        raise HTTPException(
            status_code=409,
            detail="IntegrationNotConnected: No CRM integration connected"
        )
    
    logger.info(f"👥 Fetching CRM owners for workspace: {account_name}")
    
    merge_client = get_merge_client()
    
    try:
        data = await merge_client.get_users(
            account_token=account_token,
            cursor=cursor,
            page_size=page_size
        )
        
        logger.info(f"✅ Retrieved {len(data.get('results', []))} owners")
        return data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error fetching owners: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))



# ==================== ACCOUNTING / FINANCIAL INTEGRATIONS ====================

@router.get("/integrations/accounting/invoices")
async def get_accounting_invoices(
    cursor: Optional[str] = None,
    page_size: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """
    Get invoices from ANY connected accounting system (Xero, QuickBooks, MYOB, etc.) via Merge.dev
    """
    from merge_client import get_merge_client
    from workspace_helpers import get_user_account, get_merge_account_token
    
    user_id = current_user["id"]
    account = await get_user_account(get_sb(), user_id)
    if not account:
        raise HTTPException(status_code=400, detail="User workspace not initialized")
    
    account_id = account["id"]
    account_token = await get_merge_account_token(get_sb(), account_id, "accounting")
    
    if not account_token:
        raise HTTPException(status_code=409, detail="IntegrationNotConnected: No accounting integration found. Connect Xero, QuickBooks, or MYOB.")
    
    merge_client = get_merge_client()
    try:
        data = await merge_client.get_invoices(account_token=account_token, cursor=cursor, page_size=page_size)
        logger.info(f"✅ Retrieved {len(data.get('results', []))} invoices")
        return data
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error fetching invoices: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/integrations/accounting/payments")
async def get_accounting_payments(
    cursor: Optional[str] = None,
    page_size: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """Get payments from ANY connected accounting system via Merge.dev"""
    from merge_client import get_merge_client
    from workspace_helpers import get_user_account, get_merge_account_token
    
    user_id = current_user["id"]
    account = await get_user_account(get_sb(), user_id)
    if not account:
        raise HTTPException(status_code=400, detail="User workspace not initialized")
    
    account_id = account["id"]
    account_token = await get_merge_account_token(get_sb(), account_id, "accounting")
    
    if not account_token:
        raise HTTPException(status_code=409, detail="IntegrationNotConnected: No accounting integration found.")
    
    merge_client = get_merge_client()
    try:
        data = await merge_client.get_payments(account_token=account_token, cursor=cursor, page_size=page_size)
        return data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/integrations/accounting/transactions")
async def get_accounting_transactions(
    cursor: Optional[str] = None,
    page_size: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """Get transactions from ANY connected accounting system via Merge.dev"""
    from merge_client import get_merge_client
    from workspace_helpers import get_user_account, get_merge_account_token
    
    user_id = current_user["id"]
    account = await get_user_account(get_sb(), user_id)
    if not account:
        raise HTTPException(status_code=400, detail="User workspace not initialized")
    
    account_id = account["id"]
    account_token = await get_merge_account_token(get_sb(), account_id, "accounting")
    
    if not account_token:
        raise HTTPException(status_code=409, detail="IntegrationNotConnected: No accounting integration found.")
    
    merge_client = get_merge_client()
    try:
        data = await merge_client.get_transactions(account_token=account_token, cursor=cursor, page_size=page_size)
        return data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/integrations/accounting/summary")
async def get_accounting_summary(current_user: dict = Depends(get_current_user)):
    """
    Financial intelligence summary from ANY connected accounting system.
    Returns key financial metrics for the cognitive engine.
    """
    from merge_client import get_merge_client
    from workspace_helpers import get_user_account, get_merge_account_token
    
    user_id = current_user["id"]
    account = await get_user_account(get_sb(), user_id)
    if not account:
        raise HTTPException(status_code=400, detail="User workspace not initialized")
    
    account_id = account["id"]
    account_token = await get_merge_account_token(get_sb(), account_id, "accounting")
    
    if not account_token:
        return {"connected": False, "provider": None, "summary": None}
    
    merge_client = get_merge_client()
    summary = {"connected": True, "invoices": [], "payments": [], "metrics": {}}
    
    try:
        invoice_list = []
        cursor = None
        pages_fetched = 0
        max_pages = 10

        for _ in range(max_pages):
            invoice_page = await merge_client.get_invoices(account_token=account_token, cursor=cursor, page_size=100)
            batch = invoice_page.get("results", []) or []
            invoice_list.extend(batch)
            pages_fetched += 1
            cursor = invoice_page.get("next")
            if not cursor or not batch:
                break

        summary["invoices"] = invoice_list
        
        total_outstanding = 0
        total_overdue = 0
        overdue_count = 0
        total_outstanding_client = 0
        total_outstanding_supplier = 0
        total_overdue_client = 0
        total_overdue_supplier = 0
        overdue_count_client = 0
        overdue_count_supplier = 0
        today_date = datetime.now(timezone.utc).date()

        def _parse_due_date(raw_value):
            if not raw_value:
                return None
            raw = str(raw_value)
            try:
                return datetime.fromisoformat(raw.replace("Z", "+00:00")).date()
            except Exception:
                try:
                    return datetime.strptime(raw[:10], "%Y-%m-%d").date()
                except Exception:
                    return None

        def _invoice_bucket(inv: Dict[str, Any]) -> str:
            raw_type = str(
                inv.get("type")
                or inv.get("invoice_type")
                or inv.get("document_type")
                or inv.get("transaction_type")
                or ""
            ).upper()
            if any(token in raw_type for token in ("RECEIVABLE", "CUSTOMER", "AR", "SALES")):
                return "client"
            if any(token in raw_type for token in ("PAYABLE", "VENDOR", "SUPPLIER", "BILL", "AP")):
                return "supplier"
            return "unknown"
        
        for inv in invoice_list:
            amount = float(inv.get("total_amount") or inv.get("amount") or 0)
            status = (inv.get("status") or "").upper()
            bucket = _invoice_bucket(inv)

            closed_statuses = {"PAID", "VOID", "DELETED", "CANCELLED", "CANCELED", "CREDITED"}
            open_statuses = {"OPEN", "AUTHORIZED", "SUBMITTED", "PARTIALLY_PAID", "SENT", "APPROVED", "OVERDUE"}

            is_closed = status in closed_statuses
            is_open = status in open_statuses

            if is_open and not is_closed:
                total_outstanding += amount
                if bucket == "client":
                    total_outstanding_client += amount
                elif bucket == "supplier":
                    total_outstanding_supplier += amount

            due_date = _parse_due_date(inv.get("due_date"))
            is_overdue = (not is_closed) and (
                status == "OVERDUE"
                or (is_open and due_date is not None and due_date < today_date)
            )
            if is_overdue:
                total_overdue += amount
                overdue_count += 1
                if bucket == "client":
                    total_overdue_client += amount
                    overdue_count_client += 1
                elif bucket == "supplier":
                    total_overdue_supplier += amount
                    overdue_count_supplier += 1
        
        summary["metrics"] = {
            "total_invoices": len(invoice_list),
            "total_client_invoices": sum(1 for inv in invoice_list if _invoice_bucket(inv) == "client"),
            "total_supplier_invoices": sum(1 for inv in invoice_list if _invoice_bucket(inv) == "supplier"),
            "invoice_pages_fetched": pages_fetched,
            "total_outstanding": round(total_outstanding_client, 2),
            "total_overdue": round(total_overdue_client, 2),
            "overdue_count": overdue_count_client,
            "total_outstanding_all": round(total_outstanding, 2),
            "total_overdue_all": round(total_overdue, 2),
            "overdue_count_all": overdue_count,
            "total_outstanding_client": round(total_outstanding_client, 2),
            "total_overdue_client": round(total_overdue_client, 2),
            "overdue_count_client": overdue_count_client,
            "total_outstanding_supplier": round(total_outstanding_supplier, 2),
            "total_overdue_supplier": round(total_overdue_supplier, 2),
            "overdue_count_supplier": overdue_count_supplier,
        }
        
        try:
            payments = await merge_client.get_payments(account_token=account_token, page_size=20)
            summary["payments"] = payments.get("results", [])
            summary["metrics"]["recent_payments"] = len(summary["payments"])
        except Exception:
            pass
        
        return summary
    except Exception as e:
        logger.error(f"❌ Error building accounting summary: {str(e)}")
        return {"connected": True, "error": str(e), "summary": None}

# ═══ Root + Health handled in server.py ═══

# ═══ Voice chat handled in server.py ═══

# ==================== TRUTH ENGINE: COLD READ PROTOCOL ====================

@router.post("/intelligence/cold-read")
async def trigger_cold_read(current_user: dict = Depends(get_current_user)):
    """
    WATCHTOWER COLD READ - RPC-Based Intelligence
    
    Uses Supabase server-side functions for performance
    """
    from truth_engine_rpc import generate_cold_read
    from watchtower_store import get_watchtower_store
    from workspace_helpers import get_user_account
    
    user_id = current_user["id"]
    import time as _time
    _t0 = _time.monotonic()
    
    # Get workspace
    account = await get_user_account(get_sb(), user_id)
    if not account:
        raise HTTPException(status_code=400, detail="Workspace not initialized")
    
    account_id = account["id"]
    
    logger.info(f"🔍 Cold Read for account {account_id}, user {user_id}")
    
    # FAST PATH: Check if any observation_events exist first
    try:
        obs_check = get_sb().table("observation_events").select("id", count="exact").eq("user_id", user_id).limit(1).execute()
        obs_count = obs_check.count or 0
    except Exception:
        obs_count = 0

    if obs_count == 0:
        _elapsed = round((_time.monotonic() - _t0) * 1000)
        logger.info(f"⚡ Cold Read fast-path: no observation events ({_elapsed}ms)")
        return {
            "success": True,
            "cold_read": {
                "status": "NO_DATA",
                "events_created": 0,
                "signals": [],
                "message": "No material changes detected.",
                "method": "fast_path",
            }
        }

    # ANALYSIS PATH: Read from precomputed positions + existing insights (READ-ONLY)
    positions = {}
    findings = []
    try:
        from watchtower_engine import get_watchtower_engine
        engine = get_watchtower_engine()
        positions = await engine.get_positions(user_id)
        findings_raw = await engine.get_findings(user_id, limit=10)
        findings = findings_raw if isinstance(findings_raw, list) else []
    except Exception as wt_err:
        logger.warning(f"🔭 Positions read failed: {wt_err}")

    _elapsed = round((_time.monotonic() - _t0) * 1000)
    logger.info(f"⚡ Cold Read completed in {_elapsed}ms (read-only)")

    # Build result from precomputed state
    events_created = len(findings)
    result = {
        "events_created": events_created,
        "status": "ACTIVE" if positions else "NO_DATA",
        "method": "precomputed",
        "positions": positions,
        "findings_count": len(findings),
        "signals": [f.get("finding", "")[:100] for f in findings[:5]],
        "message": "No material changes detected." if not positions else None,
    }

    return {
        "success": True,
        "cold_read": result
    }


@router.post("/intelligence/ingest")
async def trigger_ingestion(current_user: dict = Depends(get_current_user)):
    """Ingestion endpoint — admin/system only. Pulls data from integrations."""
    # Role restriction: only admin or superadmin
    user_role = current_user.get("role", "user")
    if user_role not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Ingest requires admin role")
    import time as _time
    _t0 = _time.monotonic()
    user_id = current_user["id"]
    from workspace_helpers import get_user_account
    account = await get_user_account(get_sb(), user_id)
    if not account:
        raise HTTPException(status_code=400, detail="Workspace not initialized")
    account_id = account["id"]
    emission_signals = 0
    if emission_layer:
        try:
            emission_result = await emission_layer.run_emission(user_id, account_id)
            emission_signals = emission_result.get("signals_emitted", 0)
        except Exception as e:
            logger.warning(f"[ingest] Emission failed: {e}")
    # Run Watchtower Engine analysis after ingestion
    watchtower_result = None
    try:
        from watchtower_engine import get_watchtower_engine
        engine = get_watchtower_engine()
        watchtower_result = await engine.run_analysis(user_id)
    except Exception as e:
        logger.warning(f"[ingest] Watchtower analysis failed: {e}")
    _elapsed = round((_time.monotonic() - _t0) * 1000)
    logger.info(f"⚡ Ingestion completed in {_elapsed}ms — {emission_signals} signals")
    return {"success": True, "signals_emitted": emission_signals, "watchtower": watchtower_result, "elapsed_ms": _elapsed}


@router.get("/intelligence/baseline-snapshot")
async def get_baseline_snapshot(current_user: dict = Depends(get_current_user)):
    """Get the latest baseline_initialized snapshot for the user."""
    user_id = current_user["id"]
    try:
        result = get_sb().table("intelligence_snapshots").select("*").eq(
            "user_id", user_id
        ).eq("snapshot_type", "baseline_initialized").order("generated_at", desc=True).limit(1).execute()
        if result.data and len(result.data) > 0:
            row = result.data[0]
            row.pop("id", None)
            return {"snapshot": row}
        return {"snapshot": None}
    except Exception as e:
        logger.error(f"[baseline-snapshot] Error: {e}")
        return {"snapshot": None}


@router.get("/executive-mirror")
async def get_executive_mirror(current_user: dict = Depends(get_current_user)):
    """
    The Executive Mirror — single endpoint for the /advisor landing.
    PARALLEL FETCH: All queries execute concurrently via asyncio.gather.
    """
    user_id = current_user.get("id")

    result = {
        "agent_persona": None,
        "fact_ledger": None,
        "executive_memo": None,
        "resolution_status": None,
    }

    async def fetch_operator_profile():
        try:
            op = safe_query_single(
                get_sb().table("user_operator_profile").select(
                    "agent_persona, fact_ledger, persona_calibration_status"
                ).eq("user_id", user_id)
            )
            return op.data if op.data else None
        except Exception as e:
            logger.error(f"[executive-mirror] operator_profile read failed: {e}")
            return None

    async def fetch_latest_snapshot():
        try:
            snap = get_sb().table("intelligence_snapshots").select(
                "executive_memo, resolution_score, snapshot_type, generated_at"
            ).eq("user_id", user_id).order(
                "generated_at", desc=True
            ).limit(1).execute()
            return snap.data[0] if snap.data else None
        except Exception as e:
            logger.error(f"[executive-mirror] intelligence_snapshots read failed: {e}")
            return None

    async def fetch_business_profile():
        try:
            bp = await get_business_profile_supabase(get_sb(), user_id)
            return bp
        except Exception:
            return None

    async def fetch_console_state():
        try:
            scs = get_sb().table("strategic_console_state").select(
                "status, is_complete, current_step"
            ).eq("user_id", user_id).maybe_single().execute()
            return scs.data if scs.data else None
        except Exception:
            return None

    # PARALLEL: All 4 queries execute concurrently
    op_data, snap_data, bp_data, scs_data = await asyncio.gather(
        fetch_operator_profile(),
        fetch_latest_snapshot(),
        fetch_business_profile(),
        fetch_console_state(),
    )

    if op_data:
        result["agent_persona"] = op_data.get("agent_persona")
        result["fact_ledger"] = op_data.get("fact_ledger")
        result["calibration_status"] = op_data.get("persona_calibration_status")

    if snap_data:
        result["executive_memo"] = snap_data.get("executive_memo")
        result["resolution_status"] = snap_data.get("resolution_score")
        result["snapshot_type"] = snap_data.get("snapshot_type")
        result["snapshot_generated_at"] = snap_data.get("generated_at")

    if bp_data:
        result["business_name"] = bp_data.get("business_name")
        result["business_stage"] = bp_data.get("business_stage")
        result["industry"] = bp_data.get("industry")

    if scs_data:
        result["console_complete"] = scs_data.get("is_complete", False)

    return result



@router.get("/intelligence/data-readiness")
async def get_data_readiness(current_user: dict = Depends(get_current_user)):
    """Data readiness for each integration — real state from DB."""
    user_id = current_user["id"]
    try:
        integrations = []
        int_result = get_sb().table("integration_accounts").select(
            "provider, category, connected_at"
        ).eq("user_id", user_id).execute()
        for row in (int_result.data or []):
            provider = row.get("provider", "")
            obs_count = 0
            try:
                obs_r = get_sb().table("observation_events").select(
                    "id", count="exact"
                ).eq("user_id", user_id).eq("source", provider).execute()
                obs_count = obs_r.count or 0
            except Exception:
                pass
            integrations.append({
                "provider": provider,
                "category": row.get("category", ""),
                "status": "Connected",
                "connected_at": row.get("connected_at"),
                "observation_events": obs_count,
            })
        return {"integrations": integrations}
    except Exception as e:
        logger.error(f"[data-readiness] Error: {e}")
        return {"integrations": []}


@router.get("/intelligence/watchtower")
async def get_watchtower_events(
    status: Optional[str] = "active",
    current_user: dict = Depends(get_current_user)
):
    """
    Canonical Watchtower endpoint.
    Returns SQL-computed positions when available plus the latest grounded events.
    """
    user_id = current_user["id"]

    try:
        sb = get_sb()
        positions = None
        try:
            rpc_result = sb.rpc('compute_watchtower_positions', {'p_workspace_id': user_id}).execute()
            positions = rpc_result.data if rpc_result and rpc_result.data else None
        except Exception as rpc_error:
            rpc_reason = _classify_rpc_failure(rpc_error)
            logger.warning("[watchtower] canonical RPC failed (%s): %s", rpc_reason, rpc_error)
            observation_state = get_recent_observation_events(sb, user_id, limit=20)
            events = build_watchtower_events(observation_state.get("events") or [], limit=10)
            return _watchtower_degraded_payload(
                user_id=user_id,
                rpc_reason_code=rpc_reason,
                rpc_error=rpc_error,
                events=events,
            )

        observation_state = get_recent_observation_events(sb, user_id, limit=20)
        events = build_watchtower_events(observation_state.get("events") or [], limit=10)

        logger.info(f"✅ Watchtower state fetched for user {user_id}: {len(events)} events")

        computed_at = _safe_parse_dt((positions or {}).get("computed_at"))
        freshness_hours: Optional[int] = None
        if computed_at:
            freshness_hours = int(max(0, (datetime.now(timezone.utc) - computed_at).total_seconds() // 3600))
        has_payload = bool((positions or {}).get("positions") or events)
        data_status = "ready" if has_payload else "empty"
        confidence = 0.8 if has_payload else 0.3
        confidence_reason = "Watchtower positions and grounded events are available." if has_payload else "No grounded events or computed watchtower positions are available yet."
        next_actions: List[str] = []
        if not has_payload:
            next_actions = [
                "Connect additional integrations and run sync.",
                "Trigger ingestion and watchtower analysis.",
            ]
        elif freshness_hours is not None and freshness_hours > 24:
            data_status = "stale"
            confidence = 0.62
            confidence_reason = "Watchtower output is older than 24 hours."
            next_actions = ["Refresh watchtower analysis."]

        return {
            "status": "computed",
            "has_data": bool((positions or {}).get("positions") or events),
            "positions": (positions or {}).get("positions", {}),
            "events": events,
            "count": len(events),
            "computed_at": (positions or {}).get("computed_at"),
            **_semantic_contract(
                data_status=data_status,
                confidence_score=confidence,
                confidence_reason=confidence_reason,
                coverage_end=computed_at.isoformat() if computed_at else None,
                freshness_hours=freshness_hours,
                source_lineage=[{"connector": "watchtower", "endpoint": "/intelligence/watchtower"}],
                next_best_actions=next_actions,
            ),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Watchtower fetch failed: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to fetch watchtower events: {str(e)}")


@router.post("/intelligence/alerts/action")
async def alert_action(request: Request, current_user: dict = Depends(get_current_user)):
    """Handle alert actions: complete, ignore, hand-off, auto-email"""
    body = await request.json()
    alert_id = body.get("alert_id")
    action = body.get("action")  # complete, ignore, hand-off, auto-email
    
    if not alert_id or not action:
        raise HTTPException(status_code=400, detail="alert_id and action required")
    
    user_id = current_user["id"]
    
    # Try watchtower store first
    try:
        from watchtower_store import get_watchtower_store
        watchtower = get_watchtower_store()
        if action in ("complete", "ignore"):
            await watchtower.handle_event(str(alert_id), user_id)
    except Exception as e:
        logger.warning(f"[alert-action] Watchtower handle failed: {e}")
    
    # Log the action to Supabase
    try:
        get_sb().table("alert_actions").insert({
            "user_id": user_id,
            "alert_id": str(alert_id),
            "action": action,
            "created_at": __import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),
        }).execute()
    except Exception as e:
        # Table may not exist yet — log and continue
        logger.warning(f"[alert-action] Log failed (table may not exist): {e}")
    
    return {"success": True, "action": action, "alert_id": alert_id}


@router.get("/intelligence/alerts/actions")
async def list_alert_actions(limit: int = 100, current_user: dict = Depends(get_current_user)):
    """List recorded alert actions for current user (latest first)."""
    user_id = current_user["id"]
    safe_limit = max(1, min(limit, 500))

    try:
        result = get_sb().table("alert_actions").select(
            "alert_id, action, created_at"
        ).eq("user_id", user_id).order("created_at", desc=True).limit(safe_limit).execute()

        return {
            "actions": result.data or [],
            "count": len(result.data or []),
        }
    except Exception as e:
        logger.warning(f"[alert-actions/list] Failed (table may not exist): {e}")
        return {
            "actions": [],
            "count": 0,
        }


@router.get("/workflows/delegate/providers")
async def get_delegate_providers(current_user: dict = Depends(get_current_user)):
    """Return available delegate providers and recommended auto-routing for this user."""
    user_id = current_user["id"]

    ticketing_row = await _get_ticketing_integration(user_id)
    ticketing_provider = _normalize_provider((ticketing_row or {}).get("provider"))
    has_outlook = bool(await _get_outlook_access_token(user_id))

    outlook_connected = False
    outlook_expired = False
    outlook_expires_at = None
    try:
        outlook_row = get_sb().table("outlook_oauth_tokens").select("expires_at").eq("user_id", user_id).limit(1).execute()
        if outlook_row.data:
            outlook_connected = True
            outlook_expires_at = outlook_row.data[0].get("expires_at")
            if outlook_expires_at:
                expiry = datetime.fromisoformat(str(outlook_expires_at).replace("Z", "+00:00"))
                outlook_expired = expiry <= datetime.now(timezone.utc)
    except Exception:
        pass

    gmail_connected = False
    gmail_needs_reconnect = False
    try:
        gmail_row = get_sb().table("gmail_connections").select("token_expiry").eq("user_id", user_id).limit(1).execute()
        if gmail_row.data:
            gmail_connected = True
            token_expiry = gmail_row.data[0].get("token_expiry")
            if token_expiry:
                expiry = datetime.fromisoformat(str(token_expiry).replace("Z", "+00:00"))
                gmail_needs_reconnect = expiry <= datetime.now(timezone.utc)
    except Exception:
        pass

    has_google_workspace = gmail_connected and not gmail_needs_reconnect

    task_pref = None
    cal_pref = None
    try:
        pref_row = get_sb().table("user_provider_preferences").select(
            "primary_task_provider, primary_calendar_provider"
        ).eq("user_id", user_id).maybe_single().execute()
        if pref_row and pref_row.data:
            task_pref = pref_row.data.get("primary_task_provider")
            cal_pref = pref_row.data.get("primary_calendar_provider")
    except Exception:
        pass

    recommended = _auto_delegate_provider(
        provider_preference="auto",
        ticketing_provider=ticketing_provider,
        has_outlook=has_outlook,
        has_google_workspace=has_google_workspace,
        task_preference=task_pref,
        calendar_preference=cal_pref,
    )

    providers = [
        {
            "id": "auto",
            "label": "Auto (based on connected business tools)",
            "available": recommended != "manual",
        },
        {
            "id": "manual",
            "label": "Manual follow-up",
            "available": True,
        },
        {
            "id": "jira",
            "label": "Jira (via Merge)",
            "available": "jira" in ticketing_provider,
        },
        {
            "id": "asana",
            "label": "Asana (via Merge)",
            "available": "asana" in ticketing_provider,
        },
        {
            "id": "merge-ticketing",
            "label": "Connected Ticketing Tool (via Merge)",
            "available": bool(ticketing_provider),
        },
        {
            "id": "outlook-exchange",
            "label": "Outlook / Exchange",
            "available": has_outlook,
        },
        {
            "id": "google-calendar",
            "label": "Google Calendar",
            "available": has_google_workspace,
        },
    ]

    return {
        "providers": providers,
        "recommended_provider": recommended,
        "connected_business_tools": {
            "ticketing_provider": ticketing_provider or None,
            "outlook_exchange": has_outlook,
            "outlook_connected": outlook_connected,
            "outlook_expired": outlook_expired,
            "outlook_expires_at": outlook_expires_at,
            "google_workspace": has_google_workspace,
            "gmail_connected": gmail_connected,
            "gmail_needs_reconnect": gmail_needs_reconnect,
        },
    }


@router.get("/workflows/delegate/options")
async def get_delegate_options(
    provider: str = "auto",
    current_user: dict = Depends(get_current_user),
):
    """Return provider-specific delegate options (assignees/projects/collaborators)."""
    from merge_client import get_merge_client

    user_id = current_user["id"]
    ticketing_row = await _get_ticketing_integration(user_id)
    ticketing_provider = _normalize_provider((ticketing_row or {}).get("provider"))
    has_outlook = bool(await _get_outlook_access_token(user_id))
    has_google_workspace = await _has_gmail_connection(user_id)

    selected_provider = _auto_delegate_provider(
        provider_preference=provider,
        ticketing_provider=ticketing_provider,
        has_outlook=has_outlook,
        has_google_workspace=has_google_workspace,
    )

    if selected_provider in ("jira", "asana", "merge-ticketing"):
        token = (ticketing_row or {}).get("account_token")
        if not token:
            return {"provider": selected_provider, "assignees": [], "collections": []}

        merge_client = get_merge_client()
        users_data, collections_data = await asyncio.gather(
            merge_client.get_ticketing_users(account_token=token, page_size=100),
            merge_client.get_ticketing_collections(account_token=token, page_size=100),
            return_exceptions=True,
        )

        users_results = users_data.get("results", []) if isinstance(users_data, dict) else []
        collections_results = collections_data.get("results", []) if isinstance(collections_data, dict) else []

        assignees = []
        for user in users_results[:100]:
            name = user.get("display_name") or " ".join(filter(None, [user.get("first_name"), user.get("last_name")])).strip()
            assignees.append({
                "id": user.get("id"),
                "name": name or user.get("email") or "Unlabelled user",
                "email": user.get("email"),
            })

        collections = [
            {
                "id": collection.get("id"),
                "name": collection.get("name") or collection.get("remote_data", {}).get("name") or "Untitled project",
            }
            for collection in collections_results[:100]
        ]

        return {
            "provider": selected_provider,
            "connected_provider": ticketing_provider,
            "assignees": assignees,
            "collections": collections,
        }

    if selected_provider == "outlook-exchange":
        collaborators = []
        try:
            intel = get_sb().table("calendar_intelligence").select("top_collaborators").eq("user_id", user_id).order("synced_at", desc=True).limit(1).execute()
            row = (intel.data or [{}])[0]
            top = row.get("top_collaborators") or []
            collaborators = [
                {
                    "id": person.get("name"),
                    "name": person.get("name"),
                    "email": person.get("email"),
                }
                for person in top if person.get("name")
            ]
        except Exception:
            collaborators = []

        return {
            "provider": selected_provider,
            "assignees": collaborators,
            "collections": [],
        }

    return {
        "provider": selected_provider,
        "assignees": [],
        "collections": [],
    }


@router.post("/workflows/delegate/execute")
async def execute_delegate_workflow(
    payload: DelegateWorkflowRequest,
    current_user: dict = Depends(get_current_user),
):
    """Execute delegate action through Merge (Jira/Asana) or Outlook/Exchange."""
    from merge_client import get_merge_client

    user_id = current_user["id"]
    ticketing_row = await _get_ticketing_integration(user_id)
    ticketing_provider = _normalize_provider((ticketing_row or {}).get("provider"))
    has_outlook = bool(await _get_outlook_access_token(user_id))
    has_google_workspace = await _has_gmail_connection(user_id)

    task_pref = None
    cal_pref = None
    try:
        pref_row = get_sb().table("user_provider_preferences").select(
            "primary_task_provider, primary_calendar_provider"
        ).eq("user_id", user_id).maybe_single().execute()
        if pref_row and pref_row.data:
            task_pref = pref_row.data.get("primary_task_provider")
            cal_pref = pref_row.data.get("primary_calendar_provider")
    except Exception:
        pass

    provider_used = _auto_delegate_provider(
        provider_preference=payload.provider_preference or "auto",
        ticketing_provider=ticketing_provider,
        has_outlook=has_outlook,
        has_google_workspace=has_google_workspace,
        task_preference=task_pref,
        calendar_preference=cal_pref,
    )

    if provider_used == "manual":
        return {
            "success": False,
            "provider_used": "manual",
            "status": "provider_not_connected",
            "message": "Connect Jira/Asana via Merge or Outlook/Exchange to enable delegation.",
        }

    external_reference = None
    execution_detail: Dict[str, Any] = {"provider": provider_used}

    if provider_used in ("jira", "asana", "merge-ticketing"):
        if not ticketing_row or not ticketing_row.get("account_token"):
            raise HTTPException(status_code=409, detail="Ticketing integration is not connected. Connect Jira/Asana via Merge first.")

        if provider_used in ("jira", "asana") and not _provider_matches_ticketing(provider_used, ticketing_provider):
            raise HTTPException(status_code=409, detail=f"{provider_used.title()} is not the connected ticketing provider for this workspace.")

        merge_client = get_merge_client()
        model: Dict[str, Any] = {
            "name": payload.decision_title[:180],
            "description": "\n".join([
                f"Decision: {payload.decision_title}",
                f"Summary: {payload.decision_summary or 'No summary provided.'}",
                f"Domain: {payload.domain or 'general'}",
                f"Severity: {payload.severity or 'medium'}",
                f"Assignee: {payload.assignee_name or payload.assignee_email or 'Unassigned'}",
                f"Due: {payload.due_at or 'Not set'}",
            ]),
            "priority": _severity_to_priority(payload.severity),
        }
        if payload.assignee_remote_id:
            model["assignees"] = [payload.assignee_remote_id]
        if payload.collection_remote_id:
            model["collections"] = [payload.collection_remote_id]
        if payload.due_at:
            model["due_date"] = payload.due_at

        created = await merge_client.create_ticket(
            account_token=ticketing_row["account_token"],
            model=model,
        )
        external_reference = created.get("id") or created.get("remote_id")
        execution_detail["result"] = created

    elif provider_used == "outlook-exchange":
        access_token = await _get_outlook_access_token(user_id)
        if not access_token:
            raise HTTPException(status_code=409, detail="Outlook/Exchange is not connected for this workspace.")

        start_dt = None
        if payload.due_at:
            try:
                start_dt = datetime.fromisoformat(payload.due_at.replace("Z", "+00:00")) - timedelta(minutes=30)
            except Exception:
                start_dt = None
        if not start_dt:
            start_dt = datetime.now(timezone.utc) + timedelta(hours=24)
        end_dt = start_dt + timedelta(minutes=30)

        event_body = {
            "subject": f"Delegate: {payload.decision_title}",
            "body": {
                "contentType": "Text",
                "content": payload.decision_summary or "Delegated from BIQc Advisor workflow.",
            },
            "start": {
                "dateTime": start_dt.astimezone(timezone.utc).isoformat(),
                "timeZone": "UTC",
            },
            "end": {
                "dateTime": end_dt.astimezone(timezone.utc).isoformat(),
                "timeZone": "UTC",
            },
        }
        if payload.assignee_email:
            event_body["attendees"] = [{
                "emailAddress": {
                    "address": payload.assignee_email,
                    "name": payload.assignee_name or payload.assignee_email,
                },
                "type": "required",
            }]

        async with httpx.AsyncClient(timeout=25) as client:
            response = await client.post(
                "https://graph.microsoft.com/v1.0/me/events",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                },
                json=event_body,
            )
        if response.status_code not in (200, 201):
            error_text = response.text or ""
            if "InvalidAuthenticationToken" in error_text or "token is expired" in error_text.lower():
                raise HTTPException(status_code=409, detail="Outlook/Exchange token expired. Please reconnect Outlook and retry delegation.")
            raise HTTPException(status_code=502, detail=f"Outlook delegation failed: {response.text}")

        created_event = response.json()
        external_reference = created_event.get("id")
        execution_detail["result"] = {
            "id": created_event.get("id"),
            "webLink": created_event.get("webLink"),
        }

    elif provider_used == "google-calendar":
        raise HTTPException(status_code=409, detail="Google Calendar delegation requires a dedicated Calendar OAuth token. Connect Google Calendar first.")

    try:
        get_sb().table("alert_actions").insert({
            "user_id": user_id,
            "alert_id": str(payload.decision_id or payload.decision_title),
            "action": "hand-off",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
    except Exception:
        pass

    try:
        get_sb().table("workflow_actions").insert({
            "user_id": user_id,
            "provider": provider_used,
            "action_type": "delegate",
            "payload": {
                "decision_id": payload.decision_id,
                "decision_title": payload.decision_title,
                "assignee_name": payload.assignee_name,
                "assignee_email": payload.assignee_email,
                "due_at": payload.due_at,
                "domain": payload.domain,
                "severity": payload.severity,
            },
            "status": "completed",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
    except Exception:
        # Non-blocking if workflow_actions table is not present in environment.
        pass

    return {
        "success": True,
        "provider_used": provider_used,
        "external_reference": external_reference,
        "detail": execution_detail,
    }


@router.post("/workflows/decision-feedback")
async def record_decision_feedback(
    payload: DecisionFeedbackRequest,
    current_user: dict = Depends(get_current_user),
):
    """Store decision helpfulness feedback for cognition tuning loops."""
    user_id = current_user["id"]

    try:
        get_sb().table("decision_feedback").insert({
            "user_id": user_id,
            "decision_key": payload.decision_key,
            "helpful": payload.helpful,
            "reason": payload.reason,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
        return {"success": True, "stored": True}
    except Exception:
        return {"success": True, "stored": False}


@router.get("/advisor/executive-surface")
async def get_advisor_executive_surface(current_user: dict = Depends(get_current_user)):
    """
    Build a concrete, plain-language executive decision surface from connected integrations.
    This endpoint is designed for high-trust card summaries on /advisor.
    """
    user_id = current_user["id"]
    user_email = str(current_user.get("email") or "").strip().lower()
    founder_email = (os.environ.get("BIQC_MASTER_ADMIN_EMAIL") or "").strip().lower()
    is_founder_ops_account = bool(founder_email and user_email == founder_email)

    def _parse_dt(value: Optional[str]) -> Optional[datetime]:
        if not value:
            return None
        try:
            return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except Exception:
            return None

    def _days_since(value: Optional[str]) -> int:
        parsed = _parse_dt(value)
        if not parsed:
            return 0
        return max(0, (datetime.now(timezone.utc) - parsed).days)

    connected_tools: Dict[str, Any] = {}
    crm_deals: List[Dict[str, Any]] = []
    accounting_summary: Dict[str, Any] = {}
    watchtower_events: List[Dict[str, Any]] = []
    priority_analysis: Dict[str, Any] = {}

    try:
        merge_connected = await get_connected_merge_integrations(current_user=current_user)
        connected_tools = merge_connected.get("integrations", {})
    except Exception:
        connected_tools = {}

    try:
        crm_data = await get_crm_deals(page_size=100, current_user=current_user)
        crm_deals = crm_data.get("results", []) or []
    except Exception:
        crm_deals = []

    try:
        accounting_summary = await get_accounting_summary(current_user=current_user)
    except Exception:
        accounting_summary = {"connected": False, "metrics": {}}

    try:
        watchtower_data = await get_watchtower_events(limit=30, current_user=current_user)
        watchtower_events = watchtower_data.get("events", []) or []
    except Exception:
        watchtower_events = []

    try:
        from supabase_intelligence_helpers import get_priority_analysis_supabase
        priority_row = await get_priority_analysis_supabase(get_sb(), user_id) or {}
        if isinstance(priority_row.get("analysis"), dict):
            priority_analysis = priority_row.get("analysis") or {}
        else:
            priority_analysis = priority_row or {}
    except Exception:
        priority_analysis = {}

    generated_at = datetime.now(timezone.utc).isoformat()

    open_deals = [deal for deal in crm_deals if str(deal.get("status") or "").upper() == "OPEN"]
    stalled_deals = []
    for deal in open_deals:
        days_idle = _days_since(deal.get("last_activity_at") or deal.get("last_modified_at") or deal.get("created_at"))
        if days_idle >= 3:
            stalled_deals.append({
                "name": deal.get("name") or "Unnamed opportunity",
                "days_idle": days_idle,
                "value": deal.get("value") or deal.get("amount"),
            })
    stalled_deals.sort(key=lambda item: item["days_idle"], reverse=True)

    metrics = accounting_summary.get("metrics") or {}
    overdue_count = int(metrics.get("overdue_count") or 0)
    total_overdue = float(metrics.get("total_overdue") or 0)
    total_outstanding = float(metrics.get("total_outstanding") or 0)
    overdue_count_supplier = int(metrics.get("overdue_count_supplier") or 0)
    total_overdue_supplier = float(metrics.get("total_overdue_supplier") or 0)
    accounting_error = accounting_summary.get("error") if isinstance(accounting_summary, dict) else None

    high_priority_threads = priority_analysis.get("high_priority") or []
    medium_priority_threads = priority_analysis.get("medium_priority") or []
    low_priority_threads = priority_analysis.get("low_priority") or []
    priority_analysis_available = bool(high_priority_threads or medium_priority_threads or low_priority_threads)

    accounting_provider = "Accounting System"
    email_provider = "Outlook"
    for entry in connected_tools.values():
        if str(entry.get("category") or "").lower() == "accounting" and entry.get("provider"):
            accounting_provider = str(entry.get("provider"))
            break

    email_connected = False
    for entry in connected_tools.values():
        if str(entry.get("category") or "").lower() == "email" and bool(entry.get("connected")):
            email_connected = True
            if entry.get("provider"):
                email_provider = str(entry.get("provider"))

    response_delay_events = []
    for event in watchtower_events:
        title_blob = f"{event.get('title', '')} {event.get('event', '')} {event.get('summary', '')}".lower()
        if "response" in title_blob or "delay" in title_blob or "silence" in title_blob:
            response_delay_events.append(event)

    candidate_signals = []

    if stalled_deals:
        top_examples = ", ".join([f"{item['name']} ({item['days_idle']}d)" for item in stalled_deals[:3]])
        candidate_signals.append({
            "signal_key": "crm-stalled-opportunities",
            "bucket_hint": "decide_now",
            "risk_score": min(95, 55 + len(stalled_deals)),
            "confidence_interval": "68–84%",
            "source": "HubSpot CRM",
            "timestamp": generated_at,
            "signal_summary": f"{len(stalled_deals)} opportunities have had no activity for more than 72 hours.",
            "evidence_summary": f"Examples: {top_examples}",
            "decision_summary": "Revenue conversion is at risk unless owners re-engage these opportunities immediately.",
            "consequence": "Expected conversion probability can drop 12–18% this week if these remain idle.",
            "action_summary": "Assign top stalled opportunities to named owners and send follow-up today.",
            "evidence_refs": stalled_deals[:5],
        })

    if overdue_count > 0:
        candidate_signals.append({
            "signal_key": "xero-overdue-invoices",
            "bucket_hint": "decide_now",
            "risk_score": min(97, 58 + overdue_count),
            "confidence_interval": "72–88%",
            "source": "Xero Accounting",
            "timestamp": generated_at,
            "signal_summary": f"{overdue_count} invoices are overdue with {total_overdue:,.0f} outstanding.",
            "evidence_summary": (
                f"Source: {accounting_provider} via Merge accounting sync. "
                f"Computed from client receivable invoices only (AR), excluding supplier bills (AP), "
                f"from paginated invoice scan (up to 1,000 records) where status is OVERDUE or due date is past today. "
                f"Outstanding ledger snapshot: {total_outstanding:,.0f}."
            ),
            "decision_summary": "Cashflow pressure is rising and collections actions should be triggered now.",
            "consequence": "Ignoring this may create near-term cash shortfall and delayed payroll/vendor payments.",
            "action_summary": "Trigger reminder sequence and call top overdue clients today.",
            "evidence_refs": [{
                "provider": accounting_provider,
                "source_endpoint": "/integrations/accounting/summary",
                "window": "paginated scan up to 1,000 invoices",
                "rule": "CLIENT invoices only: status == OVERDUE OR due_date < today",
                "overdue_count": overdue_count,
                "total_overdue": total_overdue,
                "total_outstanding": total_outstanding,
                "overdue_count_supplier": overdue_count_supplier,
                "total_overdue_supplier": total_overdue_supplier,
            }],
        })

    if accounting_error:
        if is_founder_ops_account:
            error_signal_summary = "ERROR: Xero live data feed is unavailable."
            error_decision_summary = "A non-live or failed accounting API state was detected and requires immediate remediation before client-facing use."
            error_action_summary = "ERROR — investigate Merge/Xero token health and API state immediately, then run Refresh intelligence."
        else:
            error_signal_summary = "Xero data could not be refreshed."
            error_decision_summary = "Cash exposure cannot be verified until accounting authentication is restored."
            error_action_summary = "Reconnect integration. If this persists, contact support."

        candidate_signals.append({
            "signal_key": "accounting-sync-unavailable",
            "bucket_hint": "decide_now",
            "risk_score": 86,
            "confidence_interval": "91–97%",
            "source": f"{accounting_provider} Accounting",
            "timestamp": generated_at,
            "signal_summary": error_signal_summary,
            "evidence_summary": str(accounting_error),
            "decision_summary": error_decision_summary,
            "consequence": "You may be making cash decisions blind while receivables risk is hidden.",
            "action_summary": error_action_summary,
            "evidence_refs": [{"provider": accounting_provider, "error": str(accounting_error)}],
        })

    if response_delay_events:
        candidate_signals.append({
            "signal_key": "communications-response-delay",
            "bucket_hint": "monitor_this_week",
            "risk_score": min(90, 50 + len(response_delay_events) * 4),
            "confidence_interval": "61–79%",
            "source": "Outlook / Communications",
            "timestamp": response_delay_events[0].get("timestamp") or datetime.now(timezone.utc).isoformat(),
            "signal_summary": f"{len(response_delay_events)} communication threads indicate delayed response patterns.",
            "evidence_summary": response_delay_events[0].get("summary") or response_delay_events[0].get("detail") or "Watchtower detected response latency.",
            "decision_summary": "Service responsiveness is trending down and requires active owner monitoring.",
            "consequence": "Delayed responses increase churn risk and reduce trust for high-value clients.",
            "action_summary": "Prioritise overdue client threads and enforce a same-day response SLA.",
            "evidence_refs": response_delay_events[:5],
        })

    if high_priority_threads:
        candidate_signals.append({
            "signal_key": "priority-inbox-threads",
            "bucket_hint": "monitor_this_week",
            "risk_score": min(88, 48 + len(high_priority_threads) * 5),
            "confidence_interval": "64–82%",
            "source": "Priority Inbox",
            "timestamp": generated_at,
            "signal_summary": f"{len(high_priority_threads)} high-priority threads need owner attention.",
            "evidence_summary": high_priority_threads[0].get("reason") or high_priority_threads[0].get("subject") or "High-priority thread detected.",
            "decision_summary": "Customer and commercial communications need focused triage this week.",
            "consequence": "Unresolved high-priority threads can escalate into churn and delayed revenue collection.",
            "action_summary": "Review and clear top-priority inbox items before end of day.",
            "evidence_refs": high_priority_threads[:5],
        })

    if email_connected and not priority_analysis_available and not response_delay_events:
        if is_founder_ops_account:
            email_signal_summary = f"ERROR: {email_provider} priority inbox analysis is unavailable."
            email_decision_summary = "Email API output is non-live or not generated yet, so communication risk cannot be trusted for client-facing decisions."
            email_action_summary = "ERROR — run email priority analysis now and verify Outlook pipeline health."
        else:
            email_signal_summary = f"{email_provider} priority inbox analysis is unavailable."
            email_decision_summary = "Communication risk cannot be verified until inbox analysis is generated."
            email_action_summary = "Reconnect integration or contact support, then re-run intelligence refresh."

        candidate_signals.append({
            "signal_key": "priority-inbox-unavailable",
            "bucket_hint": "monitor_this_week",
            "risk_score": 74,
            "confidence_interval": "83–92%",
            "source": f"{email_provider} / Priority Inbox",
            "timestamp": generated_at,
            "signal_summary": email_signal_summary,
            "evidence_summary": "No persisted priority inbox analysis found for this user session.",
            "decision_summary": email_decision_summary,
            "consequence": "Client follow-up and escalation risks may go unnoticed without an owner-prioritized inbox.",
            "action_summary": email_action_summary,
            "evidence_refs": [{
                "provider": email_provider,
                "source_endpoint": "/email/priority-inbox",
                "analysis_present": priority_analysis_available,
            }],
        })

    if stalled_deals or overdue_count > 0 or response_delay_events:
        candidate_signals.append({
            "signal_key": "systemic-followup-gap",
            "bucket_hint": "build_next",
            "risk_score": 62,
            "confidence_interval": "58–74%",
            "source": "Cross-Integration Pattern",
            "timestamp": generated_at,
            "signal_summary": "Recurring follow-up gaps are appearing across CRM, accounting, and communications.",
            "evidence_summary": "Signals show repeated delay patterns rather than a one-off anomaly.",
            "decision_summary": "A system-level process fix is needed to stop repeated follow-up failures.",
            "consequence": "Without process change, the same revenue/cash/service risks will recur every cycle.",
            "action_summary": "Build an owner cadence: daily overdue review, deal aging alerts, and response SLA dashboard.",
            "evidence_refs": [],
        })

    candidate_signals.sort(key=lambda item: item.get("risk_score", 0), reverse=True)

    def pull(bucket_hint: str):
        for idx, signal in enumerate(candidate_signals):
            if signal.get("bucket_hint") == bucket_hint:
                return candidate_signals.pop(idx)
        return candidate_signals.pop(0) if candidate_signals else None

    decide_now = pull("decide_now")
    monitor_this_week = pull("monitor_this_week")
    build_next = pull("build_next")

    cards = {
        "decide_now": decide_now,
        "monitor_this_week": monitor_this_week,
        "build_next": build_next,
    }

    all_clear = all(card is None for card in cards.values())

    cash_provenance = {
        "source": f"{accounting_provider} via Merge Accounting API",
        "query": "GET /integrations/accounting/summary",
        "window": "paginated scan up to 1,000 invoices",
        "rule": "overdue_count increments when status == OVERDUE OR due_date < today",
        "summary": (
            f"From {accounting_provider} via Merge (CLIENT invoices only): {overdue_count} overdue invoices totaling "
            f"{total_overdue:,.0f}, with {total_outstanding:,.0f} total outstanding."
        ),
        "generated_at": generated_at,
        "status": "ok",
        "client_invoices_only": True,
        "supplier_excluded": True,
        "supplier_overdue_count": overdue_count_supplier,
        "supplier_overdue_total": total_overdue_supplier,
    }

    if accounting_error:
        if is_founder_ops_account:
            cash_error_summary = f"ERROR: non-live accounting API detected — {str(accounting_error)}"
        else:
            cash_error_summary = "Accounting feed unavailable. Reconnect integration or contact support."

        cash_provenance.update({
            "status": "unavailable",
            "summary": cash_error_summary,
        })

    return {
        "all_clear": all_clear,
        "connected_tools": connected_tools,
        "snapshot": {
            "open_deals": len(open_deals),
            "stalled_deals_72h": len(stalled_deals),
            "overdue_invoices": overdue_count,
            "total_overdue": total_overdue,
            "total_outstanding": total_outstanding,
            "overdue_supplier_invoices": overdue_count_supplier,
            "total_overdue_supplier": total_overdue_supplier,
            "response_delay_events": len(response_delay_events),
            "high_priority_threads": len(high_priority_threads),
            "priority_analysis_available": priority_analysis_available,
            "email_connected": email_connected,
            "accounting_error": accounting_error,
            "accounting_live_status": "unavailable" if accounting_error else "live",
        },
        "provenance": {
            "cash_exposure": cash_provenance
        },
        "cards": cards,
    }



@router.patch("/intelligence/watchtower/{event_id}/handle")
async def handle_watchtower_event(
    event_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Mark a Watchtower event as handled
    """
    from watchtower_store import get_watchtower_store
    
    user_id = current_user["id"]
    
    watchtower = get_watchtower_store()
    success = await watchtower.handle_event(event_id, user_id)
    
    return {
        "success": success
    }
    pass  # No local client cleanup needed


# ==================== GOOGLE DRIVE INTEGRATION (MERGE.DEV) ====================

@router.post("/integrations/google-drive/connect")
async def connect_google_drive(current_user: dict = Depends(get_current_user)):
    """
    Generate Merge Link Token for Google Drive connection
    100% Supabase storage
    """
    from workspace_helpers import get_or_create_user_account
    
    merge_api_key = os.environ.get("MERGE_API_KEY")
    if not merge_api_key:
        raise HTTPException(status_code=500, detail="MERGE_API_KEY not configured")
    
    user_id = current_user["id"]
    user_email = current_user.get("email")
    
    # Get workspace
    account = await get_or_create_user_account(get_sb(), user_id, user_email)
    account_id = account["id"]
    account_name = account["name"]
    
    logger.info(f"🔗 Creating Google Drive link token for workspace: {account_name}")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.merge.dev/api/integrations/create-link-token",
                headers={
                    "Authorization": f"Bearer {merge_api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "end_user_origin_id": account_id,
                    "end_user_organization_name": account_name,
                    "end_user_email_address": user_email,
                    "categories": ["file_storage"]  # Google Drive category
                }
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail=response.text)
            
            data = response.json()
            link_token = data.get("link_token")
            
            if not link_token:
                raise HTTPException(status_code=500, detail="No link_token in response")
            
            logger.info(f"✅ Google Drive link token created")
            return {"link_token": link_token}
            
    except Exception as e:
        logger.error(f"❌ Error creating link token: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/integrations/google-drive/callback")
async def google_drive_callback(
    public_token: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Handle Google Drive connection callback from Merge.dev
    Stores account_token in Supabase and triggers initial sync
    """
    from workspace_helpers import get_user_account
    from supabase_drive_helpers import store_merge_integration
    
    merge_api_key = os.environ.get("MERGE_API_KEY")
    user_id = current_user["id"]
    
    # Get workspace
    account = await get_user_account(get_sb(), user_id)
    if not account:
        raise HTTPException(status_code=400, detail="Workspace not initialized")
    
    account_id = account["id"]
    
    # Exchange public_token for account_token
    try:
        async with httpx.AsyncClient() as client:
            exchange_url = f"https://api.merge.dev/api/integrations/account-token/{public_token}"
            
            response = await client.get(
                exchange_url,
                headers={"Authorization": f"Bearer {merge_api_key}"}
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail=response.text)
            
            data = response.json()
            account_token = data.get("account_token")
            integration_info = data.get("integration", {})
            
            if not account_token:
                raise HTTPException(status_code=500, detail="No account_token received")
            
            # Store integration in Supabase
            integration_data = {
                "account_id": account_id,
                "user_id": user_id,
                "account_token": account_token,
                "integration_category": "file_storage",
                "integration_slug": "google_drive",
                "integration_name": integration_info.get("name", "Google Drive"),
                "status": "active",
                "connected_at": datetime.now(timezone.utc).isoformat(),
                "end_user_email": current_user.get("email")
            }
            
            await store_merge_integration(get_sb(), integration_data)
            
            logger.info(f"✅ Google Drive connected for workspace {account_id}")
            
            queued = await enqueue_job(
                "drive-sync",
                {
                    "user_id": user_id,
                    "account_id": account_id,
                    "account_token": account_token,
                    "workspace_id": user_id,
                },
                company_id=user_id,
                window_seconds=120,
            )

            if queued.get("queued"):
                return {
                    "status": "queued",
                    "job_type": "drive-sync",
                    "job_id": queued.get("job_id"),
                    "success": True,
                    "message": "Google Drive connected successfully. Initial sync queued.",
                    "provider": "Google Drive"
                }

            await sync_google_drive_files(user_id, account_id, account_token)
            return {
                "success": True,
                "message": "Google Drive connected successfully",
                "provider": "Google Drive"
            }
            
    except Exception as e:
        logger.error(f"❌ Google Drive callback error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def sync_google_drive_files(user_id: str, account_id: str, account_token: str):
    """
    Background task: Sync Google Drive files to Supabase
    100% PostgreSQL storage
    """
    from merge_client import get_merge_client
    from supabase_drive_helpers import store_drive_files_batch, update_merge_integration_sync
    
    try:
        logger.info(f"🔄 Starting Google Drive sync for account {account_id}")
        
        merge_client = get_merge_client()
        
        # Fetch files from Merge API
        files_response = await merge_client.get_files(account_token)
        files = files_response.get("results", [])
        
        logger.info(f"📥 Fetched {len(files)} files from Google Drive")
        
        if not files:
            logger.info("ℹ️ No files found")
            return
        
        # Transform files for Supabase storage
        supabase_files = []
        for file in files:
            file_data = {
                "account_id": account_id,
                "user_id": user_id,
                "merge_file_id": file.get("id"),
                "merge_account_token": account_token,
                "file_name": file.get("name", "Untitled"),
                "file_type": file.get("file_type"),
                "mime_type": file.get("mime_type"),
                "file_size": file.get("size"),
                "parent_folder_id": file.get("folder"),
                "web_view_link": file.get("file_url"),
                "owner_email": file.get("owner", {}).get("email") if isinstance(file.get("owner"), dict) else None,
                "created_at": file.get("created_at") or datetime.now(timezone.utc).isoformat(),
                "modified_at": file.get("modified_at") or datetime.now(timezone.utc).isoformat(),
                "synced_at": datetime.now(timezone.utc).isoformat()
            }
            supabase_files.append(file_data)
        
        # Batch insert to Supabase
        stored_count = await store_drive_files_batch(get_sb(), supabase_files)
        
        logger.info(f"✅ Stored {stored_count} Google Drive files in Supabase")
        
        # Update integration sync status
        await update_merge_integration_sync(
            supabase_admin,
            account_token,
            {
                "last_sync_at": datetime.now(timezone.utc).isoformat(),
                "sync_stats": {"files_synced": stored_count, "last_sync_success": True}
            }
        )
        
    except Exception as e:
        logger.error(f"❌ Google Drive sync failed: {e}")


@router.get("/integrations/google-drive/files")
async def get_google_drive_files(
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """
    Get Google Drive files from Supabase
    100% PostgreSQL
    """
    from supabase_drive_helpers import get_user_drive_files
    
    user_id = current_user["id"]
    
    files = await get_user_drive_files(get_sb(), user_id, limit=limit)
    
    return {
        "files": files,
        "count": len(files)
    }


@router.post("/integrations/google-drive/sync")
async def trigger_google_drive_sync(current_user: dict = Depends(get_current_user)):
    """
    Manually trigger Google Drive sync
    Fetches latest files from Merge.dev and stores in Supabase
    """
    from workspace_helpers import get_user_account
    from supabase_drive_helpers import get_user_merge_integrations
    
    user_id = current_user["id"]
    
    # Get workspace
    account = await get_user_account(get_sb(), user_id)
    if not account:
        raise HTTPException(status_code=400, detail="Workspace not initialized")
    
    account_id = account["id"]
    
    # Get Google Drive integration
    integrations = await get_user_merge_integrations(
        supabase_admin,
        user_id,
        integration_category="file_storage"
    )
    
    drive_integration = next(
        (i for i in integrations if i.get("integration_slug") == "google_drive"),
        None
    )
    
    if not drive_integration:
        raise HTTPException(status_code=404, detail="Google Drive not connected")
    
    account_token = drive_integration["account_token"]
    
    queued = await enqueue_job(
        "drive-sync",
        {
            "user_id": user_id,
            "account_id": account_id,
            "account_token": account_token,
            "workspace_id": user_id,
        },
        company_id=user_id,
        window_seconds=120,
    )

    if queued.get("queued"):
        return {
            "status": "queued",
            "job_type": "drive-sync",
            "job_id": queued.get("job_id"),
            "success": True,
            "message": "Sync queued. Files will be available shortly."
        }

    await sync_google_drive_files(user_id, account_id, account_token)
    return {
        "success": True,
        "message": "Sync started. Files will be available shortly."
    }


@router.get("/integrations/google-drive/status")
async def google_drive_status(current_user: dict = Depends(get_current_user)):
    """
    Check if Google Drive is connected
    """
    from supabase_drive_helpers import get_user_merge_integrations, count_user_drive_files
    
    user_id = current_user["id"]
    
    # Check for integration
    try:
        integrations = await get_user_merge_integrations(
            get_sb(),
            user_id,
            integration_category="file_storage"
        )
    except Exception as e:
        logger.warning("[google-drive/status] merge lookup failed: %s", e)
        return {
            "connected": False,
            "files_count": 0,
            "status": "unavailable",
        }
    
    drive_integration = next(
        (i for i in integrations if i.get("integration_slug") == "google_drive"),
        None
    )
    
    if not drive_integration:
        return {
            "connected": False,
            "files_count": 0
        }
    
    # Count files
    files_count = await count_user_drive_files(get_sb(), user_id)
    
    return {
        "connected": True,
        "integration_name": drive_integration.get("integration_name", "Google Drive"),
        "connected_at": drive_integration.get("connected_at"),
        "last_sync_at": drive_integration.get("last_sync_at"),
        "files_count": files_count,
        "status": drive_integration.get("status", "active")
    }


@router.post("/integrations/google-drive/disconnect")
async def google_drive_disconnect(current_user: dict = Depends(get_current_user)):
    """Disconnect Google Drive integration and remove stored tokens/files."""
    user_id = current_user["id"]
    try:
        # Remove integration record
        get_sb().table("integration_accounts").delete().eq(
            "user_id", user_id
        ).eq("integration_slug", "google_drive").execute()

        # Remove synced files
        get_sb().table("data_files").delete().eq(
            "user_id", user_id
        ).eq("source", "google_drive").execute()

        logger.info(f"[google-drive/disconnect] Disconnected for {user_id}")
        await invalidate_cached_integration_status(user_id)
        return {"ok": True, "message": "Google Drive disconnected successfully"}
    except Exception as e:
        logger.error(f"[google-drive/disconnect] Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to disconnect Google Drive")




# ═══════════════════════════════════════════════════════════════
# CHANNEL INTELLIGENCE — Integration Status + Data Aggregation
# ═══════════════════════════════════════════════════════════════

CHANNEL_REGISTRY = [
    {"key": "crm", "name": "CRM", "desc": "HubSpot, Salesforce, Pipedrive", "color": "#FF7A59", "merge_category": "crm"},
    {"key": "google_ads", "name": "Google Ads", "desc": "Search, Display, YouTube", "color": "#4285F4", "merge_category": None},
    {"key": "meta_ads", "name": "Meta Ads", "desc": "Facebook, Instagram", "color": "#1877F2", "merge_category": None},
    {"key": "linkedin", "name": "LinkedIn", "desc": "Campaigns, Leads", "color": "#0A66C2", "merge_category": None},
    {"key": "analytics", "name": "Analytics", "desc": "GA4, Mixpanel", "color": "#E37400", "merge_category": None},
    {"key": "email_platform", "name": "Email Platform", "desc": "Mailchimp, ActiveCampaign", "color": "#FFE01B", "merge_category": None},
]


@router.get("/integrations/channels/status")
async def get_channel_status(current_user: dict = Depends(get_current_user)):
    """
    Return connection status for all marketing channels.
    Checks Merge.dev integrations + direct integrations.
    """
    from workspace_helpers import get_user_account, get_account_integrations

    user_id = current_user["id"]
    channels = []

    # Get Merge.dev connected integrations
    merge_connected = {}
    try:
        account = await get_user_account(get_sb(), user_id)
        if account:
            account_id = account["id"]
            records = await get_account_integrations(get_sb(), account_id)
            for rec in records:
                cat = rec.get("category", "")
                provider = rec.get("provider", "")
                if cat == "crm" and rec.get("merge_account_id"):
                    merge_connected["crm"] = {
                        "provider": provider,
                        "connected_at": rec.get("connected_at") or rec.get("created_at"),
                    }
    except Exception as e:
        logger.warning(f"[channels] Merge check failed: {e}")

    # Check email connections (Outlook/Gmail via Supabase)
    email_connected = False
    try:
        email_res = get_sb().table("email_connections").select("id, provider").eq("user_id", user_id).limit(1).execute()
        email_data = email_res.data if email_res else None
        if email_data and len(email_data) > 0:
            email_connected = True
    except Exception:
        pass

    # Check Google Drive
    drive_connected = False
    try:
        drive_res = get_sb().table("integration_accounts").select("id").eq("user_id", user_id).eq("integration_slug", "google_drive").limit(1).execute()
        drive_data = drive_res.data if drive_res else None
        if drive_data and len(drive_data) > 0:
            drive_connected = True
    except Exception:
        pass

    # Build channel status list
    for ch in CHANNEL_REGISTRY:
        status = "not_connected"
        provider_name = None
        connected_at = None

        if ch["key"] == "crm" and "crm" in merge_connected:
            status = "connected"
            provider_name = merge_connected["crm"]["provider"]
            connected_at = merge_connected["crm"]["connected_at"]
        elif ch["key"] == "email_platform" and email_connected:
            status = "connected"

        channels.append({
            "key": ch["key"],
            "name": ch["name"],
            "description": ch["desc"],
            "color": ch["color"],
            "status": status,
            "provider": provider_name,
            "connected_at": connected_at,
            "available": ch["merge_category"] is not None or ch["key"] == "crm",
        })

    # Get forensic calibration status
    forensic_done = False
    try:
        op_res = get_sb().table("user_operator_profile").select("operator_profile").eq("user_id", user_id).maybe_single().execute()
        op_data = op_res.data if op_res else None
        if op_data:
            op = op_data.get("operator_profile") or {}
            forensic_done = bool(op.get("forensic_calibration"))
    except Exception:
        pass

    return {
        "channels": channels,
        "summary": {
            "total": len(channels),
            "connected": sum(1 for c in channels if c["status"] == "connected"),
            "available": sum(1 for c in channels if c["available"]),
        },
        "forensic_calibration_complete": forensic_done,
        "email_connected": email_connected,
        "drive_connected": drive_connected,
    }


# ═══════════════════════════════════════════════════════════════
# UNIFIED INTEGRATION STATUS — Sprint 2
# GET  /user/integration-status
# POST /user/integration-status/sync
# ═══════════════════════════════════════════════════════════════

async def _upsert_integration_status(sb, user_id: str, integration_name: str, category: str,
                                     connected: bool, provider: str = None,
                                     records_count: int = 0, record_type: str = None,
                                     last_sync_at: str = None, error_message: str = None):
    """Upsert a single integration status row — non-blocking."""
    try:
        row = {
            "user_id": user_id,
            "integration_name": integration_name,
            "category": category,
            "connected": connected,
            "provider": provider or integration_name,
            "records_count": records_count,
            "record_type": record_type,
            "last_sync_at": last_sync_at or datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if error_message:
            row["error_message"] = error_message
        sb.table("integration_status").upsert(row, on_conflict="user_id,integration_name").execute()
    except Exception as e:
        logger.warning(f"[integration-status] upsert failed (non-critical): {e}")


@router.get("/user/integration-status")
async def get_user_integration_status(current_user: dict = Depends(get_current_user)):
    """
    Unified integration status — granular per-integration connection state.
    Returns connected status, record counts, last sync time, and error messages.
    """
    user_id = current_user["id"]
    cached = await get_cached_integration_status(user_id)
    if cached:
        return cached
    sb = get_sb()
    live_truth = get_live_integration_truth(sb, user_id)
    integrations = []

    record_type_map = {
        "crm": "deals",
        "accounting": "invoices",
        "hris": "employees",
        "ats": "candidates",
        "file_storage": "files",
        "email": "emails",
    }

    status_map = {}
    connector_truth = live_truth.get("connector_truth") or {}
    try:
        status_rows = sb.table("integration_status").select(
            "integration_name, provider, category, records_count, record_type, last_sync_at, error_message"
        ).eq("user_id", user_id).execute()
        for row in (status_rows.data or []):
            for key in (row.get("integration_name"), row.get("provider")):
                if key:
                    status_map[str(key).strip().lower()] = row
    except Exception as e:
        logger.warning(f"[integration-status] cached status lookup failed: {e}")

    for item in (live_truth.get("integrations") or []):
        category = normalize_category(item.get("category"), item.get("provider"), item.get("integration_slug"))
        provider = item.get("provider") or item.get("integration_name") or category
        status_row = status_map.get(str(item.get("integration_name") or "").lower()) or status_map.get(str(provider).lower())

        integrations.append({
            "integration_name": item.get("integration_name") or provider,
            "category": category,
            "connected": True,
            "provider": provider,
            "connected_at": item.get("connected_at"),
            "records_count": (status_row or {}).get("records_count", 0),
            "record_type": (status_row or {}).get("record_type") or record_type_map.get(category, "records"),
            "last_sync_at": (status_row or {}).get("last_sync_at") or item.get("connected_at"),
            "error_message": (status_row or {}).get("error_message"),
            "truth_state": item.get("truth_state") or (connector_truth.get(category) or {}).get("truth_state"),
            "truth_reason": item.get("truth_reason") or (connector_truth.get(category) or {}).get("truth_reason"),
            "last_verified_at": item.get("last_verified_at") or (connector_truth.get(category) or {}).get("last_verified_at"),
            "next_expected_update": item.get("next_expected_update") or (connector_truth.get(category) or {}).get("next_expected_update"),
        })

    connected_categories = {normalize_category(i.get("category")) for i in integrations if i.get("connected")}
    for category in ("crm", "accounting", "email", "hris"):
        if category not in connected_categories:
            integrations.append({
                "integration_name": category,
                "category": category,
                "connected": False,
                "provider": None,
                "connected_at": None,
                "records_count": 0,
                "record_type": record_type_map.get(category),
                "last_sync_at": None,
                "error_message": None,
                "truth_state": (connector_truth.get(category) or {}).get("truth_state"),
                "truth_reason": (connector_truth.get(category) or {}).get("truth_reason"),
                "last_verified_at": (connector_truth.get(category) or {}).get("last_verified_at"),
                "next_expected_update": (connector_truth.get(category) or {}).get("next_expected_update"),
            })

    observation_state = get_recent_observation_events(sb, user_id, limit=1)
    canonical_truth = {
        **(live_truth.get("canonical_truth") or {}),
        "live_signal_count": observation_state.get("count", 0),
        "last_signal_at": observation_state.get("last_signal_at"),
    }

    payload = {
        "integrations": integrations,
        "canonical_truth": canonical_truth,
        "total_connected": canonical_truth.get("total_connected", 0),
    }
    await set_cached_integration_status(user_id, payload)
    return payload


@router.get("/integrations/connectors")
async def get_all_connector_status(current_user: dict = Depends(get_current_user)):
    """Integration Centre v1 — unified connector status for all integration types."""
    user_id = current_user["id"]
    sb = get_sb()
    try:
        connector_truth = get_connector_truth_summary(sb, user_id)
    except Exception:
        connector_truth = {}
    connectors: List[Dict[str, Any]] = []

    def append_merge_connector(category: str, eid: str, title: str, cat_label: str, default_provider: str):
        row = None
        try:
            res = (
                sb.table("integration_accounts")
                .select("*")
                .eq("user_id", user_id)
                .eq("category", category)
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            row = res.data[0] if res.data else None
        except Exception:
            row = None

        truth = connector_truth.get(category) or {}
        truth_err = str(truth.get("truth_state") or "").lower() == "error"
        provider = default_provider
        last_sync = None
        connected = False
        err_msg = None
        sync_bad = False

        if row:
            provider = row.get("provider") or default_provider
            connected = merge_row_is_connected(row)
            st = str(row.get("sync_status") or row.get("status") or "").lower()
            sync_bad = st in ("error", "token_expired", "failed", "expired", "inactive")
            last_sync = truth.get("last_verified_at") or row.get("last_sync_at") or row.get("connected_at") or row.get("created_at")
            if truth_err or sync_bad:
                err_msg = truth.get("error_message") or row.get("error_message") or truth.get("truth_reason")
        elif truth_err:
            err_msg = truth.get("error_message") or truth.get("truth_reason")

        if connected and not sync_bad and not truth_err:
            err_msg = None

        connectors.append({
            "id": eid,
            "name": title,
            "category": cat_label,
            "provider": provider,
            "connected": connected,
            "last_sync_at": last_sync if connected else None,
            "error": err_msg,
        })

    append_merge_connector("crm", "crm", "CRM", "Sales", "HubSpot")
    append_merge_connector("accounting", "accounting", "Accounting", "Finance", "Xero")

    # Email (Supabase email_connections + optional truth)
    row = None
    try:
        em = (
            sb.table("email_connections")
            .select("*")
            .eq("user_id", user_id)
            .order("connected_at", desc=True)
            .limit(1)
            .execute()
        )
        row = em.data[0] if em.data else None
    except Exception:
        row = None

    email_truth = connector_truth.get("email") or {}
    email_truth_err = str(email_truth.get("truth_state") or "").lower() == "error"
    prov_key = None
    display = "Gmail"
    connected = False
    last_sync = None
    err_msg = None

    if row:
        prov_key = str(row.get("provider") or "gmail").lower()
        display = {"gmail": "Gmail", "outlook": "Microsoft Outlook"}.get(prov_key, prov_key.replace("_", " ").title())
        connected = email_row_is_connected(row)
        st = str(row.get("sync_status") or row.get("status") or "").lower()
        sync_bad = st == "error"
        last_sync = (row.get("last_sync_at") or row.get("connected_at")) if connected else None
        if sync_bad or email_truth_err:
            err_msg = row.get("error_message") or email_truth.get("error_message") or email_truth.get("truth_reason")
        if connected and not sync_bad and not email_truth_err:
            err_msg = None
    elif email_truth_err:
        err_msg = email_truth.get("error_message") or email_truth.get("truth_reason")

    connectors.append({
        "id": "email",
        "name": "Email",
        "category": "Communication",
        "provider": display,
        "provider_key": prov_key,
        "connected": connected,
        "last_sync_at": last_sync,
        "error": err_msg,
    })

    connectors.append({
        "id": "marketing",
        "name": "Marketing",
        "category": "Marketing",
        "provider": "Coming soon",
        "connected": False,
        "last_sync_at": None,
        "error": None,
    })

    return {"connectors": connectors}


@router.get("/integrations/merge/catalog")
async def get_merge_integration_catalog(
    current_user: dict = Depends(get_current_user),
    search: Optional[str] = Query(default=None),
):
    """Fetch full Merge integration metadata for connector search."""
    merge_api_key = os.environ.get("MERGE_API_KEY")
    if not merge_api_key or merge_api_key in ("CONFIGURED_IN_AZURE", ""):
        return {"integrations": [], "count": 0, "source": "merge_unconfigured"}

    q = str(search or "").strip().lower()
    integrations: List[Dict[str, Any]] = []
    seen = set()
    # Use canonical trailing-slash endpoint to avoid extra 301 redirects.
    next_url = "https://api.merge.dev/api/integrations/"
    page_safety = 0

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            while next_url and page_safety < 25:
                page_safety += 1
                resp = await client.get(
                    next_url,
                    headers={"Authorization": f"Bearer {merge_api_key}"},
                )
                if resp.status_code >= 400:
                    logger.warning("[merge-catalog] Merge API error: %s %s", resp.status_code, (resp.text or "")[:300])
                    break
                payload = resp.json() if resp.content else {}
                rows = payload.get("results") if isinstance(payload, dict) else payload
                rows = rows if isinstance(rows, list) else []

                for row in rows:
                    if not isinstance(row, dict):
                        continue
                    name = str(row.get("name") or "").strip()
                    if not name:
                        continue
                    categories = row.get("categories") or []
                    if isinstance(categories, str):
                        categories = [categories]
                    categories = [str(c).strip().lower() for c in categories if c]
                    slug = str(row.get("slug") or row.get("id") or "").strip().lower()
                    if not slug:
                        slug = "".join(ch for ch in name.lower() if ch.isalnum() or ch in {"-", "_", " "}).replace(" ", "-")
                    key = slug or name.lower()
                    if key in seen:
                        continue
                    seen.add(key)

                    if q and q not in name.lower() and q not in slug:
                        continue

                    integrations.append({
                        "id": slug,
                        "name": name,
                        "categories": categories,
                        "logo": row.get("image") or row.get("logo") or row.get("square_image"),
                        "description": row.get("description") or row.get("summary"),
                    })

                raw_next = payload.get("next") if isinstance(payload, dict) else None
                if raw_next and isinstance(raw_next, str):
                    if raw_next.startswith("http://") or raw_next.startswith("https://"):
                        next_url = raw_next
                    elif raw_next.startswith("/"):
                        next_url = f"https://api.merge.dev{raw_next}"
                    else:
                        next_url = f"https://api.merge.dev/api/{raw_next.lstrip('/')}"
                else:
                    next_url = None
    except Exception as exc:
        logger.warning("[merge-catalog] Failed to fetch Merge catalog: %s", exc)

    return {"integrations": integrations, "count": len(integrations), "source": "merge_live"}


@router.post("/integrations/custom-connector-request")
async def submit_custom_connector_request(
    payload: CustomConnectorRequest,
    current_user: dict = Depends(get_current_user),
):
    """Capture a custom connector request without affecting integration flow."""
    name = str(payload.name or "").strip()
    details = str(payload.details or "").strip()
    if not name or not details:
        raise HTTPException(status_code=400, detail="Name and details are required.")

    user_id = str(current_user.get("id") or "")
    user_email = str(current_user.get("email") or "")
    sb = get_sb()
    request_row = {
        "user_id": user_id,
        "user_email": user_email,
        "requester_name": name[:200],
        "details": details[:8000],
        "status": "submitted",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    # Best-effort persistence so the UI remains functional even if table migration is pending.
    stored = False
    for schema_name, table_name in (
        ("business_core", "custom_connector_requests"),
        (None, "custom_connector_requests"),
    ):
        try:
            target = sb.schema(schema_name).table(table_name) if schema_name else sb.table(table_name)
            target.insert(request_row).execute()
            stored = True
            break
        except Exception:
            continue

    logger.info(
        "[custom-connector] request received user_id=%s email=%s name=%s stored=%s",
        user_id,
        user_email,
        name[:120],
        stored,
    )

    return {"ok": True, "stored": stored}


@router.post("/integrations/merge/webhook")
async def merge_webhook_receive(request: Request):
    """
    Receive Merge.dev webhook events. No auth — Merge validates via x-merge-signature.
    Use this URL in Merge dashboard: https://biqc.ai/api/integrations/merge/webhook
    """
    import hashlib
    import hmac as hmac_module

    webhook_secret = (os.environ.get("MERGE_WEBHOOK_SECRET") or "").strip()
    if not webhook_secret:
        logger.warning("[merge-webhook] MERGE_WEBHOOK_SECRET not configured")
        return JSONResponse(content={"ok": False, "error": "Webhook not configured"}, status_code=503)

    if str(os.environ.get("FEATURE_MERGE_WEBHOOK_ENABLED", "true")).lower() not in {"1", "true", "yes"}:
        return JSONResponse(content={"ok": True, "accepted": False, "reason": "FEATURE_MERGE_WEBHOOK_ENABLED=false"}, status_code=202)

    signature_header = (
        request.headers.get("x-merge-signature")
        or request.headers.get("X-Merge-Signature")
        or request.headers.get("x-merge-webhook-signature")
        or request.headers.get("X-Merge-Webhook-Signature")
        or ""
    )
    raw_body = await request.body()
    raw_text = raw_body.decode("utf-8", errors="replace")

    try:
        digest_bytes = hmac_module.new(
            webhook_secret.encode(),
            raw_body,
            hashlib.sha256,
        ).digest()
        expected_hex = digest_bytes.hex().lower()
        expected_b64 = base64.b64encode(digest_bytes).decode("utf-8").strip()
        # Merge webhooks use base64url encoding for signatures.
        expected_b64url = base64.urlsafe_b64encode(digest_bytes).decode("utf-8").strip().rstrip("=")

        provided = signature_header.replace("sha256=", "").replace("sha256 =", "").strip().strip('"').lower()
        provided_b64 = signature_header.replace("sha256=", "").replace("sha256 =", "").strip().strip('"')
        provided_b64url = provided_b64.replace("+", "-").replace("/", "_").rstrip("=")
        if not (
            hmac_module.compare_digest(expected_hex, provided)
            or hmac_module.compare_digest(expected_b64, provided_b64)
            or hmac_module.compare_digest(expected_b64url, provided_b64url)
        ):
            return JSONResponse(content={"ok": False, "error": "Invalid webhook signature"}, status_code=401)
    except Exception as e:
        logger.warning(f"[merge-webhook] Signature validation failed: {e}")
        return JSONResponse(content={"ok": False, "error": "Invalid signature"}, status_code=401)

    try:
        payload = json.loads(raw_text or "{}")
    except json.JSONDecodeError:
        return JSONResponse(content={"ok": False, "error": "Invalid JSON"}, status_code=400)

    raw_events = (
        payload.get("events")
        if isinstance(payload.get("events"), list)
        else payload.get("data")
        if isinstance(payload.get("data"), list)
        else [payload]
    )

    sb = get_sb()
    received = 0
    duplicate = 0
    ignored = 0
    touched_tenants = set()

    for row in raw_events or []:
        event = row if isinstance(row, dict) else {}
        account_token = str(event.get("account_token") or payload.get("account_token") or "").strip()
        provider = str(event.get("provider") or payload.get("provider") or "merge").lower()
        event_type = str(event.get("event_type") or event.get("type") or payload.get("type") or "unknown")
        event_id = str(event.get("id") or event.get("event_id") or str(uuid.uuid4()))
        occurred_at = str(event.get("occurred_at") or event.get("timestamp") or payload.get("timestamp") or datetime.now(timezone.utc).isoformat())
        entity = str(event.get("model") or event.get("entity") or event.get("object") or "unknown")
        cat_raw = str(event.get("category") or event_type or entity).lower()
        category = "crm" if any(x in cat_raw for x in ["crm", "opportunit", "deal"]) else \
                   "accounting" if any(x in cat_raw for x in ["account", "invoice", "payment"]) else \
                   "marketing" if any(x in cat_raw for x in ["market", "campaign"]) else \
                   "calendar" if "calendar" in cat_raw else "unknown"

        if not account_token or category == "unknown":
            ignored += 1
            continue

        try:
            int_resp = sb.table("integration_accounts").select("user_id").eq("account_token", account_token).limit(1).maybe_single().execute()
            if int_resp.error or not int_resp.data or not int_resp.data.get("user_id"):
                ignored += 1
                continue
            tenant_id = str(int_resp.data["user_id"])
            touched_tenants.add(tenant_id)
        except Exception:
            ignored += 1
            continue

        dedupe_key = f"{event_id}|{tenant_id}|{category}|{entity}|{occurred_at}"[:500]

        try:
            ins = sb.schema("business_core").table("webhook_events").insert({
                "tenant_id": tenant_id,
                "provider": provider,
                "category": category,
                "event_type": event_type,
                "event_id": event_id,
                "entity_type": entity,
                "event_timestamp": occurred_at,
                "idempotency_key": dedupe_key,
                "payload": event,
                "status": "received",
                "received_at": datetime.now(timezone.utc).isoformat(),
            }).execute()
            if ins.data:
                received += 1
            else:
                ignored += 1
        except Exception as e:
            err_msg = str(e).lower()
            if "duplicate" in err_msg or "unique" in err_msg:
                duplicate += 1
            else:
                logger.warning(f"[merge-webhook] Insert failed: {e}")
                ignored += 1

    for tenant_id in touched_tenants:
        await invalidate_cached_integration_status(tenant_id)

    return JSONResponse(content={
        "ok": True,
        "received": received,
        "duplicate": duplicate,
        "ignored": ignored,
        "events": raw_events,
    }, status_code=200)


@router.post("/merge/webhook")
async def merge_webhook_alias(request: Request):
    """Alias — forwards to canonical merge_webhook_receive."""
    return await merge_webhook_receive(request)


@router.post("/webhooks/merge")
async def merge_webhook_alias_v2(request: Request):
    """Alias — forwards to canonical merge_webhook_receive."""
    return await merge_webhook_receive(request)


@router.get("/integrations/webhook-health")
async def get_merge_webhook_health(current_user: dict = Depends(get_current_user)):
    """Operational health for Merge webhook ingestion and replay queue."""
    user_id = current_user["id"]
    sb = get_sb()

    try:
        recent = (
            sb.schema("business_core")
            .table("webhook_events")
            .select("id,status,received_at,processed_at,last_error,next_retry_at,dead_letter_at")
            .eq("tenant_id", user_id)
            .order("received_at", desc=True)
            .limit(200)
            .execute()
        )
        rows = recent.data or []
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to read webhook health: {exc}")

    totals = {
        "received": 0,
        "validated": 0,
        "queued": 0,
        "processed": 0,
        "failed": 0,
        "dead_letter": 0,
    }
    for row in rows:
        status = str(row.get("status") or "").lower()
        if status in totals:
            totals[status] += 1

    latest_event_at = next((row.get("received_at") for row in rows if row.get("received_at")), None)
    latest_processed_at = next((row.get("processed_at") for row in rows if row.get("processed_at")), None)
    failed_samples = [
        {
            "id": row.get("id"),
            "last_error": row.get("last_error"),
            "next_retry_at": row.get("next_retry_at"),
        }
        for row in rows
        if str(row.get("status") or "").lower() in {"failed", "dead_letter"}
    ][:10]

    return {
        "tenant_id": user_id,
        "webhook_enabled": os.environ.get("FEATURE_MERGE_WEBHOOK_ENABLED", "true").lower() in {"1", "true", "yes"},
        "totals": totals,
        "latest_event_at": latest_event_at,
        "latest_processed_at": latest_processed_at,
        "failed_samples": failed_samples,
    }


@router.post("/user/integration-status/sync")
async def sync_integration_status_counts(current_user: dict = Depends(get_current_user)):
    """
    Trigger immediate record count refresh for all connected integrations.
    Fetches deal counts from CRM, invoice counts from Accounting via Merge API.
    """
    from workspace_helpers import get_user_account, get_merge_account_token
    from merge_client import get_merge_client

    user_id = current_user["id"]
    await invalidate_cached_integration_status(user_id)
    results = []
    merge_client = get_merge_client()

    try:
        account = await get_user_account(get_sb(), user_id)
    except Exception:
        account = None

    if account:
        account_id = account["id"]

        # CRM: deals count
        try:
            token = await get_merge_account_token(get_sb(), account_id, "crm")
            if token:
                deals_data = await merge_client.get_deals(account_token=token, page_size=100)
                deal_count = len(deals_data.get("results", []))
                crm_row = get_sb().table("integration_accounts").select("provider").eq(
                    "user_id", user_id).eq("category", "crm").maybe_single().execute()
                provider = (crm_row.data or {}).get("provider", "CRM")
                await _upsert_integration_status(
                    get_sb(), user_id, provider, "crm",
                    connected=True, provider=provider,
                    records_count=deal_count, record_type="deals",
                )
                results.append({"category": "crm", "provider": provider, "records_count": deal_count})
        except Exception as e:
            logger.warning(f"[sync] CRM failed: {e}")

        # Accounting: invoices count
        try:
            token = await get_merge_account_token(get_sb(), account_id, "accounting")
            if token:
                inv_data = await merge_client.get_invoices(account_token=token, page_size=100)
                inv_count = len(inv_data.get("results", []))
                acc_row = get_sb().table("integration_accounts").select("provider").eq(
                    "user_id", user_id).eq("category", "accounting").maybe_single().execute()
                provider = (acc_row.data or {}).get("provider", "Accounting")
                await _upsert_integration_status(
                    get_sb(), user_id, provider, "accounting",
                    connected=True, provider=provider,
                    records_count=inv_count, record_type="invoices",
                )
                results.append({"category": "accounting", "provider": provider, "records_count": inv_count})
        except Exception as e:
            logger.warning(f"[sync] Accounting failed: {e}")

    # Email: use cached synced count
    try:
        email_rows = get_sb().table("email_connections").select(
            "provider, emails_synced"
        ).eq("user_id", user_id).execute()
        for row in (email_rows.data or []):
            provider = row.get("provider", "email")
            count = row.get("emails_synced") or 0
            await _upsert_integration_status(
                get_sb(), user_id, provider, "email",
                connected=True, provider=provider,
                records_count=count, record_type="emails",
            )
            results.append({"category": "email", "provider": provider, "records_count": count})
    except Exception as e:
        logger.warning(f"[sync] Email failed: {e}")

    await invalidate_cached_integration_status(user_id)
    return {
        "success": True,
        "synced": results,
        "synced_at": datetime.now(timezone.utc).isoformat(),
    }



# ═══════════════════════════════════════════════════════════════
# DATA COVERAGE — Sprint 4
# GET /user/data-coverage
# ═══════════════════════════════════════════════════════════════

@router.get("/user/data-coverage")
async def get_user_data_coverage(current_user: dict = Depends(get_current_user)):
    """
    Returns weighted data coverage percentage for the current user.
    Used to gate SoundBoard AI responses (blocked <20%, degraded 20-40%, full >40%).
    """
    from data_coverage import calculate_coverage
    from supabase_intelligence_helpers import get_business_profile_supabase

    user_id = current_user["id"]

    profile = None
    try:
        profile = await get_business_profile_supabase(get_sb(), user_id)
    except Exception:
        pass

    has_crm = has_accounting = has_email = False
    try:
        int_result = get_sb().table("integration_accounts").select("category").eq("user_id", user_id).execute()
        for row in (int_result.data or []):
            cat = row.get("category", "")
            if cat == "crm":
                has_crm = True
            elif cat == "accounting":
                has_accounting = True
    except Exception:
        pass
    try:
        email_res = get_sb().table("email_connections").select("id").eq("user_id", user_id).limit(1).execute()
        has_email = bool(email_res.data)
    except Exception:
        pass

    return calculate_coverage(
        profile=profile or {},
        has_crm=has_crm,
        has_accounting=has_accounting,
        has_email=has_email,
    )
