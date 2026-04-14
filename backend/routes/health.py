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

# ─── Critical env var groups for startup validation ───────────────────────────
_ENV_GROUPS = {
    "auth": {
        "required": ["JWT_SECRET_KEY", "SUPABASE_URL", "SUPABASE_ANON_KEY"],
        "optional": ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_KEY"],
    },
    "ai": {
        "required": ["OPENAI_API_KEY"],
        "optional": ["ANTHROPIC_API_KEY", "GOOGLE_API_KEY", "SERPER_API_KEY"],
    },
    "payments": {
        "required": [],
        "optional": ["STRIPE_API_KEY", "STRIPE_WEBHOOK_SECRET"],
    },
    "email": {
        "required": [],
        "optional": ["RESEND_API_KEY", "RESEND_FROM_EMAIL", "BIQC_ADMIN_NOTIFICATION_EMAIL"],
    },
    "redis": {
        "required": [],
        "optional": ["REDIS_URL", "REDIS_USE_MANAGED_IDENTITY", "REDIS_MANAGED_IDENTITY_CLIENT_ID"],
    },
    "oauth": {
        "required": [],
        "optional": ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "AZURE_CLIENT_ID", "AZURE_CLIENT_SECRET", "AZURE_TENANT_ID"],
    },
    "integrations": {
        "required": [],
        "optional": ["MERGE_API_KEY", "MERGE_WEBHOOK_SECRET"],
    },
    "deployment": {
        "required": [],
        "optional": ["FRONTEND_URL", "BACKEND_URL", "CORS_ALLOW_ORIGINS", "ENVIRONMENT", "PORT"],
    },
}


def validate_env_vars() -> dict:
    """Validate all env var groups and return a summary. Called at startup and by health check."""
    results = {}
    total_missing_required = 0
    total_missing_optional = 0
    for group, vars_dict in _ENV_GROUPS.items():
        missing_req = [v for v in vars_dict["required"] if not os.environ.get(v)]
        missing_opt = [v for v in vars_dict["optional"] if not os.environ.get(v)]
        total_missing_required += len(missing_req)
        total_missing_optional += len(missing_opt)
        status = "ok" if not missing_req else "critical"
        results[group] = {
            "status": status,
            "missing_required": missing_req or None,
            "missing_optional": missing_opt or None,
        }
    return {
        "groups": results,
        "total_missing_required": total_missing_required,
        "total_missing_optional": total_missing_optional,
        "overall": "ok" if total_missing_required == 0 else "critical",
    }


def log_env_validation_on_startup():
    """Log env var validation results on server startup. Called once from server.py."""
    result = validate_env_vars()
    if result["overall"] == "critical":
        for group, info in result["groups"].items():
            if info.get("missing_required"):
                logger.error("STARTUP: Missing REQUIRED env vars in [%s]: %s", group, info["missing_required"])
    if result["total_missing_optional"] > 0:
        missing_groups = {g: info["missing_optional"] for g, info in result["groups"].items() if info.get("missing_optional")}
        logger.warning("STARTUP: Missing optional env vars: %s", missing_groups)
    else:
        logger.info("STARTUP: All env vars configured")


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


def _workers_enabled() -> bool:
    """Return True only when workers are explicitly configured to run in this environment."""
    return (os.environ.get("WORKERS_ENABLED") or "").strip().lower() in {"1", "true", "yes"}


def _check_worker(name, pid_check=None):
    """Check if a worker process is running via supervisor.

    Returns 'not_configured' when supervisorctl is unavailable (e.g. inside a
    Docker container that only runs the API) so the health endpoint can
    distinguish "workers aren't here" from "workers crashed".
    """
    import subprocess, shutil

    if not shutil.which("supervisorctl"):
        return {"status": "not_configured", "detail": "supervisorctl not available in this environment"}

    try:
        result = subprocess.run(
            ["supervisorctl", "status", name],
            capture_output=True, text=True, timeout=5
        )
        output = result.stdout.strip()
        is_running = "RUNNING" in output
        return {"status": "running" if is_running else "stopped", "detail": output}
    except FileNotFoundError:
        return {"status": "not_configured", "detail": "supervisorctl not installed"}
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
    env_validation = validate_env_vars()
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
            "stripe": {"configured": bool(os.environ.get("STRIPE_API_KEY"))},
            "resend": {"configured": bool(os.environ.get("RESEND_API_KEY"))},
            "merge": {"configured": bool(os.environ.get("MERGE_API_KEY"))},
            "anthropic": {"configured": bool(os.environ.get("ANTHROPIC_API_KEY"))},
        },
        "env_validation": env_validation,
    }

    # Core services: API + Supabase + Redis must be healthy.
    core_ok = (
        checks["supabase"].get("reachable", False)
        and checks["redis"].get("status") != "error"
    )

    # Workers only affect overall status when WORKERS_ENABLED is set.
    # Without that flag the workers are expected to run elsewhere (or not at all).
    workers_ok = True
    if _workers_enabled():
        workers_ok = (
            checks["workers"]["email_sync"].get("status") == "running"
            and checks["workers"]["intelligence"].get("status") == "running"
        )

    checks["overall"] = "healthy" if (core_ok and workers_ok) else "degraded"

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
