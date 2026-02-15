"""
Integrations Routes — Merge.dev, CRM, Google Drive, Intelligence cold-read/ingest/watchtower.
Extracted from server.py.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import os
import uuid
import json
import asyncio
import logging

import httpx
from routes.deps import (
    get_current_user, get_current_user_from_request,
    get_sb, OPENAI_KEY, AI_MODEL, cognitive_core, logger,
)
from supabase_client import safe_query_single
from auth_supabase import get_user_by_id
from supabase_intelligence_helpers import get_business_profile_supabase
from supabase_drive_helpers import (
    store_merge_integration, get_user_merge_integrations,
    get_merge_integration_by_token, update_merge_integration_sync,
    store_drive_file, store_drive_files_batch,
    get_user_drive_files, count_user_drive_files,
)

router = APIRouter()


# ==================== MERGE.DEV INTEGRATION ====================

@router.post("/integrations/merge/link-token")
async def create_merge_link_token(
    payload: Optional[MergeLinkTokenRequest] = None,
    current_user: dict = Depends(get_current_user)
):
    """Generate Merge.dev link token for workspace (P0: workspace-scoped)"""
    from workspace_helpers import get_or_create_user_account
    
    merge_api_key = os.environ.get("MERGE_API_KEY")
    
    if not merge_api_key:
        logger.error("❌ MERGE_API_KEY not configured in environment")
        raise HTTPException(status_code=500, detail="MERGE_API_KEY not configured")
    
    user_id = current_user["id"]
    user_email = current_user.get("email", "user@biqc.com")
    company_name = current_user.get("company_name")
    
    # P0 FIX: Get or create workspace for user
    try:
        account = await get_or_create_user_account(get_sb(), user_id, user_email, company_name)
        account_id = account["id"]
        account_name = account["name"]
        
        logger.info(f"🔗 Creating Merge link token for workspace: {account_name} ({account_id})")
        logger.info(f"   Requested by user: {user_email} ({user_id})")
        
    except Exception as e:
        logger.error(f"❌ Failed to get/create workspace: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to initialize workspace")
    
    try:
        async with httpx.AsyncClient() as client:
            requested_categories = payload.categories if payload and payload.categories else None
            categories = requested_categories or ["accounting", "crm", "hris", "ats"]
            # P0 FIX: Send workspace_id as end_user_origin_id (NOT user_id)
            # P0 FIX: Send workspace name as end_user_organization_name (NOT hardcoded)
            response = await client.post(
                "https://api.merge.dev/api/integrations/create-link-token",
                headers={
                    "Authorization": f"Bearer {merge_api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "end_user_origin_id": account_id,  # WORKSPACE ID (was user_id)
                    "end_user_organization_name": account_name,  # WORKSPACE NAME (was hardcoded)
                    "end_user_email_address": user_email,
                    "categories": categories
                }
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
    
    merge_api_key = os.environ.get("MERGE_API_KEY")
    
    if not merge_api_key:
        logger.error("❌ MERGE_API_KEY not configured in environment")
        raise HTTPException(status_code=500, detail="MERGE_API_KEY not configured")
    
    user_id = current_user["id"]
    user_email = current_user.get("email", "unknown")
    
    # P0 FIX: Get user's workspace
    try:
        account = await get_user_account(get_sb(), user_id)
        if not account:
            logger.error(f"❌ User {user_id} has no workspace - cannot store integration")
            raise HTTPException(status_code=400, detail="User workspace not initialized")
        
        account_id = account["id"]
        account_name = account["name"]
        
        logger.info(f"🔄 Exchanging Merge token for workspace: {account_name} ({account_id})")
        logger.info(f"   Requested by user: {user_email} ({user_id}), category: {category}")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get workspace: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get workspace")
    
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
        
        # P0 FIX: Store with account_id (workspace) + merge_account_id
        integration_data = {
            "account_id": account_id,  # WORKSPACE ID (NEW)
            "user_id": user_id,  # User who connected (for audit)
            "provider": integration_name,
            "category": category,
            "account_token": account_token,
            "merge_account_id": merge_account_id,  # MERGE ACCOUNT ID (NEW)
            "connected_at": datetime.now(timezone.utc).isoformat()
        }
        
        # P0 FIX: Use workspace-level uniqueness constraint
        result = get_sb().table("integration_accounts").upsert(
            integration_data,
            on_conflict="account_id,category"  # Workspace + category (was user_id,category)
        ).execute()
        
        if not result.data:
            logger.error("❌ Failed to store account_token in Supabase")
            raise HTTPException(status_code=500, detail="Failed to store account_token")
        
        logger.info(f"✅ Integration account stored successfully: {result.data}")
        
        return {
            "success": True,
            "provider": integration_name,
            "category": category
        }
        
    except Exception as e:
        logger.error(f"❌ Database error storing integration: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


class MergeDisconnectRequest(BaseModel):
    provider: str
    category: str


@router.post("/merge/disconnect")
async def disconnect_merge_integration(request: Request, payload: MergeDisconnectRequest):
    """Disconnect a Merge.dev integration — removes from integration_accounts."""
    try:
        current_user = await get_current_user_from_request(request)
        user_id = current_user.get("id")
    except Exception:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        result = get_sb().table("integration_accounts").delete().eq(
            "user_id", user_id
        ).eq("provider", payload.provider).execute()
        logger.info(f"[merge/disconnect] Disconnected {payload.provider} for {user_id}")
        return {"ok": True, "provider": payload.provider}
    except Exception as e:
        logger.error(f"[merge/disconnect] Error: {e}")
        raise HTTPException(status_code=500, detail="Disconnect failed")


@router.get("/integrations/merge/connected")
async def get_connected_merge_integrations(current_user: dict = Depends(get_current_user)):
    """Get all connected Merge.dev integrations for the workspace (P0: workspace-scoped)"""
    from workspace_helpers import get_user_account, get_account_integrations
    
    try:
        user_id = current_user["id"]
        
        # P0 FIX: Get workspace for user
        account = await get_user_account(get_sb(), user_id)
        if not account:
            logger.warning(f"⚠️  User {user_id} has no workspace - returning empty integrations")
            return {"integrations": {}}
        
        account_id = account["id"]
        account_name = account["name"]
        
        # P0 FIX: Fetch integrations by workspace (not user)
        integration_records = await get_account_integrations(get_sb(), account_id)
        
        integrations = {}
        for record in integration_records:
            provider = record.get("provider", "unknown")
            category = record.get("category", "unknown")
            merge_account_id = record.get("merge_account_id")
            
            # FILTER: Exclude email category from Merge integrations
            # Email handled by Supabase Edge Functions (Outlook/Gmail), not Merge
            if category == "email":
                logger.info(f"   Skipping {provider} (email category - not a Merge integration)")
                continue
            
            # Only include integrations with merge_account_id (true Merge integrations)
            if not merge_account_id:
                logger.info(f"   Skipping {provider} (no merge_account_id - not a Merge integration)")
                continue
            
            integrations[provider] = {
                "provider": provider,
                "category": category,
                "connected": True,
                "connected_at": record.get("connected_at") or record.get("created_at"),
                "merge_account_id": merge_account_id,
                "workspace_id": account_id,
                "workspace_name": account_name
            }
        
        logger.info(f"✅ Found {len(integrations)} workspace integrations for {account_name} ({account_id})")
        return {"integrations": integrations}
        
    except Exception as e:
        logger.error(f"❌ Error fetching connected integrations: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


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
        
        logger.info(f"✅ Retrieved {len(data.get('results', []))} deals")
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


@router.get("/")
async def root():
    return {"message": "Strategic Advisor API", "version": "1.0.0"}

@router.get("/health")
async def health():
    return {"status": "healthy"}

# ==================== VOICE CHAT (REALTIME) ====================

# Initialize OpenAI Realtime Voice Chat
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
voice_chat = None
voice_router = APIRouter()

if OPENAI_API_KEY:
    try:
        voice_chat = OpenAIChatRealtime(api_key=OPENAI_API_KEY)
        OpenAIChatRealtime.register_openai_realtime_router(voice_router, voice_chat)
        logger.info("Voice chat initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize voice chat: {e}")



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
    Returns: agent_persona, fact_ledger (from user_operator_profile),
    and executive_memo (from intelligence_snapshots).
    This is the Cognitive Output. No filtering. No generation. Pure read.
    """
    user_id = current_user.get("id")

    result = {
        "agent_persona": None,
        "fact_ledger": None,
        "executive_memo": None,
        "resolution_status": None,
    }

    # 1. Read agent_persona + fact_ledger from user_operator_profile
    try:
        op = safe_query_single(
            get_sb().table("user_operator_profile").select(
                "agent_persona, fact_ledger, persona_calibration_status"
            ).eq("user_id", user_id)
        )
        if op.data:
            result["agent_persona"] = op.data.get("agent_persona")
            result["fact_ledger"] = op.data.get("fact_ledger")
            result["calibration_status"] = op.data.get("persona_calibration_status")
    except Exception as e:
        logger.error(f"[executive-mirror] operator_profile read failed: {e}")

    # 2. Read latest executive_memo from intelligence_snapshots
    try:
        snap = get_sb().table("intelligence_snapshots").select(
            "executive_memo, resolution_score, snapshot_type, generated_at"
        ).eq("user_id", user_id).order(
            "generated_at", desc=True
        ).limit(1).execute()
        if snap.data and len(snap.data) > 0:
            row = snap.data[0]
            result["executive_memo"] = row.get("executive_memo")
            result["resolution_status"] = row.get("resolution_score")
            result["snapshot_type"] = row.get("snapshot_type")
            result["snapshot_generated_at"] = row.get("generated_at")
    except Exception as e:
        logger.error(f"[executive-mirror] intelligence_snapshots read failed: {e}")

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
    Get Watchtower events for current workspace
    
    These are authoritative intelligence statements
    """
    from workspace_helpers import get_user_account
    from watchtower_store import get_watchtower_store
    
    user_id = current_user["id"]
    
    try:
        account = await get_user_account(get_sb(), user_id)
        if not account:
            logger.error(f"No workspace found for user {user_id}")
            raise HTTPException(status_code=400, detail="Workspace not initialized. Contact support.")
        
        account_id = account["id"]
        
        # Fetch watchtower events
        watchtower = get_watchtower_store()
        events = await watchtower.get_events(account_id, status=status)
        
        logger.info(f"✅ Watchtower events fetched for workspace {account_id}: {len(events)} events")
        
        return {
            "events": events,
            "count": len(events)
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Watchtower fetch failed: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to fetch watchtower events: {str(e)}")


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


# ═══════════════════════════════════════════════════════════════
# WATCHTOWER ENGINE V2 — Extracted to routes/watchtower.py
# ═══════════════════════════════════════════════════════════════
from routes.watchtower import router as watchtower_router
api_router.include_router(watchtower_router)



# ═══════════════════════════════════════════════════════════════
# BOARD ROOM — Extracted to routes/boardroom.py
# ═══════════════════════════════════════════════════════════════
from routes.boardroom import router as boardroom_router
api_router.include_router(boardroom_router)

# ═══════════════════════════════════════════════════════════════
# EMISSION, SNAPSHOT, BASELINE — Extracted to routes/intelligence.py
# ═══════════════════════════════════════════════════════════════
from routes.intelligence import router as intelligence_router
api_router.include_router(intelligence_router)

# ═══════════════════════════════════════════════════════════════
# DEEP RESEARCH + INFERENCE ENGINE — routes/research.py
# ═══════════════════════════════════════════════════════════════
from routes.research import router as research_router
api_router.include_router(research_router)

# ═══════════════════════════════════════════════════════════════
# MYSOUNDBOARD — Extracted to routes/soundboard.py
# ═══════════════════════════════════════════════════════════════
from routes.soundboard import router as soundboard_router
api_router.include_router(soundboard_router)

# ═══════════════════════════════════════════════════════════════
# DATA CENTER — Extracted to routes/data_center.py
# ═══════════════════════════════════════════════════════════════
from routes.data_center import router as data_center_router
api_router.include_router(data_center_router)

# ═══════════════════════════════════════════════════════════════
# CALIBRATION — Extracted to routes/calibration.py
# ═══════════════════════════════════════════════════════════════
from routes.calibration import router as calibration_router
api_router.include_router(calibration_router)

# ═══════════════════════════════════════════════════════════════
# EMAIL & CALENDAR — Extracted to routes/email.py
# ═══════════════════════════════════════════════════════════════
from routes.email import router as email_router
api_router.include_router(email_router)

@app.on_event("shutdown")
async def shutdown_db_client():
    pass  # MongoDB client removed — no cleanup needed


# ==================== GOOGLE DRIVE INTEGRATION (MERGE.DEV) ====================

@router.post("/integrations/google-drive/connect")
async def connect_google_drive(current_user: dict = Depends(get_current_user)):
    """
    Generate Merge Link Token for Google Drive connection
    100% Supabase storage - Zero MongoDB
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
            
            # Trigger initial sync
            import asyncio
            asyncio.create_task(sync_google_drive_files(user_id, account_id, account_token))
            
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
    100% PostgreSQL - Zero MongoDB
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
    
    # Trigger background sync
    import asyncio
    asyncio.create_task(sync_google_drive_files(user_id, account_id, account_token))
    
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


