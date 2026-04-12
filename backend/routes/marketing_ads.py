"""
Marketing Ads Integration Routes — Platform connections, campaigns, overview, sync.
Provides endpoints for managing marketing ad platform integrations and retrieving
campaign performance data.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import logging

from routes.deps import get_current_user, get_sb, logger
from biqc_jobs import enqueue_job

router = APIRouter(prefix="/marketing-ads", tags=["Marketing Ads"])


# ─── Request / Response Models ───────────────────────────────────────────────


class SyncResponse(BaseModel):
    status: str
    platform: str
    job_id: Optional[str] = None
    message: str


# ─── Endpoints ───────────────────────────────────────────────────────────────


@router.get("/connections")
async def list_connections(current_user: dict = Depends(get_current_user)):
    """List marketing platform connections for the current user."""
    try:
        sb = get_sb()
        user_id = current_user["id"]

        result = sb.table("marketing_ad_connections") \
            .select("*") \
            .eq("user_id", user_id) \
            .order("created_at", desc=True) \
            .execute()

        connections = result.data or []
        return {
            "connections": connections,
            "count": len(connections),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("[MarketingAds] Failed to list connections for user %s: %s", current_user.get("id"), e)
        raise HTTPException(status_code=500, detail="Failed to retrieve marketing connections")


@router.get("/campaigns")
async def list_campaigns(
    platform: Optional[str] = Query(None, description="Filter by platform (e.g. google_ads, meta, linkedin)"),
    status: Optional[str] = Query(None, description="Filter by campaign status (active, paused, completed)"),
    current_user: dict = Depends(get_current_user),
):
    """List marketing campaigns with optional platform and status filters."""
    try:
        sb = get_sb()
        user_id = current_user["id"]

        query = sb.table("marketing_ad_campaigns") \
            .select("*") \
            .eq("user_id", user_id)

        if platform:
            query = query.eq("platform", platform.lower().strip())
        if status:
            query = query.eq("status", status.lower().strip())

        result = query.order("updated_at", desc=True).execute()

        campaigns = result.data or []
        return {
            "campaigns": campaigns,
            "count": len(campaigns),
            "filters": {
                "platform": platform,
                "status": status,
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("[MarketingAds] Failed to list campaigns for user %s: %s", current_user.get("id"), e)
        raise HTTPException(status_code=500, detail="Failed to retrieve marketing campaigns")


@router.get("/overview")
async def marketing_overview(current_user: dict = Depends(get_current_user)):
    """Aggregate marketing performance metrics via marketing_overview_metrics RPC."""
    try:
        sb = get_sb()
        user_id = current_user["id"]

        result = sb.rpc("marketing_overview_metrics", {
            "p_user_id": user_id,
        }).execute()

        data = result.data if result.data else {}

        return {
            "overview": data,
            "computed_at": datetime.now(timezone.utc).isoformat(),
            "user_id": user_id,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("[MarketingAds] Failed to compute overview for user %s: %s", current_user.get("id"), e)
        raise HTTPException(status_code=500, detail="Failed to retrieve marketing overview")


@router.post("/sync/{platform}")
async def trigger_sync(
    platform: str,
    current_user: dict = Depends(get_current_user),
):
    """Trigger a manual sync for the specified marketing platform."""
    try:
        supported_platforms = {"google_ads", "meta", "linkedin", "tiktok", "twitter"}
        platform_key = platform.lower().strip()

        if platform_key not in supported_platforms:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported platform '{platform}'. Supported: {', '.join(sorted(supported_platforms))}",
            )

        user_id = current_user["id"]

        # Verify the user has a connection for this platform
        sb = get_sb()
        conn_result = sb.table("marketing_ad_connections") \
            .select("id, status") \
            .eq("user_id", user_id) \
            .eq("platform", platform_key) \
            .limit(1) \
            .execute()

        if not conn_result.data:
            raise HTTPException(
                status_code=404,
                detail=f"No {platform} connection found. Connect the platform first.",
            )

        # Enqueue the sync job
        queued = await enqueue_job(
            "marketing-sync",
            {
                "task": "marketing-ads-sync",
                "platform": platform_key,
                "user_id": user_id,
                "connection_id": conn_result.data[0]["id"],
                "triggered_at": datetime.now(timezone.utc).isoformat(),
            },
            company_id=user_id,
        )

        return SyncResponse(
            status="queued",
            platform=platform_key,
            job_id=queued.get("job_id"),
            message=f"Sync job queued for {platform_key}",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("[MarketingAds] Failed to trigger sync for platform %s, user %s: %s", platform, current_user.get("id"), e)
        raise HTTPException(status_code=500, detail="Failed to enqueue marketing sync job")
