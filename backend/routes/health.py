"""
Health monitoring for BIQc background workers and services.
Provides endpoints to check status of email sync, intelligence automation, and Supabase connectivity.
"""
from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone
import os
import logging
from biqc_jobs import biqc_jobs

router = APIRouter(prefix="/health", tags=["health"])
logger = logging.getLogger(__name__)


def _is_production() -> bool:
    env = (os.environ.get("ENVIRONMENT") or "").strip().lower()
    prod_flag = (os.environ.get("PRODUCTION") or "").strip().lower()
    return env == "production" or prod_flag in {"1", "true", "yes"}


def _require_non_production() -> None:
    if _is_production():
        raise HTTPException(status_code=403, detail="Endpoint unavailable in production")


def _check_supabase():
    """Check Supabase connectivity."""
    try:
        from supabase_client import init_supabase
        client = init_supabase()
        if client:
            client.table("users").select("id").limit(1).execute()
            return {"status": "connected", "reachable": True}
        return {"status": "no_client", "reachable": False}
    except Exception as e:
        return {"status": "error", "reachable": False, "error": str(e)[:100]}


def _check_worker(name, pid_check=None):
    """Check if a worker process is running via supervisor."""
    import subprocess
    try:
        result = subprocess.run(
            ["supervisorctl", "status", name],
            capture_output=True, text=True, timeout=5
        )
        output = result.stdout.strip()
        is_running = "RUNNING" in output
        return {"status": "running" if is_running else "stopped", "detail": output}
    except Exception as e:
        return {"status": "unknown", "error": str(e)[:100]}


def _check_openai():
    """Check if OpenAI key is configured."""
    key = os.environ.get("OPENAI_API_KEY", "")
    return {"configured": bool(key and len(key) > 10)}


@router.get("/detailed")
async def detailed_health():
    """Comprehensive health check of all services and workers."""
    if _is_production():
        return {
            "status": "unavailable_in_production",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    checks = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "api": {"status": "healthy"},
        "supabase": _check_supabase(),
        "redis": await biqc_jobs.health_async(),
        "workers": {
            "email_sync": _check_worker("email_sync_worker"),
            "intelligence": _check_worker("intelligence_worker"),
        },
        "integrations": {
            "openai": _check_openai(),
            "supabase_url": {"configured": bool(os.environ.get("SUPABASE_URL"))},
            "serper": {"configured": bool(os.environ.get("SERPER_API_KEY"))},
            "redis_url": {"configured": bool(os.environ.get("REDIS_URL"))},
        },
    }

    all_ok = (
        checks["supabase"].get("reachable", False)
        and checks["workers"]["email_sync"].get("status") == "running"
        and checks["workers"]["intelligence"].get("status") == "running"
    )
    checks["overall"] = "healthy" if all_ok else "degraded"

    return checks


@router.get("/workers")
async def workers_health():
    """Quick check on background worker status."""
    _require_non_production()
    return {
        "email_sync": _check_worker("email_sync_worker"),
        "intelligence": _check_worker("intelligence_worker"),
        "redis_queue": await biqc_jobs.health_async(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/warmup")
async def warmup_edge_functions():
    """Ping Supabase Edge Functions to prevent cold starts. Called by cron or frontend."""
    _require_non_production()
    import httpx
    supabase_url = os.environ.get("SUPABASE_URL", "")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not supabase_url or not service_key:
        return {"status": "skip", "reason": "no credentials"}

    functions = ["biqc-insights-cognitive", "intelligence-bridge", "sop-generator", "competitor-monitor", "cfo-cash-analysis", "checkin-manager", "calibration-sync"]
    results = {}

    async with httpx.AsyncClient() as client:
        for fn in functions:
            try:
                res = await client.options(
                    f"{supabase_url}/functions/v1/{fn}",
                    headers={"Authorization": f"Bearer {service_key}"},
                    timeout=5.0,
                )
                results[fn] = "warm" if res.status_code < 500 else "cold"
            except Exception:
                results[fn] = "unreachable"

    return {
        "status": "healthy",
        "legacy_status": "ok",
        "functions": results,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
